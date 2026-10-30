import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('renders headings, lists, quotes and paragraphs', () => {
    const html = renderMarkdown(
      ['# Title', '', '- one', '- two', '', '> quote', '', 'A paragraph.'].join('\n'),
    );
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<ul><li>one</li><li>two</li></ul>');
    expect(html).toContain('<blockquote><p>quote</p></blockquote>');
    expect(html).toContain('<p>A paragraph.</p>');
  });

  it('supports fenced code, inline code and safe links', () => {
    const html = renderMarkdown(
      [
        'Use `code` here.',
        '',
        '```ts',
        'const a = 1 < 2;',
        '```',
        '',
        '[site](https://example.com)',
      ].join('\n'),
    );
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('const a = 1 &lt; 2;');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });

  it('escapes raw HTML instead of executing it', () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
  });

  it('drops javascript: links', () => {
    const html = renderMarkdown('[click](javascript:alert(1))');
    expect(html).not.toContain('href="javascript:');
  });

  it('renders bold, italic and strikethrough', () => {
    const html = renderMarkdown('**bold** *italic* ~~gone~~');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<s>gone</s>');
  });
});
