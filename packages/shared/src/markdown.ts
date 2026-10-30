import { sanitizeRichHtml } from './sanitize';

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inline(value: string): string {
  let text = escapeHtml(value);
  // Inline code first so its content is not reformatted.
  const codes: string[] = [];
  text = text.replace(/`([^`]+)`/g, (_, code: string) => {
    const index = codes.push(`<code>${code}</code>`) - 1;
    return `\uE000${index}\uE000`;
  });
  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_, label: string, href: string) =>
      `<a href="${href}" rel="noopener noreferrer nofollow" target="_blank">${label}</a>`,
  );
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  text = text.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  text = text.replace(/~~([^~]+)~~/g, '<s>$1</s>');
  text = text.replace(/\uE000(\d+)\uE000/g, (_, index: string) => codes[Number(index)] ?? '');
  return text;
}

/**
 * Renders a conservative subset of Markdown to HTML. Raw HTML in the source is
 * escaped, then the result passes through the shared rich-HTML sanitizer, so
 * user-authored columns never execute scripts.
 */
export function renderMarkdown(source: string): string {
  const lines = String(source ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n');
  const blocks: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const language = fence[1] ?? '';
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index] ?? '')) {
        code.push(lines[index] ?? '');
        index += 1;
      }
      index += 1;
      blocks.push(
        `<pre><code${language ? ` class="language-${escapeHtml(language)}"` : ''}>${escapeHtml(
          code.join('\n'),
        )}</code></pre>`,
      );
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1]!.length;
      blocks.push(`<h${level}>${inline(heading[2] ?? '')}</h${level}>`);
      index += 1;
      continue;
    }
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      blocks.push('<hr />');
      index += 1;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index] ?? '')) {
        quote.push((lines[index] ?? '').replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push(`<blockquote><p>${quote.map(inline).join('<br />')}</p></blockquote>`);
      continue;
    }
    const unordered = line.match(/^\s*[-*+]\s+(.*)$/);
    if (unordered) {
      const items: string[] = [];
      while (index < lines.length) {
        const item = (lines[index] ?? '').match(/^\s*[-*+]\s+(.*)$/);
        if (!item) break;
        items.push(`<li>${inline(item[1] ?? '')}</li>`);
        index += 1;
      }
      blocks.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    const ordered = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ordered) {
      const items: string[] = [];
      while (index < lines.length) {
        const item = (lines[index] ?? '').match(/^\s*\d+\.\s+(.*)$/);
        if (!item) break;
        items.push(`<li>${inline(item[1] ?? '')}</li>`);
        index += 1;
      }
      blocks.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length) {
      const current = lines[index] ?? '';
      if (
        !current.trim() ||
        /^```/.test(current) ||
        /^(#{1,6})\s+/.test(current) ||
        /^>\s?/.test(current) ||
        /^\s*[-*+]\s+/.test(current) ||
        /^\s*\d+\.\s+/.test(current)
      ) {
        break;
      }
      paragraph.push(inline(current));
      index += 1;
    }
    blocks.push(`<p>${paragraph.join('<br />')}</p>`);
  }
  return sanitizeRichHtml(blocks.join('\n'));
}
