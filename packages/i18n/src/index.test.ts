import { describe, expect, it } from 'vitest';
import { createTranslator, messages, normalizeLocale, translate, uiEn } from './index';

function flatten(tree: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [path] : flatten(value as Record<string, unknown>, path);
  });
}

describe('i18n catalogs', () => {
  it('keeps the semantic English catalog in sync with Chinese', () => {
    expect(flatten(messages['en-US']).sort()).toEqual(flatten(messages['zh-CN']).sort());
  });

  it('normalizes browser locale tags', () => {
    expect(normalizeLocale('zh-Hans')).toBe('zh-CN');
    expect(normalizeLocale('en-GB')).toBe('en-US');
    expect(normalizeLocale('fr-FR')).toBe('zh-CN');
  });

  it('translates semantic keys and interpolates variables', () => {
    expect(translate('zh-CN', 'nav.home')).toBe('首页');
    expect(translate('en-US', 'nav.home')).toBe('Home');
    expect(translate('en-US', 'video.views', { count: 12 })).toBe('12 views');
  });

  it('keeps unknown keys readable', () => {
    expect(createTranslator('en-US')('missing.key')).toBe('missing.key');
  });

  it('translates source strings collected from the interface', () => {
    expect(translate('en-US', '暂无封面')).toBe('No cover');
    expect(translate('zh-CN', '暂无封面')).toBe('暂无封面');
    expect(translate('en-US', '请求失败（{0}）', { 0: 500 })).toBe('Request failed (500)');
  });

  it('has a non-empty English value for every source string', () => {
    for (const value of Object.values(uiEn)) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });
});
