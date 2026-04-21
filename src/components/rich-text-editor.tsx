"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle, Color } from "@tiptap/extension-text-style";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useState } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Type,
  Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { RICH_TEXT_COLORS } from "@/lib/rich-text/colors";
import { ensureHtml, sanitizeRichTextHtml } from "@/lib/rich-text/sanitize";

type Props = {
  name?: string;
  defaultValue?: string | null;
  value?: string | null;
  onChange?: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  className?: string;
};

export function RichTextEditor({
  name,
  defaultValue,
  value,
  onChange,
  placeholder,
  minHeight = 160,
  className,
}: Props) {
  const isControlled = value !== undefined;
  const initialHtml = ensureHtml(isControlled ? (value ?? "") : (defaultValue ?? ""));
  const [html, setHtml] = useState(initialHtml);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Underline,
      TextStyle,
      Color,
      Placeholder.configure({
        placeholder: placeholder ?? "Beschreibung eingeben…",
      }),
    ],
    content: initialHtml,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          "max-w-none focus:outline-none px-3 py-2 text-sm leading-relaxed",
          "[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6",
          "[&_p]:my-1 [&_li]:my-0.5",
          "[&_strong]:font-semibold [&_em]:italic [&_u]:underline",
          "[&_.text-sm]:text-xs",
        ),
        style: `min-height: ${minHeight}px`,
      },
    },
    onUpdate: ({ editor }) => {
      const raw = editor.getHTML();
      const cleaned = raw === "<p></p>" ? "" : sanitizeRichTextHtml(raw);
      setHtml(cleaned);
      onChange?.(cleaned);
    },
  });

  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  return (
    <div className={cn("rounded-lg border bg-background overflow-hidden", className)}>
      {name && !isControlled && <input type="hidden" name={name} value={html} />}
      <Toolbar editor={editor} />
      <Separator />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) {
    return <div className="h-10 bg-muted/30" aria-hidden />;
  }

  const isSmall = editor.isActive("textStyle", { class: "text-sm" });
  const currentColor = (editor.getAttributes("textStyle").color as string | undefined) ?? null;

  return (
    <div className="flex flex-wrap items-center gap-1 bg-muted/30 px-2 py-1.5">
      <ToolbarButton
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        ariaLabel="Fett (Cmd+B)"
        title="Fett (Cmd+B)"
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        ariaLabel="Kursiv (Cmd+I)"
        title="Kursiv (Cmd+I)"
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        ariaLabel="Unterstrichen (Cmd+U)"
        title="Unterstrichen (Cmd+U)"
      >
        <UnderlineIcon className="h-3.5 w-3.5" />
      </ToolbarButton>

      <ToolbarSeparator />

      <ToolbarButton
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        ariaLabel="Aufzählung"
        title="Aufzählung"
      >
        <List className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        ariaLabel="Nummerierte Liste"
        title="Nummerierte Liste"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarButton>

      <ToolbarSeparator />

      <ToolbarButton
        active={isSmall}
        onClick={() => {
          if (isSmall) {
            editor.chain().focus().unsetMark("textStyle").run();
          } else {
            editor
              .chain()
              .focus()
              .setMark("textStyle", { class: "text-sm" })
              .run();
          }
        }}
        ariaLabel="Kleiner Text"
        title="Kleiner Text"
      >
        <Type className="h-3 w-3" />
        <span className="text-[10px] ml-0.5">klein</span>
      </ToolbarButton>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 gap-1"
            aria-label="Textfarbe"
            title="Textfarbe"
          >
            <Palette className="h-3.5 w-3.5" />
            <span
              className="h-3 w-3 rounded-sm border"
              style={{ backgroundColor: currentColor ?? "transparent" }}
              aria-hidden
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="flex gap-1">
            {RICH_TEXT_COLORS.map((c) => {
              const isStandard = c.hex === "#000000";
              const isActive = isStandard
                ? !currentColor
                : currentColor?.toUpperCase() === c.hex.toUpperCase();
              return (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => {
                    if (isStandard) {
                      editor.chain().focus().unsetColor().run();
                    } else {
                      editor.chain().focus().setColor(c.hex).run();
                    }
                  }}
                  title={c.name}
                  aria-label={c.name}
                  className={cn(
                    "h-7 w-7 rounded border-2 transition-transform hover:scale-110",
                    isActive ? "border-foreground" : "border-transparent",
                  )}
                  style={{ backgroundColor: c.hex }}
                />
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  ariaLabel,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  ariaLabel: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      title={title}
      className={cn(
        "h-7 px-2 gap-1",
        active && "bg-accent text-accent-foreground",
      )}
    >
      {children}
    </Button>
  );
}

function ToolbarSeparator() {
  return <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />;
}
