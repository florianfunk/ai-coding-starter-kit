import { ensureHtml } from "@/lib/rich-text/sanitize";
import { cn } from "@/lib/utils";

type Props = {
  html: string | null | undefined;
  className?: string;
};

export function RichTextDisplay({ html, className }: Props) {
  if (!html) return null;
  const safe = ensureHtml(html);
  if (!safe) return null;
  return (
    <div
      className={cn(
        "max-w-none text-sm leading-relaxed",
        "[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6",
        "[&_p]:my-1 [&_li]:my-0.5",
        "[&_strong]:font-semibold [&_em]:italic [&_u]:underline",
        "[&_.text-sm]:text-xs",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
