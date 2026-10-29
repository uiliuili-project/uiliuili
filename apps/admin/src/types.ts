export interface InstallStatus {
  installed: boolean;
  version: string;
  siteUrl?: string;
  instanceId?: string;
  tokenRequired: boolean;
  localhostBypass: boolean;
  running: boolean;
  failed: boolean;
  error?: string;
}

export interface EnvironmentCheck {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  required: boolean;
}

export interface EnvironmentReport {
  ok: boolean;
  checks: EnvironmentCheck[];
  platform: string;
  arch: string;
  nodeVersion: string;
  memoryMb: number;
  diskFreeMb: number;
}

export interface InstallProgressState {
  running: boolean;
  installed: boolean;
  failed: boolean;
  stage: string;
  percent: number;
  message: string;
  error?: string;
  warnings: string[];
  ownerClaimToken?: string;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  roles: string[];
  group: 'USER' | 'CREATOR' | 'REVIEWER' | 'ADMIN' | 'OWNER';
  permissions: string[];
  level: number;
  emailVerified: boolean;
  coinBalance: number;
}

export interface DashboardStats {
  users: number;
  videos: number;
  danmakuToday: number;
  pendingReports: number;
  storageUsed: number;
  queue: Record<string, number>;
  recentUsers: Array<{
    id: string;
    username: string;
    displayName: string;
    createdAt: string;
  }>;
  recentVideos: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
  }>;
  system: {
    version: string;
    node: string;
    database: string;
    ffmpeg: boolean;
    search: string;
    cache: string;
  };
}

export interface AdminCategory {
  id: string;
  slug: string;
  name: string;
  sort: number;
  parentId: string | null;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  roles: string[];
  group: 'USER' | 'CREATOR' | 'REVIEWER' | 'ADMIN' | 'OWNER';
  level: number;
  region: string;
  regionSource: string;
  showRestricted: boolean;
  banned: boolean;
  mutedUntil: string | null;
  coinBalance: number;
  createdAt: string;
}

export interface AdminVideo {
  id: string;
  title: string;
  status: string;
  visibility: string;
  featured: boolean;
  recommendWeight: number;
  restricted: boolean;
  regionMode: string;
  regionCodes: string[];
  regionDenyBehavior: string;
  regionDenyMessage: string;
  views: number;
  likes: number;
  comments: number;
  danmaku: number;
  createdAt: string;
  uploader: { id: string; username: string; displayName: string } | null;
  category: { id: string; name: string } | null;
}

export interface AdminDanmaku {
  id: string;
  content: string;
  videoId: string;
  videoTitle?: string;
  username?: string;
  progressMs: number;
  status: string;
  createdAt: string;
}

export interface AdminComment {
  id: string;
  content: string;
  videoId: string;
  videoTitle?: string;
  username?: string;
  status: string;
  likeCount: number;
  createdAt: string;
}

export interface AdminReport {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  detail: string;
  status: string;
  reporter: string | null;
  createdAt: string;
}

export interface AdminJob {
  id: string;
  queue: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  progress: number;
  lastError: string | null;
  createdAt: string;
  runAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  actor: string | null;
  ipHash: string;
  createdAt: string;
}

export interface AdminSettingsData {
  groups: Record<string, Record<string, unknown>>;
  storage: { driver: string; localPath?: string; s3?: Record<string, unknown> };
  mail: Record<string, unknown> | null;
  search: Record<string, unknown>;
  oauth: Array<{ provider: string; enabled: boolean; config: Record<string, unknown> }>;
}

export interface SystemInfo {
  version: string;
  node: string;
  database: string;
  migrations: number;
  ffmpeg: boolean;
  storage: string;
  mail: boolean;
  search: string;
  cache: string;
  queue: Record<string, number>;
  uptimeSeconds: number;
  platform: string;
  hostname: string;
  memoryUsed: number;
}
