import { describe, expect, it } from 'vitest';
import { sanitizeRichHtml } from './sanitize';

describe('sanitizeRichHtml', () => {
  it('keeps ordinary formatting', () => {
    expect(sanitizeRichHtml('<h1>标题</h1><p><strong>正文</strong></p>')).toBe(
      '<h1>标题</h1><p><strong>正文</strong></p>',
    );
  });

  it('removes scripts, styles and embedded documents', () => {
    const result = sanitizeRichHtml(
      '<p>ok</p><script>alert(1)</script><style>p{}</style><iframe src="https://x"></iframe>',
    );
    expect(result).toBe('<p>ok</p>');
  });

  it('removes event handlers, inline styles and unsafe urls', () => {
    const result = sanitizeRichHtml(
      '<p onclick="alert(1)" style="color:red">x</p>' +
        '<a href="javascript:alert(1)">a</a>' +
        '<a href="jav&#x61;script:alert(1)">b</a>' +
        '<a href="data:text/html,hi">c</a>',
    );
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('style=');
    expect(result).not.toContain('javascript');
    expect(result).not.toContain('data:');
    expect(result.match(/<a>/g)).toHaveLength(3);
  });

  it('hardens external links', () => {
    expect(sanitizeRichHtml('<a href="https://example.com">x</a>')).toBe(
      '<a href="https://example.com" rel="noopener noreferrer nofollow">x</a>',
    );
  });

  it('drops unknown tags but keeps their text', () => {
    expect(sanitizeRichHtml('<marquee>hi</marquee>')).toBe('hi');
  });
});
