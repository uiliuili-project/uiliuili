import {
  DEFAULT_DANMAKU_OPTIONS,
  type DanmakuItem,
  type DanmakuOptions,
  type RenderDanmaku,
} from './types';

interface LaneState {
  freeAt: number;
  lastSpawnAt: number;
}

const SCROLL_DURATION_MS = 9000;
const FIXED_DURATION_MS = 4000;
const LANE_GAP = 4;

export class DanmakuEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private options: DanmakuOptions;
  private items: DanmakuItem[] = [];
  private rendered = new Map<string, RenderDanmaku>();
  private scrollLanes: LaneState[] = [];
  private topLanes: LaneState[] = [];
  private bottomLanes: LaneState[] = [];
  private currentTime = 0;
  private playing = false;
  private rafId: number | null = null;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private lastFrameAt = 0;
  private resizeObserver: ResizeObserver | null = null;

  constructor(canvas: HTMLCanvasElement, options: Partial<DanmakuOptions> = {}) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context is unavailable');
    this.canvas = canvas;
    this.ctx = ctx;
    this.options = { ...DEFAULT_DANMAKU_OPTIONS, ...options };
    this.resize();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas);
    }
  }

  setOptions(options: Partial<DanmakuOptions>): void {
    this.options = { ...this.options, ...options };
    this.render();
  }

  getOptions(): DanmakuOptions {
    return { ...this.options };
  }

  setItems(items: DanmakuItem[]): void {
    this.items = [...items]
      .filter((item) => this.shouldDisplay(item))
      .sort((a, b) => a.progressMs - b.progressMs);
    this.rendered.clear();
    this.scrollLanes = [];
    this.topLanes = [];
    this.bottomLanes = [];
    this.render();
  }

  add(item: DanmakuItem): void {
    if (!this.shouldDisplay(item)) return;
    const index = this.items.findIndex((candidate) => candidate.progressMs > item.progressMs);
    if (index < 0) this.items.push(item);
    else this.items.splice(index, 0, item);
    this.render();
  }

  clear(): void {
    this.items = [];
    this.rendered.clear();
    this.render();
  }

  setTime(progressMs: number): void {
    this.currentTime = Math.max(0, progressMs);
    this.render();
  }

  play(): void {
    this.playing = true;
    this.lastFrameAt = performance.now();
    this.loop();
  }

  pause(): void {
    this.playing = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.render();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.max(1, window.devicePixelRatio || 1);
    this.width = Math.max(1, Math.floor(rect.width));
    this.height = Math.max(1, Math.floor(rect.height));
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.rebuildLanes();
    this.render();
  }

  destroy(): void {
    this.pause();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.rendered.clear();
    this.items = [];
  }

  private loop = (): void => {
    if (!this.playing) return;
    const now = performance.now();
    const delta = Math.min(100, now - this.lastFrameAt);
    this.lastFrameAt = now;
    this.currentTime += delta;
    this.render();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private shouldDisplay(item: DanmakuItem): boolean {
    if (item.mode === 'scroll' && !this.options.scrollEnabled) return false;
    if (item.mode === 'top' && !this.options.topEnabled) return false;
    if (item.mode === 'bottom' && !this.options.bottomEnabled) return false;
    const lower = item.content.toLowerCase();
    if (this.options.blockedWords.some((word) => word && lower.includes(word.toLowerCase()))) {
      return false;
    }
    return true;
  }

  private rebuildLanes(): void {
    this.scrollLanes = [];
    this.topLanes = [];
    this.bottomLanes = [];
    this.rendered.clear();
  }

  private laneHeight(): number {
    return Math.round(this.options.fontSize * 1.45) + LANE_GAP;
  }

  private laneCount(): number {
    const area = this.height * this.options.displayArea;
    return Math.max(1, Math.floor(area / this.laneHeight()));
  }

  private pickLane(mode: DanmakuItem['mode'], width: number, progressMs: number): number {
    const count = this.laneCount();
    if (mode === 'scroll') {
      if (this.scrollLanes.length !== count) {
        this.scrollLanes = Array.from({ length: count }, () => ({ freeAt: 0, lastSpawnAt: 0 }));
      }
      const duration = this.scrollDuration(width);
      for (let index = 0; index < count; index += 1) {
        const lane = this.scrollLanes[index]!;
        if (lane.freeAt <= progressMs) {
          lane.freeAt = progressMs + duration * 0.55;
          lane.lastSpawnAt = progressMs;
          return index;
        }
      }
      let best = 0;
      for (let index = 1; index < count; index += 1) {
        if (this.scrollLanes[index]!.freeAt < this.scrollLanes[best]!.freeAt) best = index;
      }
      const lane = this.scrollLanes[best]!;
      lane.freeAt = progressMs + duration * 0.55;
      lane.lastSpawnAt = progressMs;
      return best;
    }

    const lanes = mode === 'top' ? this.topLanes : this.bottomLanes;
    if (lanes.length !== count) {
      lanes.splice(
        0,
        lanes.length,
        ...Array.from({ length: count }, () => ({ freeAt: 0, lastSpawnAt: 0 })),
      );
    }
    for (let index = 0; index < count; index += 1) {
      const lane = lanes[index]!;
      if (lane.freeAt <= progressMs) {
        lane.freeAt = progressMs + FIXED_DURATION_MS;
        lane.lastSpawnAt = progressMs;
        return index;
      }
    }
    return 0;
  }

  private scrollDuration(width: number): number {
    const base = 7000;
    return Math.max(3500, base / Math.max(1, this.options.speed / 6) + width * 2);
  }

  private prepare(item: DanmakuItem): RenderDanmaku | null {
    const fontSize = Math.round(item.fontSize || this.options.fontSize);
    this.ctx.font = `${this.options.bold ? 'bold ' : ''}${fontSize}px ${this.options.fontFamily}`;
    const width = this.ctx.measureText(item.content).width;
    if (width > this.width * 0.92) return null;
    const mode = item.mode === 'top' || item.mode === 'bottom' ? item.mode : 'scroll';
    const lane = this.pickLane(mode, width, item.progressMs);
    const duration = mode === 'scroll' ? this.scrollDuration(width) : FIXED_DURATION_MS;
    return {
      ...item,
      lane,
      width,
      height: fontSize,
      enterAt: item.progressMs,
      leaveAt: item.progressMs + duration,
      mode,
    } as RenderDanmaku;
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    if (!this.options.opacity) return;
    const windowStart = this.currentTime - 200;
    const windowEnd = this.currentTime + 1200;

    for (const item of this.items) {
      if (item.progressMs > windowEnd) break;
      if (item.progressMs < windowStart - SCROLL_DURATION_MS) {
        this.rendered.delete(item.id);
        continue;
      }
      let render = this.rendered.get(item.id);
      if (!render) {
        const prepared = this.prepare(item);
        if (!prepared) continue;
        this.rendered.set(item.id, prepared);
        render = prepared;
      }
      if (this.currentTime < render.enterAt || this.currentTime > render.leaveAt) continue;
      this.draw(render);
    }

    if (this.rendered.size > 1200) {
      for (const [id, render] of this.rendered) {
        if (render.leaveAt < this.currentTime - 5000) this.rendered.delete(id);
      }
    }
  }

  private draw(item: RenderDanmaku): void {
    const ctx = this.ctx;
    const laneHeight = this.laneHeight();
    const lineHeight = item.height;
    const top = item.lane * laneHeight + laneHeight * 0.5 - lineHeight * 0.5;
    let x: number;
    if (item.mode === 'scroll') {
      const progress = (this.currentTime - item.enterAt) / (item.leaveAt - item.enterAt);
      x = this.width - progress * (this.width + item.width);
    } else {
      x = (this.width - item.width) / 2;
    }
    let y = top + lineHeight;
    if (item.mode === 'bottom') {
      y = this.height - item.lane * laneHeight - laneHeight * 0.5 + lineHeight * 0.4;
    }

    ctx.save();
    ctx.globalAlpha = this.options.opacity;
    ctx.font = `${this.options.bold ? 'bold ' : ''}${item.fontSize}px ${this.options.fontFamily}`;
    ctx.textBaseline = 'alphabetic';
    if (this.options.shadow) {
      ctx.lineWidth = Math.max(1.5, item.fontSize / 12);
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.strokeText(item.content, x, y);
    }
    ctx.fillStyle = item.color || '#ffffff';
    ctx.fillText(item.content, x, y);
    if (item.mine) {
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 2, y - item.fontSize, item.width + 4, item.fontSize * 1.3);
    }
    ctx.restore();
  }
}
