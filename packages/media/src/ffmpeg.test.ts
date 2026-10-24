import { describe, expect, it } from 'vitest';
import { buildLadder } from './ffmpeg';

describe('HLS ladder', () => {
  it('never upscales a 360p source', () => {
    const ladder = buildLadder(360);
    expect(ladder).toHaveLength(1);
    expect(ladder[0]).toMatchObject({ quality: '360p', width: 640, height: 360 });
  });

  it('creates multiple renditions up to the source height', () => {
    const ladder = buildLadder(1080);
    expect(ladder.map((item) => item.height)).toEqual([360, 480, 720, 1080]);
  });

  it('does not upscale a 240p source', () => {
    const ladder = buildLadder(240);
    expect(ladder).toHaveLength(1);
    expect(ladder[0]).toMatchObject({ quality: '240p', height: 240 });
  });

  it('preserves non-16:9 aspect ratios', () => {
    const ladder = buildLadder(480, 9 / 16);
    expect(ladder.at(-1)?.width).toBeLessThan(ladder.at(-1)!.height);
  });
});
