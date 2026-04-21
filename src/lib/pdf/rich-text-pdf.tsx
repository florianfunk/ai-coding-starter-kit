import { Text, View, type TextProps } from "@react-pdf/renderer";
import { Parser } from "htmlparser2";
import { ALLOWED_COLOR_HEXES } from "@/lib/rich-text/colors";

type Style = NonNullable<TextProps["style"]> extends infer S ? (S extends readonly unknown[] ? S[number] : S) : never;

type Inline = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  small?: boolean;
};

type Block =
  | { kind: "p"; runs: Inline[] }
  | { kind: "ul" | "ol"; items: Inline[][] };

const BLOCK_TAGS = new Set(["p", "ul", "ol", "li", "br"]);

function parseHtml(html: string): Block[] {
  const blocks: Block[] = [];
  const stack: ("strong" | "em" | "u" | "small")[] = [];
  let color: string | undefined;
  let currentBlock: Block | null = null;
  let currentList: { kind: "ul" | "ol"; items: Inline[][] } | null = null;
  let currentListItem: Inline[] | null = null;

  function pushRun(text: string) {
    if (!text) return;
    const run: Inline = {
      text,
      bold: stack.includes("strong") || undefined,
      italic: stack.includes("em") || undefined,
      underline: stack.includes("u") || undefined,
      small: stack.includes("small") || undefined,
      color,
    };
    if (currentListItem) {
      currentListItem.push(run);
    } else {
      if (!currentBlock || currentBlock.kind !== "p") {
        currentBlock = { kind: "p", runs: [] };
        blocks.push(currentBlock);
      }
      currentBlock.runs.push(run);
    }
  }

  const parser = new Parser(
    {
      onopentag(name, attribs) {
        const tag = name.toLowerCase();
        if (tag === "strong" || tag === "b") stack.push("strong");
        else if (tag === "em" || tag === "i") stack.push("em");
        else if (tag === "u") stack.push("u");
        else if (tag === "span") {
          const cls = attribs.class || "";
          if (cls.split(/\s+/).includes("text-sm")) stack.push("small");
          const styleAttr = attribs.style || "";
          const m = styleAttr.match(/color\s*:\s*(#[0-9A-Fa-f]{6})/);
          if (m && ALLOWED_COLOR_HEXES.has(m[1].toUpperCase())) {
            color = m[1].toUpperCase();
          }
        } else if (tag === "p") {
          currentBlock = { kind: "p", runs: [] };
          blocks.push(currentBlock);
        } else if (tag === "ul" || tag === "ol") {
          currentList = { kind: tag, items: [] };
          currentBlock = currentList;
          blocks.push(currentList);
        } else if (tag === "li") {
          currentListItem = [];
          currentList?.items.push(currentListItem);
        } else if (tag === "br") {
          pushRun("\n");
        }
      },
      ontext(text) {
        pushRun(text);
      },
      onclosetag(name) {
        const tag = name.toLowerCase();
        if (tag === "strong" || tag === "b") {
          const i = stack.lastIndexOf("strong");
          if (i >= 0) stack.splice(i, 1);
        } else if (tag === "em" || tag === "i") {
          const i = stack.lastIndexOf("em");
          if (i >= 0) stack.splice(i, 1);
        } else if (tag === "u") {
          const i = stack.lastIndexOf("u");
          if (i >= 0) stack.splice(i, 1);
        } else if (tag === "span") {
          const i = stack.lastIndexOf("small");
          if (i >= 0) stack.splice(i, 1);
          color = undefined;
        } else if (tag === "li") {
          currentListItem = null;
        } else if (tag === "ul" || tag === "ol") {
          currentList = null;
          currentBlock = null;
        } else if (tag === "p") {
          currentBlock = null;
        }
      },
    },
    { decodeEntities: true },
  );
  parser.write(html);
  parser.end();
  return blocks;
}

function runStyle(run: Inline, baseFontSize: number): Style {
  const s: Style = {};
  if (run.bold) s.fontFamily = run.italic ? "Helvetica-BoldOblique" : "Helvetica-Bold";
  else if (run.italic) s.fontFamily = "Helvetica-Oblique";
  if (run.underline) s.textDecoration = "underline";
  if (run.color) s.color = run.color;
  if (run.small) s.fontSize = baseFontSize - 1;
  return s;
}

type RenderOptions = {
  fontSize?: number;
  lineHeight?: number;
  color?: string;
  paragraphSpacing?: number;
};

export function RichTextPdf({
  html,
  options = {},
}: {
  html: string | null | undefined;
  options?: RenderOptions;
}) {
  if (!html) return null;
  const fontSize = options.fontSize ?? 8;
  const lineHeight = options.lineHeight ?? 1.4;
  const color = options.color ?? "#222";
  const paragraphSpacing = options.paragraphSpacing ?? 3;
  const blocks = parseHtml(html);

  return (
    <View>
      {blocks.map((block, bi) => {
        if (block.kind === "p") {
          if (block.runs.length === 0) {
            return <Text key={bi} style={{ fontSize, lineHeight }}>{" "}</Text>;
          }
          return (
            <Text
              key={bi}
              style={{
                fontSize,
                lineHeight,
                color,
                marginBottom: paragraphSpacing,
              }}
            >
              {block.runs.map((run, ri) => (
                <Text key={ri} style={runStyle(run, fontSize)}>
                  {run.text}
                </Text>
              ))}
            </Text>
          );
        }
        return (
          <View key={bi} style={{ marginBottom: paragraphSpacing }}>
            {block.items.map((item, ii) => (
              <View
                key={ii}
                style={{ flexDirection: "row", marginBottom: 1.5 }}
              >
                <Text
                  style={{
                    fontSize,
                    lineHeight,
                    color,
                    width: 12,
                  }}
                >
                  {block.kind === "ul" ? "•" : `${ii + 1}.`}
                </Text>
                <Text
                  style={{
                    fontSize,
                    lineHeight,
                    color,
                    flex: 1,
                  }}
                >
                  {item.map((run, ri) => (
                    <Text key={ri} style={runStyle(run, fontSize)}>
                      {run.text}
                    </Text>
                  ))}
                </Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}
