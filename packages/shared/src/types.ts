export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio?: string | null;
  roles: string[];
  level: number;
  banned?: boolean;
  createdAt: string;
}

export interface AuthUser extends PublicUser {
  email: string;
  emailVerified: boolean;
  permissions: string[];
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  sort: number;
  parentId: string | null;
}

export interface VideoCard {
  id: string;
  title: string;
  coverUrl: string | null;
  durationSeconds: number;
  views: number;
  likes: number;
  coins: number;
  favorites: number;
  comments: number;
  publishedAt: string | null;
  createdAt: string;
  category: Category | null;
  uploader: PublicUser;
  tags: string[];
}

export interface VideoDetail extends VideoCard {
  description: string;
  status: string;
  visibility: string;
  featured: boolean;
  playlistUrl: string | null;
  renditions: Array<{
    quality: string;
    width: number;
    height: number;
    bitrate: number;
    playlistUrl: string;
  }>;
  subtitles: Array<{ language: string; label: string; url: string }>;
  liked: boolean;
  coincount: number;
  favorited: boolean;
  following: boolean;
  progressMs: number;
}

export interface DanmakuItem {
  id: string;
  progressMs: number;
  mode: string;
  color: string;
  fontSize: number;
  content: string;
  createdAt: string;
  userHash: string;
  mine?: boolean;
}

export interface CommentItem {
  id: string;
  content: string;
  createdAt: string;
  likeCount: number;
  liked: boolean;
  user: PublicUser;
  replies: CommentItem[];
  replyCount: number;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
  actor: PublicUser | null;
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
  total?: number;
}

export interface SiteSettingsPayload {
  site: Record<string, unknown>;
  upload: Record<string, unknown>;
  playback: Record<string, unknown>;
  danmaku: Record<string, unknown>;
  social: Record<string, unknown>;
  recommendation: Record<string, unknown>;
  mail: Record<string, unknown>;
  security: Record<string, unknown>;
  auth?: Record<string, unknown>;
}
