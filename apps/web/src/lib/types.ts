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
    createdAt: string;
    roles: string[];
  };
  stats: { videos: number; followers: number; following: number };
  following: boolean;
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
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  playlistUrl: string | null;
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
