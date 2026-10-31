import { describe, expect, it } from 'vitest';
import { MOTION_BOOTSTRAP_SCRIPT } from './browser-support';

interface ProbeOptions {
  fetch?: boolean;
  promise?: boolean;
  reduced?: boolean;
  animate?: boolean;
  hasSelector?: boolean;
}

function probe(userAgent: string, options: ProbeOptions = {}) {
  const documentElement = {
    className: '',
    attributes: {} as Record<string, string>,
    setAttribute(name: string, value: string) {
      this.attributes[name] = value;
    },
  };
  const notice = { style: { display: 'none' } };
  const document = {
    documentElement,
    getElementById: (id: string) => (id === 'browser-support-notice' ? notice : null),
  };
  const window = {
    fetch: options.fetch === false ? undefined : () => undefined,
    Promise: options.promise === false ? undefined : function PromiseStub() {},
    matchMedia: () => ({ matches: Boolean(options.reduced) }),
  };
  const navigator = { userAgent };
  const Element = { prototype: options.animate === false ? {} : { animate: () => undefined } };
  const CSS = { supports: () => options.hasSelector !== false };

  new Function('window', 'document', 'navigator', 'Element', 'CSS', MOTION_BOOTSTRAP_SCRIPT)(
    window,
    document,
    navigator,
    Element,
    CSS,
  );

  return {
    motion: documentElement.attributes['data-motion'],
    unsupported: documentElement.className.includes('browser-unsupported'),
    notice: notice.style.display,
  };
}

const CHROME = (version: number) =>
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36`;
const FIREFOX = (version: number) =>
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${version}.0) Gecko/20100101 Firefox/${version}.0`;
const SAFARI = (version: string) =>
  `Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${version} Safari/605.1.15`;
const EDGE = (version: number) => `${CHROME(version)} Edg/${version}.0.0.0`;
const OPERA = (version: number) => `${CHROME(version)} OPR/${version}.0.0.0`;

describe('browser motion bootstrap', () => {
  it('enables motion for current browsers', () => {
    expect(probe(CHROME(130)).motion).toBe('full');
    expect(probe(FIREFOX(125)).motion).toBe('full');
    expect(probe(SAFARI('17.4')).motion).toBe('full');
    expect(probe(EDGE(130)).motion).toBe('full');
    expect(probe(OPERA(110)).motion).toBe('full');
  });

  it('disables motion for older engines that still work', () => {
    expect(probe(CHROME(90))).toMatchObject({ motion: 'none', unsupported: false });
    expect(probe(FIREFOX(100))).toMatchObject({ motion: 'none', unsupported: false });
    expect(probe(SAFARI('15.6'))).toMatchObject({ motion: 'none', unsupported: false });
    expect(probe(EDGE(90))).toMatchObject({ motion: 'none', unsupported: false });
    expect(probe(OPERA(80))).toMatchObject({ motion: 'none', unsupported: false });
  });

  it('always respects the reduced-motion preference', () => {
    expect(probe(CHROME(130), { reduced: true }).motion).toBe('none');
  });

  it('falls back to feature detection for unknown engines', () => {
    expect(probe('SomeBrowser/2.0').motion).toBe('full');
    expect(probe('SomeBrowser/2.0', { hasSelector: false }).motion).toBe('none');
    expect(probe('SomeBrowser/2.0', { animate: false }).motion).toBe('none');
  });

  it('flags Internet Explorer and other unusable browsers', () => {
    const ie = probe('Mozilla/5.0 (Windows NT 10.0; Trident/7.0; rv:11.0) like Gecko');
    expect(ie).toEqual({ motion: 'none', unsupported: true, notice: 'block' });

    const noFetch = probe(CHROME(130), { fetch: false });
    expect(noFetch).toEqual({ motion: 'none', unsupported: true, notice: 'block' });
  });

  it('leaves the notice hidden for supported browsers', () => {
    expect(probe(CHROME(90))).toMatchObject({ unsupported: false, notice: 'none' });
    expect(probe(CHROME(130))).toMatchObject({ unsupported: false, notice: 'none' });
  });
});
