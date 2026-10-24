export type DanmakuMode = 'scroll' | 'top' | 'bottom';

export interface DanmakuItem {
  id: string;
  progressMs: number;
  mode: DanmakuMode | string;
  color: string;
  fontSize: number;
  content: string;
  createdAt?: string;
  mine?: boolean;
}

export interface DanmakuOptions {
  opacity: number;
  fontSize: number;
  speed: number;
  displayArea: number;
  scrollEnabled: boolean;
  topEnabled: boolean;
  bottomEnabled: boolean;
  bold: boolean;
  fontFamily: string;
  shadow: boolean;
  blockedWords: string[];
  blockedUsers: string[];
  onSend?: (text: string) => void;
}

export interface RenderDanmaku extends DanmakuItem {
  lane: number;
  width: number;
  height: number;
  enterAt: number;
  leaveAt: number;
}

export const DEFAULT_DANMAKU_OPTIONS: DanmakuOptions = {
  opacity: 0.9,
  fontSize: 25,
  speed: 6,
  displayArea: 0.75,
  scrollEnabled: true,
  topEnabled: true,
  bottomEnabled: true,
  bold: false,
  fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
  shadow: true,
  blockedWords: [],
  blockedUsers: [],
};
