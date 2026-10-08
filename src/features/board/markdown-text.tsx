import type { ComponentPropsWithoutRef, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const allowedElements = [
  "a", "blockquote", "br", "code", "del", "em", "h1", "h2", "h3", "h4", "h5", "h6", "hr",
  "li", "ol", "p", "pre", "strong", "table", "tbody", "td", "th", "thead", "tr", "ul",
];

function markdownSource(children: ReactNode): string {
  if (Array.isArray(children)) return children.map(markdownSource).join("");
  return typeof children === "string" || typeof children === "number" ? String(children) : "";
}

export function MarkdownText({ children, className = "", ...props }: ComponentPropsWithoutRef<"div">) {
  return <div {...props} className={`markdown-rendered ${className}`}>
    <ReactMarkdown remarkPlugins={[remarkGfm]} allowedElements={allowedElements}>{markdownSource(children)}</ReactMarkdown>
  </div>;
}
