/**
 * Lightweight markdown renderer — no external deps.
 * Handles: headings, bold, italic, inline code, code blocks, lists, line breaks.
 * Safe for LLM-generated content (no user-supplied HTML).
 */

function mdToHtml(md: string): string {
  let html = md
    // Fenced code blocks (``` ... ```)
    .replace(/```[\w]*\n?([\s\S]*?)```/g, (_m, code) =>
      `<pre class="md-pre"><code>${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`
    )
    // Headings
    .replace(/^#### (.+)$/gm, "<h4 class=\"md-h4\">$1</h4>")
    .replace(/^### (.+)$/gm, "<h3 class=\"md-h3\">$1</h3>")
    .replace(/^## (.+)$/gm, "<h2 class=\"md-h2\">$1</h2>")
    .replace(/^# (.+)$/gm, "<h1 class=\"md-h1\">$1</h1>")
    // Horizontal rule
    .replace(/^---$/gm, "<hr class=\"md-hr\"/>")
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Inline code
    .replace(/`([^`\n]+)`/g, "<code class=\"md-code\">$1</code>")
    // Unordered list items (- or *)
    .replace(/^[\-\*] (.+)$/gm, "<li class=\"md-li\">$1</li>")
    // Ordered list items
    .replace(/^\d+\. (.+)$/gm, "<li class=\"md-li\">$1</li>")
    // Wrap consecutive <li> in <ul>
    .replace(/(<li[\s\S]*?<\/li>)(\n<li|$)/g, "$1$2")
    // Double blank lines → paragraph break
    .replace(/\n{2,}/g, "\n\n")
    // Single newlines inside paragraphs → <br>
    .replace(/([^\n>])\n([^\n<])/g, "$1<br/>$2");

  // Split on double-newlines and wrap non-block content in <p>
  const lines = html.split(/\n\n/);
  html = lines
    .map((block) => {
      const t = block.trim();
      if (!t) return "";
      if (/^<(h[1-6]|pre|hr|ul|ol|li)/.test(t)) return t;
      return `<p class="md-p">${t}</p>`;
    })
    .join("\n");

  return html;
}

export function Markdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div
      className={`md-body${className ? " " + className : ""}`}
      dangerouslySetInnerHTML={{ __html: mdToHtml(content) }}
    />
  );
}
