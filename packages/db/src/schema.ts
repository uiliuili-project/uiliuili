import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const appSchema = pgSchema('uiliuili');

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
};

export const appInstance = appSchema.table('app_instance', {
  id: uuid('id').defaultRandom().primaryKey(),
  instanceId: text('instance_id').notNull().unique(),
  version: text('version').notNull(),
  schemaVersion: integer('schema_version').notNull().default(1),
  installedAt: timestamp('installed_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const users = appSchema.table(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    username: text('username').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash'),
    displayName: text('display_name').notNull(),
    bio: text('bio').default('').notNull(),
    avatarUrl: text('avatar_url'),
    coverUrl: text('cover_url'),
    emailVerified: boolean('email_verified').default(false).notNull(),
    roles: text('roles').array().default(sql`ARRAY['USER']::text[]`).notNull(),
    userGroup: text('user_group').default('USER').notNull(),
    level: integer('level').default(0).notNull(),
    experience: integer('experience').default(0).notNull(),
    banned: boolean('banned').default(false).notNull(),
    mutedUntil: timestamp('muted_until', { withTimezone: true }),
    coinBalance: integer('coin_balance').default(0).notNull(),
    /** Country snapshot resolved automatically at registration. */
    region: text('region').default('').notNull(),
    regionSource: text('region_source').default('').notNull(),
    /** Personal preference for showing restricted content in unrestricted regions. */
    showRestricted: boolean('show_restricted').default(false).notNull(),
    /** Most recent network country resolved for the account, shown as IP location. */
    lastRegion: text('last_region'),
    lastRegionAt: timestamp('last_region_at', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    /** When the current user agreement version was accepted. */
    termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }),
    termsVersion: text('terms_version').default('').notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('users_username_lower_idx').on(sql`lower(${table.username})`),
    uniqueIndex('users_email_lower_idx').on(sql`lower(${table.email})`),
    index('users_created_at_idx').on(table.createdAt),
    index('users_group_idx').on(table.userGroup),
    uniqueIndex('users_single_owner_idx')
      .on(table.userGroup)
      .where(sql`${table.userGroup} = 'OWNER'`),
  ],
);

export const refreshSessions = appSchema.table(
  'refresh_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    userAgent: text('user_agent').default('').notNull(),
    ipHash: text('ip_hash').default('').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('refresh_sessions_user_idx').on(table.userId)],
);

export const oauthAccounts = appSchema.table(
  'oauth_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    email: text('email'),
    avatarUrl: text('avatar_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('oauth_accounts_provider_uid_idx').on(table.provider, table.providerAccountId),
    index('oauth_accounts_user_idx').on(table.userId),
  ],
);

export const authProviders = appSchema.table('auth_providers', {
  provider: text('provider').primaryKey(),
  enabled: boolean('enabled').default(false).notNull(),
  configEncrypted: text('config_encrypted').default('').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const verificationTokens = appSchema.table(
  'verification_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('verification_tokens_user_type_idx').on(table.userId, table.type)],
);

export const followGroups = appSchema.table(
  'follow_groups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sort: integer('sort').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('follow_groups_user_name_idx').on(table.userId, table.name)],
);

export const follows = appSchema.table(
  'follows',
  {
    followerId: uuid('follower_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    followingId: uuid('following_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id').references(() => followGroups.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.followerId, table.followingId] }),
    index('follows_following_idx').on(table.followingId),
    index('follows_group_idx').on(table.groupId),
  ],
);

export const userBadges = appSchema.table(
  'user_badges',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    awardedAt: timestamp('awarded_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.code] })],
);

export const blocks = appSchema.table(
  'blocks',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blockedUserId: uuid('blocked_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.blockedUserId] })],
);

export const categories = appSchema.table(
  'categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    description: text('description').default('').notNull(),
    /** Icon key rendered by the public site; empty falls back to a letter tile. */
    icon: text('icon').default('').notNull(),
    visible: boolean('visible').default(true).notNull(),
    sort: integer('sort').default(0).notNull(),
    parentId: uuid('parent_id'),
    ...timestamps,
  },
  (table) => [index('categories_sort_idx').on(table.sort)],
);

export const tags = appSchema.table('tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const videos = appSchema.table(
  'videos',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    uploaderId: uuid('uploader_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    description: text('description').default('').notNull(),
    coverUrl: text('cover_url'),
    status: text('status').default('draft').notNull(),
    visibility: text('visibility').default('public').notNull(),
    durationSeconds: integer('duration_seconds').default(0).notNull(),
    width: integer('width').default(0).notNull(),
    height: integer('height').default(0).notNull(),
    sourceKey: text('source_key'),
    sourceSize: integer('source_size').default(0).notNull(),
    sourceFilename: text('source_filename'),
    playlistKey: text('playlist_key'),
    spriteKey: text('sprite_key'),
    previewVttKey: text('preview_vtt_key'),
    featured: boolean('featured').default(false).notNull(),
    recommendWeight: integer('recommend_weight').default(0).notNull(),
    blockReason: text('block_reason'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    viewCount: integer('view_count').default(0).notNull(),
    likeCount: integer('like_count').default(0).notNull(),
    coinCount: integer('coin_count').default(0).notNull(),
    favoriteCount: integer('favorite_count').default(0).notNull(),
    commentCount: integer('comment_count').default(0).notNull(),
    danmakuCount: integer('danmaku_count').default(0).notNull(),
    completionRate: real('completion_rate').default(0).notNull(),
    /** Restricted content may only be published/played in unrestricted regions. */
    restricted: boolean('restricted').default(false).notNull(),
    regionMode: text('region_mode').default('inherit').notNull(),
    regionCodes: text('region_codes').array().default(sql`ARRAY[]::text[]`).notNull(),
    regionDenyBehavior: text('region_deny_behavior').default('default').notNull(),
    regionDenyMessage: text('region_deny_message').default('').notNull(),
    /** Creation declaration: original, repost or ai. */
    contentType: text('content_type').default('original').notNull(),
    /** Original source when the declaration is a repost. */
    sourceUrl: text('source_url').default('').notNull(),
    aiGenerated: boolean('ai_generated').default(false).notNull(),
    allowComments: boolean('allow_comments').default(true).notNull(),
    allowDanmaku: boolean('allow_danmaku').default(true).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('videos_status_published_idx').on(table.status, table.publishedAt),
    index('videos_uploader_idx').on(table.uploaderId),
    index('videos_category_idx').on(table.categoryId, table.status),
    index('videos_featured_idx').on(table.featured),
  ],
);

export const videoParts = appSchema.table(
  'video_parts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    title: text('title').default('正片').notNull(),
    sort: integer('sort').default(0).notNull(),
    status: text('status').default('draft').notNull(),
    sourceKey: text('source_key'),
    sourceSize: integer('source_size').default(0).notNull(),
    sourceFilename: text('source_filename'),
    durationSeconds: integer('duration_seconds').default(0).notNull(),
    width: integer('width').default(0).notNull(),
    height: integer('height').default(0).notNull(),
    playlistKey: text('playlist_key'),
    spriteKey: text('sprite_key'),
    previewVttKey: text('preview_vtt_key'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('video_parts_video_sort_idx').on(table.videoId, table.sort),
    index('video_parts_status_idx').on(table.status),
  ],
);

export const collections = appSchema.table(
  'collections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').default('').notNull(),
    coverUrl: text('cover_url'),
    kind: text('kind').default('collection').notNull(),
    visibility: text('visibility').default('public').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('collections_user_idx').on(table.userId, table.createdAt),
    index('collections_visibility_idx').on(table.visibility, table.createdAt),
  ],
);

export const collectionItems = appSchema.table(
  'collection_items',
  {
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    sort: integer('sort').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.collectionId, table.videoId] }),
    index('collection_items_sort_idx').on(table.collectionId, table.sort),
  ],
);

export const watchLater = appSchema.table(
  'watch_later',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.videoId] }),
    index('watch_later_user_idx').on(table.userId, table.createdAt),
  ],
);

export const topics = appSchema.table(
  'topics',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    description: text('description').default('').notNull(),
    coverUrl: text('cover_url'),
    kind: text('kind').default('topic').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('topics_kind_idx').on(table.kind, table.createdAt)],
);

export const dynamics = appSchema.table(
  'dynamics',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').default('').notNull(),
    images: jsonb('images').$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    videoId: uuid('video_id').references(() => videos.id, { onDelete: 'set null' }),
    topicId: uuid('topic_id').references(() => topics.id, { onDelete: 'set null' }),
    visibility: text('visibility').default('public').notNull(),
    /** Moderation state: visible, pending, hidden or deleted. */
    status: text('status').default('visible').notNull(),
    /** AI or manual moderation verdict details. */
    moderation: jsonb('moderation').$type<Record<string, unknown> | null>(),
    /** Country code captured when the post was published. */
    ipRegion: text('ip_region'),
    likeCount: integer('like_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('dynamics_created_idx').on(table.createdAt),
    index('dynamics_user_idx').on(table.userId, table.createdAt),
    index('dynamics_topic_idx').on(table.topicId, table.createdAt),
    index('dynamics_status_created_idx').on(table.status, table.createdAt),
  ],
);

export const dynamicLikes = appSchema.table(
  'dynamic_likes',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    dynamicId: uuid('dynamic_id')
      .notNull()
      .references(() => dynamics.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.dynamicId] })],
);

export const videoTopics = appSchema.table(
  'video_topics',
  {
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    topicId: uuid('topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.videoId, table.topicId] })],
);

export const conversations = appSchema.table(
  'conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userAId: uuid('user_a_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userBId: uuid('user_b_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('conversations_pair_idx').on(table.userAId, table.userBId),
    index('conversations_last_idx').on(table.lastMessageAt),
  ],
);

export const directMessages = appSchema.table(
  'direct_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('direct_messages_conversation_idx').on(table.conversationId, table.createdAt)],
);

export const pushSubscriptions = appSchema.table(
  'push_subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('push_subscriptions_user_idx').on(table.userId)],
);

export const videoTags = appSchema.table(
  'video_tags',
  {
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.videoId, table.tagId] }),
    index('video_tags_tag_idx').on(table.tagId),
  ],
);

export const videoRenditions = appSchema.table(
  'video_renditions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    partId: uuid('part_id').references(() => videoParts.id, { onDelete: 'cascade' }),
    quality: text('quality').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    bitrate: integer('bitrate').notNull(),
    playlistKey: text('playlist_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('video_renditions_video_quality_idx').on(table.videoId, table.partId, table.quality),
  ],
);

export const videoSubtitles = appSchema.table(
  'video_subtitles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    language: text('language').notNull(),
    label: text('label').notNull(),
    storageKey: text('storage_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('video_subtitles_video_lang_idx').on(table.videoId, table.language)],
);

export const uploadSessions = appSchema.table(
  'upload_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    partId: uuid('part_id').references(() => videoParts.id, { onDelete: 'cascade' }),
    filename: text('filename').notNull(),
    size: integer('size').notNull(),
    contentType: text('content_type').notNull(),
    storageDriver: text('storage_driver').notNull(),
    storageKey: text('storage_key').notNull(),
    s3UploadId: text('s3_upload_id'),
    chunkSize: integer('chunk_size').notNull(),
    totalChunks: integer('total_chunks').notNull(),
    uploadedChunks: integer('uploaded_chunks').default(0).notNull(),
    status: text('status').default('uploading').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [index('upload_sessions_user_idx').on(table.userId, table.status)],
);

export const uploadParts = appSchema.table(
  'upload_parts',
  {
    uploadSessionId: uuid('upload_session_id')
      .notNull()
      .references(() => uploadSessions.id, { onDelete: 'cascade' }),
    partNumber: integer('part_number').notNull(),
    size: integer('size').default(0).notNull(),
    etag: text('etag'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.uploadSessionId, table.partNumber] })],
);

export const danmaku = appSchema.table(
  'danmaku',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    progressMs: integer('progress_ms').notNull(),
    segment: integer('segment').notNull(),
    partId: uuid('part_id').references(() => videoParts.id, { onDelete: 'cascade' }),
    pool: text('pool').default('normal').notNull(),
    mode: text('mode').default('scroll').notNull(),
    color: text('color').default('#ffffff').notNull(),
    fontSize: integer('font_size').default(25).notNull(),
    content: text('content').notNull(),
    status: text('status').default('visible').notNull(),
    ipHash: text('ip_hash').default('').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('danmaku_video_segment_idx').on(table.videoId, table.segment, table.progressMs),
    index('danmaku_part_segment_idx').on(table.partId, table.segment, table.progressMs),
    index('danmaku_status_idx').on(table.status),
    index('danmaku_user_idx').on(table.userId, table.createdAt),
  ],
);

export const comments = appSchema.table(
  'comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),
    content: text('content').notNull(),
    /** Country code captured when the comment was published. */
    ipRegion: text('ip_region'),
    /** AI or manual moderation verdict details. */
    moderation: jsonb('moderation').$type<Record<string, unknown> | null>(),
    likeCount: integer('like_count').default(0).notNull(),
    pinned: boolean('pinned').default(false).notNull(),
    pinnedAt: timestamp('pinned_at', { withTimezone: true }),
    upLiked: boolean('up_liked').default(false).notNull(),
    status: text('status').default('visible').notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('comments_video_idx').on(table.videoId, table.status, table.createdAt),
    index('comments_parent_idx').on(table.parentId),
  ],
);

export const commentLikes = appSchema.table(
  'comment_likes',
  {
    commentId: uuid('comment_id')
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.commentId, table.userId] })],
);

export const videoLikes = appSchema.table(
  'video_likes',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.videoId] })],
);

export const videoCoins = appSchema.table(
  'video_coins',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    amount: integer('amount').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.videoId] })],
);

export const coinLedger = appSchema.table(
  'coin_ledger',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(),
    reason: text('reason').notNull(),
    videoId: uuid('video_id').references(() => videos.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('coin_ledger_user_idx').on(table.userId, table.createdAt)],
);

export const favoriteFolders = appSchema.table(
  'favorite_folders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').default('').notNull(),
    isPublic: boolean('is_public').default(false).notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('favorite_folders_user_idx').on(table.userId)],
);

export const favoriteItems = appSchema.table(
  'favorite_items',
  {
    folderId: uuid('folder_id')
      .notNull()
      .references(() => favoriteFolders.id, { onDelete: 'cascade' }),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.folderId, table.videoId] })],
);

export const watchHistories = appSchema.table(
  'watch_histories',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    partId: uuid('part_id').references(() => videoParts.id, { onDelete: 'set null' }),
    positionMs: integer('position_ms').default(0).notNull(),
    durationMs: integer('duration_ms').default(0).notNull(),
    completed: boolean('completed').default(false).notNull(),
    /** Last time this watch updated the user's tag interests. */
    tagSyncedAt: timestamp('tag_synced_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.videoId] }),
    index('watch_histories_user_idx').on(table.userId, table.updatedAt),
  ],
);

/**
 * Decayed tag affinity learned from recent watch history. Only stored for the
 * owning user and never exposed on public profiles.
 */
export const userTagInterests = appSchema.table(
  'user_tag_interests',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    score: real('score').default(0).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.tagId] }),
    index('user_tag_interests_score_idx').on(table.userId, table.score),
  ],
);

export const watchEvents = appSchema.table(
  'watch_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    partId: uuid('part_id').references(() => videoParts.id, { onDelete: 'set null' }),
    positionMs: integer('position_ms').default(0).notNull(),
    durationMs: integer('duration_ms').default(0).notNull(),
    eventType: text('event_type').default('progress').notNull(),
    /** Anonymised acquisition channel, device class and country code. */
    source: text('source').default('direct').notNull(),
    device: text('device').default('unknown').notNull(),
    country: text('country').default('').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('watch_events_video_idx').on(table.videoId, table.createdAt),
    index('watch_events_created_idx').on(table.createdAt),
  ],
);

export const notifications = appSchema.table(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').default('').notNull(),
    link: text('link'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('notifications_user_idx').on(table.userId, table.createdAt)],
);

export const reports = appSchema.table(
  'reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reporterId: uuid('reporter_id').references(() => users.id, { onDelete: 'set null' }),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    reason: text('reason').notNull(),
    detail: text('detail').default('').notNull(),
    status: text('status').default('open').notNull(),
    handledBy: uuid('handled_by').references(() => users.id, { onDelete: 'set null' }),
    handledAt: timestamp('handled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('reports_status_idx').on(table.status, table.createdAt)],
);

export const userFeedbacks = appSchema.table(
  'user_feedbacks',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    action: text('action').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.videoId, table.action] })],
);

export const searchQueries = appSchema.table(
  'search_queries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    query: text('query').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('search_queries_created_idx').on(table.createdAt)],
);

export const videoSimilarities = appSchema.table(
  'video_similarities',
  {
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    relatedVideoId: uuid('related_video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    score: real('score').default(0).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.videoId, table.relatedVideoId] })],
);

export const siteSettings = appSchema.table('site_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  isSecret: boolean('is_secret').default(false).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const announcements = appSchema.table(
  'announcements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    active: boolean('active').default(true).notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('announcements_active_idx').on(table.active, table.createdAt)],
);

export const aiModerationLogs = appSchema.table(
  'ai_moderation_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').default('').notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    excerpt: text('excerpt').default('').notNull(),
    allowed: boolean('allowed').notNull(),
    /** reject, pending, flag, allow. */
    decision: text('decision').notNull(),
    reason: text('reason').default('').notNull(),
    categories: jsonb('categories').$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    model: text('model').default('').notNull(),
    latencyMs: integer('latency_ms').default(0).notNull(),
    cached: boolean('cached').default(false).notNull(),
    error: text('error').default('').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('ai_moderation_logs_created_idx').on(table.createdAt),
    index('ai_moderation_logs_target_idx').on(table.targetType, table.decision),
  ],
);

export const auditLogs = appSchema.table(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    targetType: text('target_type').default('').notNull(),
    targetId: text('target_id').default('').notNull(),
    ipHash: text('ip_hash').default('').notNull(),
    userAgent: text('user_agent').default('').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('audit_logs_created_idx').on(table.createdAt)],
);

export const backgroundJobs = appSchema.table(
  'background_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    queue: text('queue').notNull(),
    payload: jsonb('payload').notNull(),
    status: text('status').default('created').notNull(),
    priority: integer('priority').default(0).notNull(),
    runAt: timestamp('run_at', { withTimezone: true }).defaultNow().notNull(),
    attempts: integer('attempts').default(0).notNull(),
    maxAttempts: integer('max_attempts').default(3).notNull(),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lockedBy: text('locked_by'),
    lastError: text('last_error'),
    progress: integer('progress').default(0).notNull(),
    result: jsonb('result'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    idempotencyKey: text('idempotency_key'),
  },
  (table) => [
    index('background_jobs_claim_idx').on(table.status, table.runAt, table.priority),
    index('background_jobs_queue_idx').on(table.queue, table.status),
    uniqueIndex('background_jobs_idempotency_idx').on(table.idempotencyKey),
  ],
);

export const videoStatusLogs = appSchema.table(
  'video_status_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    fromStatus: text('from_status').default('').notNull(),
    toStatus: text('to_status').notNull(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    reason: text('reason').default('').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('video_status_logs_video_created_idx').on(table.videoId, table.createdAt)],
);

export const videoAppeals = appSchema.table(
  'video_appeals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reason: text('reason').notNull(),
    detail: text('detail').default('').notNull(),
    status: text('status').default('pending').notNull(),
    handledBy: uuid('handled_by').references(() => users.id, { onDelete: 'set null' }),
    handleNote: text('handle_note').default('').notNull(),
    handledAt: timestamp('handled_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('video_appeals_video_idx').on(table.videoId, table.createdAt),
    index('video_appeals_status_idx').on(table.status, table.createdAt),
  ],
);

export const videoDailyStats = appSchema.table(
  'video_daily_stats',
  {
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),
    views: integer('views').default(0).notNull(),
    uniqueViewers: integer('unique_viewers').default(0).notNull(),
    completions: integer('completions').default(0).notNull(),
    likes: integer('likes').default(0).notNull(),
    coins: integer('coins').default(0).notNull(),
    favorites: integer('favorites').default(0).notNull(),
    comments: integer('comments').default(0).notNull(),
    danmaku: integer('danmaku').default(0).notNull(),
    sources: jsonb('sources').$type<Record<string, number>>().default(sql`'{}'::jsonb`).notNull(),
    devices: jsonb('devices').$type<Record<string, number>>().default(sql`'{}'::jsonb`).notNull(),
    countries: jsonb('countries')
      .$type<Record<string, number>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.videoId, table.day] }),
    index('video_daily_stats_day_idx').on(table.day),
  ],
);

export const creatorDailyStats = appSchema.table(
  'creator_daily_stats',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),
    views: integer('views').default(0).notNull(),
    uniqueViewers: integer('unique_viewers').default(0).notNull(),
    completions: integer('completions').default(0).notNull(),
    likes: integer('likes').default(0).notNull(),
    coins: integer('coins').default(0).notNull(),
    favorites: integer('favorites').default(0).notNull(),
    comments: integer('comments').default(0).notNull(),
    danmaku: integer('danmaku').default(0).notNull(),
    followersGained: integer('followers_gained').default(0).notNull(),
    followersLost: integer('followers_lost').default(0).notNull(),
    newVideos: integer('new_videos').default(0).notNull(),
    sources: jsonb('sources').$type<Record<string, number>>().default(sql`'{}'::jsonb`).notNull(),
    devices: jsonb('devices').$type<Record<string, number>>().default(sql`'{}'::jsonb`).notNull(),
    countries: jsonb('countries')
      .$type<Record<string, number>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.day] }),
    index('creator_daily_stats_day_idx').on(table.day),
  ],
);

export const followEvents = appSchema.table(
  'follow_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    followerId: uuid('follower_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    followingId: uuid('following_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('follow_events_following_created_idx').on(table.followingId, table.createdAt),
    index('follow_events_follower_created_idx').on(table.followerId, table.createdAt),
  ],
);

export const articles = appSchema.table(
  'articles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    summary: text('summary').default('').notNull(),
    content: text('content').default('').notNull(),
    coverUrl: text('cover_url'),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    status: text('status').default('draft').notNull(),
    visibility: text('visibility').default('public').notNull(),
    allowComments: boolean('allow_comments').default(true).notNull(),
    viewCount: integer('view_count').default(0).notNull(),
    likeCount: integer('like_count').default(0).notNull(),
    favoriteCount: integer('favorite_count').default(0).notNull(),
    commentCount: integer('comment_count').default(0).notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('articles_author_idx').on(table.authorId, table.createdAt),
    index('articles_status_published_idx').on(table.status, table.publishedAt),
    index('articles_category_idx').on(table.categoryId, table.status),
  ],
);

export const articleLikes = appSchema.table(
  'article_likes',
  {
    articleId: uuid('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.articleId, table.userId] })],
);

export const articleFavorites = appSchema.table(
  'article_favorites',
  {
    articleId: uuid('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.articleId, table.userId] })],
);

export const articleComments = appSchema.table(
  'article_comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    articleId: uuid('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),
    content: text('content').notNull(),
    ipRegion: text('ip_region'),
    status: text('status').default('visible').notNull(),
    likeCount: integer('like_count').default(0).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('article_comments_article_idx').on(table.articleId, table.status, table.createdAt),
    index('article_comments_parent_idx').on(table.parentId),
  ],
);

export const videoCollaborators = appSchema.table(
  'video_collaborators',
  {
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').default('collaborator').notNull(),
    status: text('status').default('pending').notNull(),
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.videoId, table.userId] }),
    index('video_collaborators_user_status_idx').on(table.userId, table.status),
  ],
);

export type DbUser = typeof users.$inferSelect;
export type DbArticle = typeof articles.$inferSelect;
export type DbVideoCollaborator = typeof videoCollaborators.$inferSelect;
export type DbCategory = typeof categories.$inferSelect;
export type DbTag = typeof tags.$inferSelect;
export type DbVideo = typeof videos.$inferSelect;
export type DbVideoPart = typeof videoParts.$inferSelect;
export type DbCollection = typeof collections.$inferSelect;
export type DbTopic = typeof topics.$inferSelect;
export type DbDynamic = typeof dynamics.$inferSelect;
export type DbConversation = typeof conversations.$inferSelect;
export type DbDanmaku = typeof danmaku.$inferSelect;
export type DbComment = typeof comments.$inferSelect;
export type DbJob = typeof backgroundJobs.$inferSelect;
