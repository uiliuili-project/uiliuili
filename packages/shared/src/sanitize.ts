const BLOCKED_ELEMENTS = [
  'script',
  'style',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'link',
  'meta',
  'base',
];

const ALLOWED_TAGS = new Set([
  'a',
  'abbr',
  'b',
  'blockquote',
  'br',
  'code',
  'dd',
  'div',
  'dl',
  'dt',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
]);

/**
 * Removes scripting vectors from administrator-authored legal documents while
 * keeping ordinary formatting. Custom header/footer code intentionally does
 * not use this helper because it may contain scripts by design.
 */
export function sanitizeRichHtml(input: string): string {
  let html = String(input ?? '');
  for (const tag of BLOCKED_ELEMENTS) {
    html = html.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'gi'), '');
    html = html.replace(new RegExp(`<${tag}\\b[^>]*/?>`, 'gi'), '');
  }
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  html = html.replace(/<\/?([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g, (match, rawTag, rawAttrs) => {
    const tag = String(rawTag).toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return '';
    if (match.startsWith('</')) return `</${tag}>`;
    const attrs = String(rawAttrs)
      .replace(/\s+on[a-zA-Z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/\s+style\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/\s+(src|srcset)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    const hrefMatch = attrs.match(/\shref\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i);
    let safeAttrs = attrs;
    if (tag === 'a' && hrefMatch) {
      const rawHref = hrefMatch[1] ?? '';
      const href = decodeEntities(rawHref.replace(/^["']|["']$/g, '')).trim();
      const compact = Array.from(href)
        .filter((character) => character.charCodeAt(0) > 31 && !/\s/.test(character))
        .join('')
        .toLowerCase();
      if (/^(javascript|data|vbscript):/.test(compact)) {
        safeAttrs = safeAttrs.replace(hrefMatch[0], '');
      } else if (/^https?:/i.test(href)) {
        safeAttrs += ' rel="noopener noreferrer nofollow"';
      }
    }
    return `<${tag}${safeAttrs}>`;
  });
  return html;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  colon: ':',
  tab: '\t',
  newline: '\n',
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);?/gi, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith('#')) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}
