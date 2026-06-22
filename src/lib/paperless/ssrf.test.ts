import { describe, it, expect } from "vitest";
import {
  istPrivateIPv4,
  istPrivateIPv6,
  istBlockierteIp,
  istBlockierterName,
  pruefePaperlessUrlSicher,
  PaperlessSicherheitsError,
  type AufloesenFn,
} from "./ssrf";

describe("istPrivateIPv4", () => {
  it("erkennt private/reservierte Bereiche", () => {
    for (const ip of [
      "0.0.0.0",
      "10.0.0.1",
      "10.255.255.255",
      "127.0.0.1",
      "169.254.169.254", // Cloud-Metadaten
      "172.16.0.1",
      "172.31.255.255",
      "192.168.0.1",
      "100.64.0.1",
      "255.255.255.255",
    ]) {
      expect(istPrivateIPv4(ip), ip).toBe(true);
    }
  });

  it("lässt öffentliche IPv4 zu", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.15.0.1", "172.32.0.1", "93.184.216.34"]) {
      expect(istPrivateIPv4(ip), ip).toBe(false);
    }
  });
});

describe("istPrivateIPv6", () => {
  it("erkennt loopback, link-local, ULA und mapped v4", () => {
    for (const ip of ["::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "::ffff:127.0.0.1"]) {
      expect(istPrivateIPv6(ip), ip).toBe(true);
    }
  });

  it("lässt öffentliche IPv6 zu", () => {
    expect(istPrivateIPv6("2606:4700:4700::1111")).toBe(false);
  });
});

describe("istBlockierteIp", () => {
  it("blockiert ungültige IP-Literale konservativ", () => {
    expect(istBlockierteIp("nicht-eine-ip")).toBe(true);
  });
});

describe("istBlockierterName", () => {
  it("blockiert lokale Namen", () => {
    for (const h of ["localhost", "LOCALHOST", "foo.localhost", "router.local", "db.internal"]) {
      expect(istBlockierterName(h), h).toBe(true);
    }
  });
  it("lässt öffentliche Namen zu", () => {
    expect(istBlockierterName("paperless.example.com")).toBe(false);
  });
});

describe("pruefePaperlessUrlSicher", () => {
  const oeffentlich: AufloesenFn = async () => ["93.184.216.34"];
  const intern: AufloesenFn = async () => ["10.1.2.3"];

  it("erlaubt eine öffentliche HTTPS-URL (prod-Modus)", async () => {
    await expect(
      pruefePaperlessUrlSicher("https://paperless.example.com/api/", {
        erlaubePrivat: false,
        aufloesen: oeffentlich,
      }),
    ).resolves.toBeUndefined();
  });

  it("blockiert localhost", async () => {
    await expect(
      pruefePaperlessUrlSicher("https://localhost/api/", { erlaubePrivat: false }),
    ).rejects.toMatchObject({ kind: "blocked" });
  });

  it("blockiert literale private IPs ohne DNS", async () => {
    for (const url of [
      "https://127.0.0.1/api/",
      "https://10.0.0.5/api/",
      "https://192.168.1.10/api/",
      "https://169.254.169.254/latest/meta-data/",
      "https://[::1]/api/",
    ]) {
      await expect(
        pruefePaperlessUrlSicher(url, { erlaubePrivat: false }),
        url,
      ).rejects.toBeInstanceOf(PaperlessSicherheitsError);
    }
  });

  it("blockiert Hostnamen, die auf private IPs auflösen", async () => {
    await expect(
      pruefePaperlessUrlSicher("https://intern.example.com/api/", {
        erlaubePrivat: false,
        aufloesen: intern,
      }),
    ).rejects.toMatchObject({ kind: "blocked" });
  });

  it("erzwingt HTTPS im Produktivbetrieb", async () => {
    await expect(
      pruefePaperlessUrlSicher("http://paperless.example.com/api/", {
        erlaubePrivat: false,
        aufloesen: oeffentlich,
      }),
    ).rejects.toMatchObject({ kind: "insecure" });
  });

  it("lehnt nicht-http(s)-Protokolle ab", async () => {
    await expect(
      pruefePaperlessUrlSicher("file:///etc/passwd", { erlaubePrivat: false }),
    ).rejects.toMatchObject({ kind: "bad_url" });
    await expect(
      pruefePaperlessUrlSicher("gopher://x/", { erlaubePrivat: false }),
    ).rejects.toMatchObject({ kind: "bad_url" });
  });

  it("erlaubt im Dev-Modus private Ziele und http", async () => {
    await expect(
      pruefePaperlessUrlSicher("http://localhost:8000/api/", { erlaubePrivat: true }),
    ).resolves.toBeUndefined();
    await expect(
      pruefePaperlessUrlSicher("http://192.168.1.10/api/", { erlaubePrivat: true }),
    ).resolves.toBeUndefined();
  });
});
