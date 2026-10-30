/** Display name. Internal package, repository and CLI identifiers stay `uiliuili`. */
export const APP_NAME = '萌悠';
export const APP_NAME_EN = 'MoeYou';
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

/** How the uploader declares the origin of a video. */
export const VIDEO_CONTENT_TYPES = ['original', 'repost', 'ai'] as const;
export type VideoContentType = (typeof VIDEO_CONTENT_TYPES)[number];

export const VIDEO_APPEAL_STATUSES = ['pending', 'accepted', 'rejected'] as const;
export type VideoAppealStatus = (typeof VIDEO_APPEAL_STATUSES)[number];

export const VIDEO_APPEAL_REASONS = ['mistake', 'copyright', 'context', 'other'] as const;
export type VideoAppealReason = (typeof VIDEO_APPEAL_REASONS)[number];

export const ARTICLE_STATUSES = [
  'draft',
  'pending_review',
  'published',
  'blocked',
  'deleted',
] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

export const COLLABORATOR_ROLES = ['coauthor', 'assistant'] as const;
export type CollaboratorRole = (typeof COLLABORATOR_ROLES)[number];

export const COLLABORATOR_STATUSES = ['pending', 'accepted', 'rejected'] as const;
export type CollaboratorStatus = (typeof COLLABORATOR_STATUSES)[number];

/** Acquisition channels captured for anonymous aggregate analytics. */
export const WATCH_SOURCES = [
  'direct',
  'home',
  'search',
  'feed',
  'related',
  'space',
  'collection',
  'topic',
  'ranking',
  'notification',
  'external',
  'unknown',
] as const;
export type WatchSource = (typeof WATCH_SOURCES)[number];

export const WATCH_DEVICES = ['desktop', 'mobile', 'tablet', 'tv', 'bot', 'unknown'] as const;
export type WatchDevice = (typeof WATCH_DEVICES)[number];

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
  'collaboration',
  'appeal',
  'article',
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

export const CAPTCHA_PROVIDERS = ['turnstile', 'recaptcha_v2', 'recaptcha_v3'] as const;
export type CaptchaProvider = (typeof CAPTCHA_PROVIDERS)[number];

/** Actions that may require a human verification challenge. */
export const CAPTCHA_ACTIONS = [
  'register',
  'login',
  'comment',
  'dynamic',
  'upload',
  'image',
  'danmaku',
  'forgotPassword',
] as const;
export type CaptchaAction = (typeof CAPTCHA_ACTIONS)[number];

export const RATE_LIMIT_ACTIONS = [...CAPTCHA_ACTIONS, 'cover'] as const;
export type RateLimitAction = (typeof RATE_LIMIT_ACTIONS)[number];

export const MODERATION_TARGETS = ['comment', 'dynamic'] as const;
export type ModerationTarget = (typeof MODERATION_TARGETS)[number];

export const MODERATION_ACTIONS = ['reject', 'pending', 'flag'] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export const MODERATION_FAIL_MODES = ['open', 'closed'] as const;
export type ModerationFailMode = (typeof MODERATION_FAIL_MODES)[number];

export const NAV_VISIBILITIES = ['all', 'guest', 'user', 'staff'] as const;
export type NavVisibility = (typeof NAV_VISIBILITIES)[number];

/** Icon keys accepted by the navigation editor and rendered by the public site. */
export const NAV_ICONS = [
  'link',
  'home',
  'video',
  'star',
  'heart',
  'book',
  'users',
  'info',
  'music',
  'game',
  'download',
  'external',
] as const;
export type NavIcon = (typeof NAV_ICONS)[number];

export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon: NavIcon;
  newTab: boolean;
  visibility: NavVisibility;
  enabled: boolean;
  highlight: boolean;
  sort: number;
}

/**
 * Built-in moderation prompt. Administrators can replace it, but the default
 * references Chinese content law so a fresh installation is usable.
 */
export const DEFAULT_MODERATION_PROMPT = `你是「萌悠」的内容审核助手。请依据《中华人民共和国网络安全法》《网络信息内容生态治理规定》等法律法规，判断用户内容是否包含违法、色情、暴力、仇恨、诈骗、广告引流、侵犯隐私等内容。不要因观点不同判违规。只输出 JSON：{"allowed":true|false,"reason":"简短理由","categories":["..."]}`;

export const DEFAULT_TERMS_HTML = `<h2>用户协议</h2>
<p>欢迎使用萌悠。注册或继续使用本站，即表示你同意遵守本协议及适用法律法规。</p>
<h3>一、账号</h3>
<p>你应妥善保管账号与密码，对账号下的行为负责。不得冒用他人身份，不得批量注册或出租、出售账号。</p>
<h3>二、内容规范</h3>
<p>你不得发布违法、色情、暴力、仇恨、诈骗、侵权或广告引流内容。本站有权对违规内容进行隐藏、删除，并视情节限制或封禁账号。</p>
<h3>三、知识产权</h3>
<p>你应确保上传内容拥有合法权利。你授予本站展示、存储和分发该内容所必需的许可。</p>
<h3>四、免责声明</h3>
<p>本站按现状提供服务，不对服务中断或内容准确性作出保证。因不可抗力或第三方原因造成的损失，本站不承担责任。</p>
<h3>五、协议变更</h3>
<p>本站可能更新本协议，更新后在页面公布即生效。继续使用即视为接受更新后的协议。</p>`;

export const DEFAULT_PRIVACY_HTML = `<h2>隐私政策</h2>
<p>我们重视你的隐私。本政策说明萌悠收集哪些信息以及如何使用。</p>
<h3>一、收集的信息</h3>
<p>账号信息（用户名、邮箱、密码哈希）、你发布的内容、互动记录，以及为安全与地区合规所需的网络地区信息。</p>
<h3>二、使用方式</h3>
<p>用于提供登录、内容展示、互动、安全审核和服务改进。我们不会出售你的个人信息。</p>
<h3>三、Cookie</h3>
<p>我们使用必要的 Cookie 维持登录状态和 CSRF 防护。启用统计服务时可能使用分析 Cookie。</p>
<h3>四、你的权利</h3>
<p>你可以查看和修改个人资料，或联系站长申请删除账号及相关数据。</p>`;

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
    /** Personalised boost from tags of recently watched videos. */
    tagAffinity: {
      enabled: true,
      weight: 0.6,
      ratio: 0.35,
      decayPerDay: 0.95,
      maxTags: 8,
    },
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
    /**
     * Optional header carrying a subdivision code, used only to show a
     * province for mainland China. Leave empty to rely on the GeoIP database.
     */
    provinceHeader: '',
    /** Optional MaxMind GeoLite2/GeoIP2 database path. */
    geoipDatabase: '',
  },
  restricted: {
    /** Countries where restricted content may not be published or played. */
    blockedRegions: [] as string[],
    /** `message` explains the region limit, `not_found` hides the video. */
    defaultBehavior: 'message' as 'message' | 'not_found',
    defaultMessage: '该内容在您所在的地区不可用',
  },
  privacy: {
    /** Show and store the network country (IP location) on user content. */
    ipLocation: true,
  },
  branding: {
    /** Show the site name next to the logo in the header. */
    showName: true,
    countryBadge: {
      enabled: true,
      /** Show the country name next to the code in the tooltip. */
      showName: true,
      /** Hide the badge from signed-out visitors. */
      hideForGuests: false,
      /** Only render when the country came from a proxy header or GeoIP. */
      trustedOnly: true,
      /** Countries that must never show a badge. */
      blockedCountries: [] as string[],
    },
  },
  navigation: {
    header: [] as NavigationItem[],
    footer: [] as NavigationItem[],
  },
  customCode: {
    headerEnabled: false,
    headerHtml: '',
    footerEnabled: false,
    footerHtml: '',
  },
  analytics: {
    enabled: false,
    measurementId: '',
    anonymizeIp: true,
    trackAdmin: false,
    respectDnt: true,
  },
  legal: {
    termsHtml: DEFAULT_TERMS_HTML,
    privacyHtml: DEFAULT_PRIVACY_HTML,
    termsVersion: '1',
    requireConsent: true,
  },
  captcha: {
    enabled: false,
    provider: 'turnstile' as CaptchaProvider,
    siteKey: '',
    minScore: 0.5,
    /** Require verification on every request, regardless of rate limits. */
    always: {
      register: true,
      login: false,
      comment: false,
      dynamic: false,
      upload: false,
      image: false,
      danmaku: false,
      forgotPassword: true,
    } as Record<CaptchaAction, boolean>,
    /** Staff accounts bypass human verification. */
    skipStaff: true,
  },
  rateLimit: {
    enabled: true,
    /** Minutes a successful captcha grants a pass for this user or IP. */
    passMinutes: 15,
    actions: {
      register: { windowSeconds: 300, soft: 0, hard: 5 },
      login: { windowSeconds: 60, soft: 4, hard: 10 },
      comment: { windowSeconds: 60, soft: 3, hard: 8 },
      dynamic: { windowSeconds: 300, soft: 3, hard: 10 },
      upload: { windowSeconds: 3600, soft: 2, hard: 5 },
      image: { windowSeconds: 3600, soft: 20, hard: 60 },
      danmaku: { windowSeconds: 10, soft: 3, hard: 10 },
      forgotPassword: { windowSeconds: 3600, soft: 0, hard: 5 },
      cover: { windowSeconds: 3600, soft: 10, hard: 20 },
    } as Record<RateLimitAction, { windowSeconds: number; soft: number; hard: number }>,
  },
  aiModeration: {
    enabled: false,
    targets: { comment: true, dynamic: true } as Record<ModerationTarget, boolean>,
    action: 'pending' as ModerationAction,
    failMode: 'open' as ModerationFailMode,
    timeoutMs: 6000,
    maxChars: 4000,
    cacheMinutes: 10,
    prompt: DEFAULT_MODERATION_PROMPT,
  },
  review: {
    /** Site-wide manual review. `pending` content stays hidden until approved. */
    comments: false,
    dynamics: false,
    articles: false,
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
