export const APP_NAME = 'uiliuili';
export const APP_VERSION = '0.1.0';
export const CONFIG_DIR = 'config';
export const INSTANCE_FILE = 'instance.json';
export const INSTALL_TOKEN_FILE = 'install-token';

export const USER_ROLES = ['USER', 'UPLOADER', 'REVIEWER', 'ADMIN', 'SUPER_ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PERMISSIONS = [
  'video:read',
  'video:upload',
  'video:manage_own',
  'video:manage_any',
  'danmaku:send',
  'danmaku:manage',
  'comment:manage',
  'user:manage',
  'settings:manage',
  'system:manage',
  'audit:read',
  'report:manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  USER: ['video:read', 'video:upload', 'video:manage_own', 'danmaku:send'],
  UPLOADER: ['video:read', 'video:upload', 'video:manage_own', 'danmaku:send'],
  REVIEWER: [
    'video:read',
    'video:manage_any',
    'danmaku:send',
    'danmaku:manage',
    'comment:manage',
    'report:manage',
  ],
  ADMIN: [
    'video:read',
    'video:upload',
    'video:manage_own',
    'video:manage_any',
    'danmaku:send',
    'danmaku:manage',
    'comment:manage',
    'user:manage',
    'settings:manage',
    'audit:read',
    'report:manage',
  ],
  SUPER_ADMIN: [...PERMISSIONS],
};

export const VIDEO_STATUSES = [
  'draft',
  'uploading',
  'processing',
  'ready',
  'pending_review',
  'published',
  'blocked',
  'failed',
  'deleted',
] as const;
export type VideoStatus = (typeof VIDEO_STATUSES)[number];

export const VIDEO_VISIBILITIES = ['public', 'unlisted', 'private'] as const;
export type VideoVisibility = (typeof VIDEO_VISIBILITIES)[number];

export const DANMAKU_MODES = ['scroll', 'top', 'bottom'] as const;
export type DanmakuMode = (typeof DANMAKU_MODES)[number];

export const NOTIFICATION_TYPES = [
  'comment',
  'reply',
  'mention',
  'like',
  'follow',
  'coin',
  'favorite',
  'system',
  'moderation',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const REPORT_REASONS = [
  'spam',
  'abuse',
  'porn',
  'violence',
  'copyright',
  'misinformation',
  'other',
] as const;

export const OAUTH_PROVIDERS = ['github', 'google', 'oidc'] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export const DEFAULT_CATEGORIES = [
  { slug: 'anime', name: '动画', sort: 10 },
  { slug: 'music', name: '音乐', sort: 20 },
  { slug: 'game', name: '游戏', sort: 30 },
  { slug: 'knowledge', name: '知识', sort: 40 },
  { slug: 'life', name: '生活', sort: 50 },
  { slug: 'film', name: '影视', sort: 60 },
  { slug: 'tech', name: '科技', sort: 70 },
  { slug: 'sports', name: '体育', sort: 80 },
] as const;

export const DEFAULT_SETTINGS = {
  site: {
    name: APP_NAME,
    description: '一个自托管的弹幕视频站',
    url: 'http://localhost:3000',
    locale: 'zh-CN',
    timezone: 'Asia/Shanghai',
    registration: 'open',
    maintenance: false,
    icp: '',
    footer: '',
  },
  upload: {
    maxBytes: 2 * 1024 * 1024 * 1024,
    maxDurationSeconds: 4 * 60 * 60,
    maxResolution: 1080,
    allowedExtensions: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'flv'],
    requireReview: true,
  },
  playback: {
    defaultQuality: 'auto',
    autoplay: false,
    danmakuEnabled: true,
    signedUrlTtlSeconds: 3600,
  },
  danmaku: {
    enabled: true,
    maxLength: 100,
    intervalSeconds: 3,
    defaultOpacity: 0.9,
    defaultFontSize: 25,
    defaultSpeed: 6,
    levelGate: 0,
    blockedWords: [] as string[],
  },
  social: {
    dailyCoins: 2,
    maxCoinPerVideo: 2,
    maxFavoriteFolders: 20,
  },
  recommendation: {
    enabled: true,
    explorationRatio: 0.15,
    cacheSeconds: 180,
    weights: {
      views: 0.06,
      likes: 0.24,
      coins: 0.28,
      favorites: 0.22,
      comments: 0.12,
      completion: 0.08,
      freshness: 1.2,
      reportPenalty: 5,
    },
  },
  mail: {
    enabled: false,
    verificationRequired: false,
  },
  security: {
    sessionDays: 30,
    loginRateLimit: 10,
    installTokenRequired: true,
  },
} as const;

export const COOKIE_NAMES = {
  access: 'ul_access',
  refresh: 'ul_refresh',
  csrf: 'ul_csrf',
  install: 'ul_install',
} as const;

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_DAYS = 30;
export const MAX_UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;
