import type { DanmakuItem } from './types';

export interface ParsedDanmaku {
  progressMs: number;
  mode: 'scroll' | 'top' | 'bottom';
  color: string;
  fontSize: number;
  content: string;
}

function modeFromCode(code: string): 'scroll' | 'top' | 'bottom' {
  if (code === '5') return 'top';
  if (code === '4') return 'bottom';
  return 'scroll';
}

export function parseBilibiliXml(xml: string): ParsedDanmaku[] {
  const result: ParsedDanmaku[] = [];
  const regex = /<d p="([^"]+)"[^>]*>([\s\S]*?)<\/d>/g;
  let match: RegExpExecArray | null = regex.exec(xml);
  while (match) {
    const attrs = match[1]!.split(',');
    const content = match[2]!
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    const seconds = Number.parseFloat(attrs[0] ?? '0');
    const mode = modeFromCode(attrs[1] ?? '1');
    const fontSize = Number.parseInt(attrs[2] ?? '25', 10) || 25;
    const colorValue = Number.parseInt(attrs[3] ?? '16777215', 10) || 16777215;
    if (!Number.isFinite(seconds) || !content.trim()) {
      match = regex.exec(xml);
      continue;
    }
    result.push({
      progressMs: Math.round(seconds * 1000),
      mode,
      color: `#${colorValue.toString(16).padStart(6, '0')}`,
      fontSize: Math.min(48, Math.max(12, fontSize)),
      content: content.slice(0, 100),
    });
    match = regex.exec(xml);
  }
  return result.sort((a, b) => a.progressMs - b.progressMs);
}

export function serializeBilibiliXml(items: DanmakuItem[]): string {
  const lines = items.map((item) => {
    const seconds = (item.progressMs / 1000).toFixed(2);
    const mode = item.mode === 'top' ? 5 : item.mode === 'bottom' ? 4 : 1;
    const color = Number.parseInt(item.color.replace('#', ''), 16) || 16777215;
    const content = item.content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    return `  <d p="${seconds},${mode},${item.fontSize},${color},0,0,0,0,0">${content}</d>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<i>\n${lines.join('\n')}\n</i>\n`;
}
