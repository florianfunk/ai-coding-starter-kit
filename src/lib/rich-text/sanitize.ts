import { ALLOWED_COLOR_HEXES } from "./colors";

// Reine String-basierte Sanitization (ohne DOMPurify/jsdom).
// Gründe:
//  - isomorphic-dompurify crashte zuverlässig im Vercel-Production-Runtime.
//  - Wir haben eine extrem enge Allow-List (10 Tags, 2 Attribute) und
//    nur 3 interne, vertrauenswürdige Nutzer.
//  - Tiptap produziert vorhersagbares HTML; wir müssen nicht gegen
//    beliebigen fremden Input härten.

const ALLOWED_TAGS = new Set(["p", "br", "strong", "em", "u", "ul", "ol", "li", "span"]);
const ALLOWED_CLASSES = new Set(["text-sm"]);
const COLOR_RE = /^color:\s*(#[0-9A-Fa-f]{6})\s*;?$/;

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

// Tags, die nicht in der Allow-List sind: Inhalt behalten, Tag entfernen.
// Self-closing Varianten (br, img …) komplett weg.
function stripDisallowedTags(html: string): string {
  // Alle HTML-Kommentare raus
  let out = html.replace(/<!--[\s\S]*?-->/g, "");
  // <script>/<style>-Inhalt komplett entfernen (nicht nur Tag — auch Body)
  out = out.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  // Alle übrigen Tags durchgehen
  out = out.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (full, tag: string) => {
    if (ALLOWED_TAGS.has(tag.toLowerCase())) return full;
    return ""; // Tag entfernen, Inhalt bleibt
  });
  return out;
}

// style="..." und class="..." pro Tag filtern. Andere Attribute entfernen.
function filterAttributes(html: string): string {
  return html.replace(/<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (_full, tag: string, attrs: string) => {
    if (!ALLOWED_TAGS.has(tag.toLowerCase())) return _full; // strip... hat's schon
    let safeAttrs = "";
    // style
    const styleMatch = attrs.match(/\sstyle\s*=\s*"([^"]*)"/i);
    if (styleMatch) {
      const safe = cleanStyle(styleMatch[1]);
      if (safe) safeAttrs += ` style="${safe}"`;
    }
    // class
    const classMatch = attrs.match(/\sclass\s*=\s*"([^"]*)"/i);
    if (classMatch) {
      const safe = cleanClass(classMatch[1]);
      if (safe) safeAttrs += ` class="${safe}"`;
    }
    // self-closing beibehalten, wenn Original so war
    const selfClose = /\/\s*$/.test(attrs) ? " /" : "";
    return `<${tag}${safeAttrs}${selfClose}>`;
  });
}

export function sanitizeRichTextHtml(input: string | null | undefined): string {
  if (!input) return "";
  return filterAttributes(stripDisallowedTags(input));
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
