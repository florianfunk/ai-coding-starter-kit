import DOMPurify from "isomorphic-dompurify";
import { ALLOWED_COLOR_HEXES } from "./colors";

const ALLOWED_TAGS = ["p", "br", "strong", "em", "u", "ul", "ol", "li", "span"];
const ALLOWED_ATTR = ["style", "class"];

const COLOR_RE = /^color:\s*(#[0-9A-Fa-f]{6})\s*;?$/;
const ALLOWED_CLASSES = new Set(["text-sm"]);

function cleanStyle(style: string): string {
  const match = style.replace(/\s+/g, " ").trim().match(COLOR_RE);
  if (!match) return "";
  const hex = match[1].toUpperCase();
  return ALLOWED_COLOR_HEXES.has(hex) ? `color: ${hex}` : "";
}

function cleanClass(cls: string): string {
  return cls
    .split(/\s+/)
    .filter((c) => ALLOWED_CLASSES.has(c))
    .join(" ");
}

export function sanitizeRichTextHtml(input: string | null | undefined): string {
  if (!input) return "";
  const cleaned = DOMPurify.sanitize(input, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    KEEP_CONTENT: true,
  });
  if (typeof window === "undefined") {
    return cleaned
      .replace(/style="([^"]*)"/g, (_, style) => {
        const safe = cleanStyle(style);
        return safe ? `style="${safe}"` : "";
      })
      .replace(/class="([^"]*)"/g, (_, cls) => {
        const safe = cleanClass(cls);
        return safe ? `class="${safe}"` : "";
      })
      .replace(/\s+>/g, ">");
  }
  const tpl = document.createElement("template");
  tpl.innerHTML = cleaned;
  tpl.content.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    const safe = cleanStyle(el.getAttribute("style") || "");
    if (safe) el.setAttribute("style", safe);
    else el.removeAttribute("style");
  });
  tpl.content.querySelectorAll<HTMLElement>("[class]").forEach((el) => {
    const safe = cleanClass(el.getAttribute("class") || "");
    if (safe) el.setAttribute("class", safe);
    else el.removeAttribute("class");
  });
  return tpl.innerHTML;
}

export function isHtmlContent(value: string | null | undefined): boolean {
  if (!value) return false;
  return /<\/?(p|br|strong|em|u|ul|ol|li|span)\b/i.test(value);
}

export function plainTextToHtml(text: string | null | undefined): string {
  if (!text) return "";
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inList = false;
  for (const raw of lines) {
    const line = raw.trim();
    const bulletMatch = line.match(/^[•\-*]\s+(.*)$/);
    if (bulletMatch) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${escapeHtml(bulletMatch[1])}</li>`);
    } else {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      if (line === "") {
        out.push("<p></p>");
      } else {
        out.push(`<p>${escapeHtml(line)}</p>`);
      }
    }
  }
  if (inList) out.push("</ul>");
  return out.join("");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function ensureHtml(value: string | null | undefined): string {
  if (!value) return "";
  return isHtmlContent(value) ? sanitizeRichTextHtml(value) : plainTextToHtml(value);
}

export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<\/li>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<\/p>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
