import type { UserGroup } from './constants';

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio?: string | null;
  roles: string[];
  level: number;
  experience?: number;
  badges?: UserBadge[];
  banned?: boolean;
  createdAt: string;
}

export interface UserBadge {
  code: string;
  label: string;
  description: string;
  awardedAt?: string;
}

export interface AuthUser extends PublicUser {
  email: string;
  emailVerified: boolean;
  permissions: string[];
  /** Persisted user-group marker, kept in sync with the user's roles. */
  group: UserGroup;
  /** Country (ISO 3166-1 alpha-2) resolved at registration, never user-editable. */
  region: string;
  /** Whether the user opted in to restricted content in unrestricted regions. */
  showRestricted: boolean;
  /** Personal space header image, uploaded by the user. */
  coverUrl?: string | null;
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
  danmaku: number;
  publishedAt: string | null;
  createdAt: string;
  category: Category | null;
  uploader: PublicUser;
  tags: string[];
  /** Restricted content is only shown to opted-in users in unrestricted regions. */
  restricted?: boolean;
  /** Creation declaration: original, repost or ai. */
  contentType?: string;
  aiGenerated?: boolean;
}

export interface VideoDetail extends VideoCard {
  description: string;
  status: string;
  visibility: string;
  featured: boolean;
  restricted: boolean;
  sourceUrl?: string;
  allowComments?: boolean;
  allowDanmaku?: boolean;
  collaborators?: Array<{
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    role: string;
  }>;
  regionMode: string;
  regionCodes: string[];
  regionDenyBehavior: string;
  regionDenyMessage: string;
  playlistUrl: string | null;
  renditions: Array<{
    quality: string;
    width: number;
    height: number;
    bitrate: number;
    playlistUrl: string;
  }>;
  subtitles: Array<{ language: string; label: string; url: string }>;
  parts: VideoPart[];
  collections: CollectionSummary[];
  liked: boolean;
  coinCount: number;
  favorited: boolean;
  following: boolean;
  watchLater: boolean;
  progressMs: number;
  progressPartId: string | null;
}

export interface VideoPart {
  id: string | null;
  title: string;
  sort: number;
  durationSeconds: number;
  status: string;
  playlistUrl: string | null;
}

export interface DynamicItem {
  id: string;
  content: string;
  images: string[];
  createdAt: string;
  likeCount: number;
  liked: boolean;
  /** Network country captured when the post was published. */
  ipRegion: string | null;
  /** visible, pending, hidden or deleted. */
  status?: string;
  moderationReason?: string | null;
  user: PublicUser;
  video: VideoCard | null;
  topic: TopicInfo | null;
}

/** Tag affinity learned from the signed-in user's recent watch history. */
export interface TagInterest {
  tagId: string;
  name: string;
  slug: string;
  score: number;
  lastSeenAt: string;
}

export interface TopicInfo {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverUrl: string | null;
  kind: string;
  startsAt: string | null;
  endsAt: string | null;
  dynamicCount?: number;
}

export interface ConversationItem {
  id: string;
  user: PublicUser;
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
}

export interface DirectMessageItem {
  id: string;
  content: string;
  mine: boolean;
  readAt: string | null;
  createdAt: string;
  sender: PublicUser;
}

export interface RankingItem {
  video: VideoCard;
  score: number;
  periodViews: number;
  rank?: number;
}

export interface CollectionSummary {
  id: string;
  title: string;
  kind: string;
  coverUrl: string | null;
  itemCount: number;
}

export interface CollectionInfo extends CollectionSummary {
  description: string;
  visibility: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  owner: PublicUser;
}

export interface CollectionDetail extends CollectionInfo {
  items: VideoCard[];
}

export interface PlaylistItem {
  id: string;
  title: string;
  coverUrl: string | null;
  durationSeconds: number;
  uploader: PublicUser;
}

export interface DanmakuItem {
  id: string;
  progressMs: number;
  partId?: string | null;
  pool?: string;
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
  pinned: boolean;
  upLiked: boolean;
  isUploader: boolean;
  /** Network country captured when the comment was published. */
  ipRegion: string | null;
  /** visible, pending, hidden or deleted. */
  status?: string;
  moderationReason?: string | null;
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
  region?: Record<string, unknown>;
  restricted?: Record<string, unknown>;
  auth?: Record<string, unknown>;
}
