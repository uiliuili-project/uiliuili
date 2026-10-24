import { describe, expect, it } from 'vitest';
import { parseBilibiliXml, serializeBilibiliXml } from './bilibili';

describe('bilibili danmaku XML', () => {
  it('parses and round-trips common danmaku', () => {
    const xml = '<i><d p="1.23,1,25,16777215,0,0,0,0,0">hello &amp; world</d></i>';
    const parsed = parseBilibiliXml(xml);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      progressMs: 1230,
      mode: 'scroll',
      color: '#ffffff',
      content: 'hello & world',
    });

    const output = serializeBilibiliXml([
      {
        id: '1',
        progressMs: 1230,
        mode: 'scroll',
        color: '#ffffff',
        fontSize: 25,
        content: 'hello & world',
      },
    ]);
    expect(output).toContain('hello &amp; world');
  });
});
