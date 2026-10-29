import type { Category, VideoCard } from '@uiliuili/shared';

export interface HomeFeed {
  sections: {
    recommended: { items: VideoCard[]; nextCursor: string | null };
    trending: { items: VideoCard[]; nextCursor: string | null };
    newest: { items: VideoCard[]; nextCursor: string | null };
    continueWatching: { items: VideoCard[] };
  };
  categories: Category[];
  explorationRatio: number;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface SpaceProfile {
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    coverUrl: string | null;
    bio: string;
    level: number;
    experience?: number;
    badges?: Array<{ code: string; label: string; description: string; awardedAt?: string }>;
    createdAt: string;
    roles: string[];
  };
  stats: { videos: number; followers: number; following: number };
  following: boolean;
  blocked?: boolean;
  isSelf: boolean;
}

export interface SearchResponse {
  type: 'videos' | 'users' | 'tags';
  items: unknown[];
  nextCursor?: string | null;
  engine?: string;
}

export interface StudioVideo {
  id: string;
  title: string;
  description: string;
  coverUrl: string | null;
  status: string;
  visibility: string;
  categoryId: string | null;
  durationSeconds: number;
  views: number;
  likes: number;
  coins: number;
  comments: number;
  danmaku: number;
  sourceFilename: string | null;
  sourceSize: number;
  restricted: boolean;
  regionMode: string;
  regionCodes: string[];
  regionDenyBehavior: string;
  regionDenyMessage: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  playlistUrl: string | null;
}

export interface RegionOption {
  code: string;
  name: string;
  nameEn: string;
}

/** Server-resolved region and restricted-content policy for the current request. */
export interface RegionContextInfo {
  region: { code: string; name: string; nameEn: string };
  source: string;
  unrestricted: boolean;
  showRestricted: boolean;
  restrictedAllowed: boolean;
  canUploadRestricted: boolean;
  canManageRegions: boolean;
  blockedRegions: string[];
  defaultBehavior: 'message' | 'not_found';
  defaultMessage: string;
}

export interface FavoriteFolder {
  id: string;
  name: string;
  description?: string;
  isPublic?: boolean;
  isDefault: boolean;
  count: number;
  createdAt: string;
}

export interface FavoritesResponse {
  folders: FavoriteFolder[];
  folderId: string | null;
  items: VideoCard[];
}

export interface WatchLaterResponse {
  items: VideoCard[];
}

export interface FollowGroup {
  id: string;
  name: string;
  sort: number;
  count: number;
  createdAt: string;
}

export interface FollowGroupsResponse {
  groups: FollowGroup[];
  items: Array<{
    user: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
      level: number;
    };
    groupId: string | null;
    followedAt: string;
  }>;
}

export interface StudioPart {
  id: string;
  title: string;
  sort: number;
  status: string;
  durationSeconds: number;
  sourceFilename: string | null;
  sourceSize: number;
  playlistUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudioSubtitle {
  language: string;
  label: string;
  createdAt: string;
}

export interface StudioStats {
  totals: {
    views: number;
    likes: number;
    coins: number;
    favorites: number;
    comments: number;
    danmaku: number;
  };
  daily: Array<{ day: string; views: number }>;
  totalTrackedViews: number;
  completions: number;
  completionRate: number;
  rangeDays: number;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
  actor: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
}
