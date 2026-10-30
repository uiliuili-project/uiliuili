import { describe, expect, it } from 'vitest';
import { geoipLocation } from './geoip';

describe('geoipLocation', () => {
  it('keeps a Chinese province from a city database record', () => {
    expect(
      geoipLocation({
        country: { iso_code: 'CN' },
        subdivisions: [{ iso_code: 'ZJ' }],
      }),
    ).toEqual({ code: 'CN', province: 'ZJ' });
  });

  it('ignores subdivisions outside mainland China', () => {
    expect(
      geoipLocation({
        country: { iso_code: 'US' },
        subdivisions: [{ iso_code: 'CA' }],
      }),
    ).toEqual({ code: 'US', province: '' });
  });

  it('falls back to the country when no known province is present', () => {
    expect(
      geoipLocation({ country: { iso_code: 'CN' }, subdivisions: [{ iso_code: '??' }] }),
    ).toEqual({ code: 'CN', province: '' });
    expect(geoipLocation({ country: { iso_code: 'CN' } })).toEqual({ code: 'CN', province: '' });
    expect(geoipLocation(null)).toEqual({ code: '', province: '' });
  });
});
