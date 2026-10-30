import { describe, expect, it } from 'vitest';
import {
  CN_PROVINCE_OPTIONS,
  composeIpRegion,
  isRegionBlocked,
  isRegionCode,
  normalizeProvinceCode,
  normalizeRegionCode,
  normalizeRegionList,
  provinceOption,
  regionLabel,
} from './regions';
import { normalizeVideoRegionPolicy } from './schemas/region';

describe('regions', () => {
  it('normalizes valid two-letter country codes', () => {
    expect(normalizeRegionCode(' cn ')).toBe('CN');
    expect(normalizeRegionCode('us')).toBe('US');
    expect(isRegionCode('jp')).toBe(true);
  });

  it('rejects unknown or malformed codes', () => {
    expect(normalizeRegionCode('ZZ')).toBe('');
    expect(normalizeRegionCode('')).toBe('');
    expect(normalizeRegionCode(null)).toBe('');
    expect(isRegionCode('CHN')).toBe(false);
  });

  it('labels Chinese provinces while keeping country-level access control', () => {
    expect(CN_PROVINCE_OPTIONS).toHaveLength(34);
    expect(composeIpRegion('CN', 'ZJ')).toBe('CN-ZJ');
    expect(composeIpRegion('cn', 'cn-zj')).toBe('CN-ZJ');
    expect(composeIpRegion('CN', '')).toBe('CN');
    expect(composeIpRegion('US', 'ZJ')).toBe('US');
    expect(provinceOption('hk')?.name).toBe('香港');
    expect(normalizeProvinceCode('CN-HK')).toBe('HK');
    expect(normalizeProvinceCode('ZZ')).toBe('');
    expect(regionLabel('CN-ZJ')).toBe('浙江');
    expect(regionLabel('CN-ZJ', 'en-US')).toBe('Zhejiang');
    expect(regionLabel('CN-XX')).toBe('中国');
    expect(regionLabel('CN')).toBe('中国');
    expect(isRegionCode('CN-ZJ')).toBe(false);
  });

  it('deduplicates and sorts a region list, dropping unknown codes', () => {
    expect(normalizeRegionList(['us', 'CN', 'cn', 'ZZ', 42])).toEqual(['CN', 'US']);
    expect(normalizeRegionList('CN')).toEqual([]);
  });

  it('reports blocked regions case-insensitively', () => {
    expect(isRegionBlocked('cn', ['CN', 'RU'])).toBe(true);
    expect(isRegionBlocked('us', ['CN', 'RU'])).toBe(false);
    expect(isRegionBlocked('', ['CN'])).toBe(false);
  });

  it('labels a region for the requested locale', () => {
    expect(regionLabel('CN')).toBe('中国');
    expect(regionLabel('CN', 'en-US')).toBe('China');
    expect(regionLabel('ZZ')).toBe('ZZ');
  });
});

describe('video region policy', () => {
  it('forces restricted content to use the site block mode', () => {
    expect(
      normalizeVideoRegionPolicy({
        restricted: true,
        regionMode: 'inherit',
        regionCodes: ['US'],
      }),
    ).toMatchObject({ restricted: true, regionMode: 'block', regionCodes: [] });
  });

  it('keeps a normal video block list when a mode is supplied', () => {
    const policy = normalizeVideoRegionPolicy({
      restricted: false,
      regionMode: 'block',
      regionCodes: ['us', 'zz'],
      regionDenyBehavior: 'not_found',
      regionDenyMessage: 'x'.repeat(300),
    });
    expect(policy).toMatchObject({
      restricted: false,
      regionMode: 'block',
      regionCodes: ['US'],
      regionDenyBehavior: 'not_found',
    });
    expect(policy.regionDenyMessage).toHaveLength(200);
  });

  it('defaults an omitted policy to inherit without a list', () => {
    expect(normalizeVideoRegionPolicy({})).toMatchObject({
      restricted: false,
      regionMode: 'inherit',
      regionCodes: [],
      regionDenyBehavior: 'default',
    });
  });
});
