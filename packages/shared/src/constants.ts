export const APP_NAME = 'uiliuili';
export const APP_VERSION = '0.1.0';
export const CONFIG_DIR = 'config';
export const INSTANCE_FILE = 'instance.json';
export const INSTALL_TOKEN_FILE = 'install-token';

export const USER_ROLES = ['USER', 'UPLOADER', 'REVIEWER', 'ADMIN', 'SUPER_ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * Coarse user group stored on the user record. Roles remain the source of
 * truth for permissions; the group is a stable marker used by the interface to
 * separate the creator center, the review desk, and the administration
 * console.
 */
export const USER_GROUPS = ['USER', 'CREATOR', 'REVIEWER', 'ADMIN', 'OWNER'] as const;
export type UserGroup = (typeof USER_GROUPS)[number];

export const PERMISSIONS = [
  'video:read',
  'video:upload',
  'video:manage_own',
  'danmaku:send',
  'video:review',
  'video:manage_any',
  'video:feature',
  'comment:manage',
  'danmaku:manage',
  'report:manage',
  'user:view',
  'user:moderate',
  'user:assign_role',
  'category:manage',
  'announcement:manage',
  'settings:site',
  'settings:content',
  'settings:integration',
  'settings:security',
  'system:view',
  'system:operate',
  'system:update',
  'audit:read',
  'owner:transfer',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const BASIC_PERMISSIONS: Permission[] = [
  'video:read',
  'video:upload',
  'video:manage_own',
  'danmaku:send',
];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  USER: [...BASIC_PERMISSIONS],
  UPLOADER: [...BASIC_PERMISSIONS],
  REVIEWER: [
    ...BASIC_PERMISSIONS,
    'video:review',
    'video:manage_any',
    'comment:manage',
    'danmaku:manage',
    'report:manage',
  ],
  ADMIN: [
    ...BASIC_PERMISSIONS,
    'video:review',
    'video:manage_any',
    'video:feature',
    'comment:manage',
    'danmaku:manage',
    'report:manage',
    'user:view',
    'user:moderate',
    'category:manage',
    'announcement:manage',
    'settings:site',
    'settings:content',
    'system:view',
    'audit:read',
  ],
  SUPER_ADMIN: [...PERMISSIONS],
};

export const OWNER_ROLE: UserRole = 'SUPER_ADMIN';
export const OWNER_GROUP: UserGroup = 'OWNER';

/**
 * Secret setting holding the hashed one-time claim token that allows the
 * first registration to become the owner when the request is not local.
 */
export const OWNER_CLAIM_SETTING = 'owner_claim';

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

/**
 * Region policy for videos. `inherit` follows the site restricted-content
 * rules only; `block` additionally denies playback in the listed countries.
 */
export const VIDEO_REGION_MODES = ['inherit', 'block'] as const;
export type VideoRegionMode = (typeof VIDEO_REGION_MODES)[number];

/**
 * How a denied playback is presented. `default` follows the site setting.
 */
export const REGION_DENY_BEHAVIORS = ['default', 'message', 'not_found'] as const;
export type RegionDenyBehavior = (typeof REGION_DENY_BEHAVIORS)[number];

export const REGION_SOURCES = ['registration', 'header', 'geoip', 'fallback', 'admin'] as const;
export type RegionSource = (typeof REGION_SOURCES)[number];

export const DANMAKU_MODES = ['scroll', 'top', 'bottom'] as const;
export type DanmakuMode = (typeof DANMAKU_MODES)[number];

export const DANMAKU_POOLS = ['normal', 'subtitle', 'special'] as const;
export type DanmakuPool = (typeof DANMAKU_POOLS)[number];

export const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500] as const;

export function levelForExperience(experience: number): number {
  let level = 0;
  for (let index = 0; index < LEVEL_THRESHOLDS.length; index += 1) {
    if (experience >= LEVEL_THRESHOLDS[index]!) level = index;
  }
  return level;
}

export function experienceForLevel(level: number): number {
  return LEVEL_THRESHOLDS[Math.max(0, Math.min(LEVEL_THRESHOLDS.length - 1, level))]!;
}

export const BADGES = [
  { code: 'early_adopter', label: '元老', description: '在站点早期加入的用户' },
  { code: 'creator', label: 'UP 主', description: '发布了第一支视频' },
  { code: 'popular', label: '人气之星', description: '有视频获得广泛播放' },
  { code: 'danmaku_star', label: '弹幕之星', description: '发送了大量弹幕' },
  { code: 'commenter', label: '评论家', description: '留下了大量优质评论' },
  { code: 'collector', label: '收藏家', description: '收藏了很多视频' },
  { code: 'level_5', label: 'Lv.5', description: '等级达到 5 级' },
  { code: 'level_6', label: 'Lv.6', description: '等级达到 6 级' },
] as const;
export type BadgeCode = (typeof BADGES)[number]['code'];

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
    logoUrl: '',
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
  region: {
    /** Country used when neither the account nor a country header resolves. */
    fallback: 'CN',
    /** Request header carrying the two-letter country code. */
    header: 'cf-ipcountry',
    /** Optional MaxMind GeoLite2/GeoIP2 country database path. */
    geoipDatabase: '',
  },
  restricted: {
    /** Countries where restricted content may not be published or played. */
    blockedRegions: [] as string[],
    /** `message` explains the region limit, `not_found` hides the video. */
    defaultBehavior: 'message' as 'message' | 'not_found',
    defaultMessage: '该内容在您所在的地区不可用',
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
