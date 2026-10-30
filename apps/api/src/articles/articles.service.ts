import { Injectable } from '@nestjs/common';
import {
  type DbArticle,
  articleComments,
  articleFavorites,
  articleLikes,
  articles,
  categories,
  notifications,
  users,
} from '@uiliuili/db';
import {
  AppError,
  type ArticleCreateInput,
  type ArticleListQuery,
  ERROR_CODES,
  renderMarkdown,
} from '@uiliuili/shared';
import { and, asc, count, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { AuthUser } from '../common/auth-user';
import { DatabaseService } from '../common/database.service';
import { grantExperience } from '../common/experience';
import { RateLimitService } from '../common/rate-limit.service';
import { currentRegionContext } from '../common/region-context';
import { SettingsService } from '../common/settings.service';
import { decodeCursor, encodeCursor } from '../videos/video.helpers';

const PUBLIC_ARTICLE_STATUS = 'published';

@Injectable()
export class ArticlesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly settings: SettingsService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async list(query: ArticleListQuery) {
    const offset = decodeCursor(query.cursor);
    const where = and(
      eq(articles.status, PUBLIC_ARTICLE_STATUS),
      eq(articles.visibility, 'public'),
      isNull(articles.deletedAt),
      query.category ? eq(articles.categoryId, query.category) : undefined,
      query.q
        ? or(ilike(articles.title, `%${query.q}%`), ilike(articles.summary, `%${query.q}%`))
        : undefined,
      query.author ? sql`lower(${users.username}) = ${query.author.toLowerCase()}` : undefined,
    );
    const rows = await this.database.db
      .select({ article: articles, author: users, category: categories })
      .from(articles)
      .innerJoin(users, eq(users.id, articles.authorId))
      .leftJoin(categories, eq(categories.id, articles.categoryId))
      .where(where)
      .orderBy(
        ...(query.sort === 'hot'
          ? [desc(articles.likeCount), desc(articles.publishedAt)]
          : [desc(articles.publishedAt)]),
      )
      .limit(query.limit)
      .offset(offset);
    return {
      items: rows.map((row) => this.card(row.article, row.author, row.category)),
      nextCursor: rows.length === query.limit ? encodeCursor(offset + query.limit) : null,
    };
  }

  async detail(id: string, viewer?: AuthUser) {
    const rows = await this.database.db
      .select({ article: articles, author: users, category: categories })
      .from(articles)
      .innerJoin(users, eq(users.id, articles.authorId))
      .leftJoin(categories, eq(categories.id, articles.categoryId))
      .where(and(eq(articles.id, id), isNull(articles.deletedAt)))
      .limit(1);
    const row = rows[0];
    if (!row) throw new AppError(ERROR_CODES.NOT_FOUND, '专栏不存在', 404);
    const isOwner = viewer?.id === row.article.authorId;
    const isStaff = Boolean(viewer?.permissions.includes('video:review'));
    if (!isOwner && !isStaff && row.article.status !== PUBLIC_ARTICLE_STATUS) {
      throw new AppError(ERROR_CODES.NOT_FOUND, '专栏不存在', 404);
    }
    await this.database.db
      .update(articles)
      .set({ viewCount: sql`${articles.viewCount} + 1` })
      .where(eq(articles.id, id));
    const [liked, favorited, related] = await Promise.all([
      viewer
        ? this.database.db
            .select({ userId: articleLikes.userId })
            .from(articleLikes)
            .where(and(eq(articleLikes.articleId, id), eq(articleLikes.userId, viewer.id)))
            .limit(1)
        : Promise.resolve([]),
      viewer
        ? this.database.db
            .select({ userId: articleFavorites.userId })
            .from(articleFavorites)
            .where(and(eq(articleFavorites.articleId, id), eq(articleFavorites.userId, viewer.id)))
            .limit(1)
        : Promise.resolve([]),
      this.database.db
        .select({
          id: articles.id,
          title: articles.title,
          coverUrl: articles.coverUrl,
          summary: articles.summary,
          viewCount: articles.viewCount,
          likeCount: articles.likeCount,
          publishedAt: articles.publishedAt,
          authorName: users.displayName,
          authorUsername: users.username,
        })
        .from(articles)
        .innerJoin(users, eq(users.id, articles.authorId))
        .where(
          and(
            eq(articles.status, PUBLIC_ARTICLE_STATUS),
            isNull(articles.deletedAt),
            sql`${articles.id} <> ${id}`,
          ),
        )
        .orderBy(desc(articles.publishedAt))
        .limit(6),
    ]);
    return {
      ...this.card(row.article, row.author, row.category),
      content: row.article.content,
      html: renderMarkdown(row.article.content),
      allowComments: row.article.allowComments,
      liked: liked.length > 0,
      favorited: favorited.length > 0,
      isOwner,
      related: related.map((item) => ({
        ...item,
        publishedAt: item.publishedAt?.toISOString() ?? null,
      })),
    };
  }

  async toggleLike(id: string, viewer: AuthUser, desired: boolean) {
    const article = await this.requirePublished(id);
    await this.database.db.transaction(async (tx) => {
      const existing = await tx
        .select({ userId: articleLikes.userId })
        .from(articleLikes)
        .where(and(eq(articleLikes.articleId, id), eq(articleLikes.userId, viewer.id)))
        .limit(1);
      if (desired && existing.length === 0) {
        await tx.insert(articleLikes).values({ articleId: id, userId: viewer.id });
        await tx
          .update(articles)
          .set({ likeCount: sql`${articles.likeCount} + 1` })
          .where(eq(articles.id, id));
      } else if (!desired && existing.length > 0) {
        await tx
          .delete(articleLikes)
          .where(and(eq(articleLikes.articleId, id), eq(articleLikes.userId, viewer.id)));
        await tx
          .update(articles)
          .set({ likeCount: sql`GREATEST(0, ${articles.likeCount} - 1)` })
          .where(eq(articles.id, id));
      }
    });
    if (desired && article.authorId !== viewer.id) {
      await this.database.db.insert(notifications).values({
        userId: article.authorId,
        actorId: viewer.id,
        type: 'article',
        title: `${viewer.displayName} 点赞了你的专栏`,
        body: article.title,
        link: `/columns/${id}`,
      });
      await grantExperience(this.database.db, article.authorId, 1);
    }
    return { liked: desired };
  }

  async toggleFavorite(id: string, viewer: AuthUser, desired: boolean) {
    const article = await this.requirePublished(id);
    await this.database.db.transaction(async (tx) => {
      const existing = await tx
        .select({ userId: articleFavorites.userId })
        .from(articleFavorites)
        .where(and(eq(articleFavorites.articleId, id), eq(articleFavorites.userId, viewer.id)))
        .limit(1);
      if (desired && existing.length === 0) {
        await tx.insert(articleFavorites).values({ articleId: id, userId: viewer.id });
        await tx
          .update(articles)
          .set({ favoriteCount: sql`${articles.favoriteCount} + 1` })
          .where(eq(articles.id, id));
      } else if (!desired && existing.length > 0) {
        await tx
          .delete(articleFavorites)
          .where(and(eq(articleFavorites.articleId, id), eq(articleFavorites.userId, viewer.id)));
        await tx
          .update(articles)
          .set({ favoriteCount: sql`GREATEST(0, ${articles.favoriteCount} - 1)` })
          .where(eq(articles.id, id));
      }
    });
    if (desired) await grantExperience(this.database.db, article.authorId, 1);
    return { favorited: desired };
  }

  async comments(id: string, viewer?: AuthUser) {
    const article = await this.requirePublished(id);
    const rows = await this.database.db
      .select({
        id: articleComments.id,
        content: articleComments.content,
        parentId: articleComments.parentId,
        status: articleComments.status,
        likeCount: articleComments.likeCount,
        ipRegion: articleComments.ipRegion,
        userId: articleComments.userId,
        createdAt: articleComments.createdAt,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        level: users.level,
      })
      .from(articleComments)
      .innerJoin(users, eq(users.id, articleComments.userId))
      .where(
        and(
          eq(articleComments.articleId, id),
          isNull(articleComments.deletedAt),
          viewer
            ? or(
                eq(articleComments.status, 'visible'),
                eq(articleComments.userId, viewer.id),
                article.authorId === viewer.id ? sql`true` : sql`false`,
              )
            : eq(articleComments.status, 'visible'),
        ),
      )
      .orderBy(asc(articleComments.createdAt))
      .limit(500);
    return {
      items: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    };
  }

  async createComment(
    id: string,
    viewer: AuthUser,
    input: { content: string; parentId?: string },
    ip?: string,
  ) {
    const article = await this.requirePublished(id);
    if (!article.allowComments) {
      throw new AppError(ERROR_CODES.FORBIDDEN, '作者已关闭评论', 403);
    }
    const content = input.content.trim();
    if (!content) throw new AppError(ERROR_CODES.BAD_REQUEST, '评论不能为空', 400);
    await this.rateLimit.check('comment', this.rateLimit.contextFrom(viewer, ip));
    if (input.parentId) {
      const parent = await this.database.db
        .select({ id: articleComments.id })
        .from(articleComments)
        .where(and(eq(articleComments.id, input.parentId), eq(articleComments.articleId, id)))
        .limit(1);
      if (!parent[0]) throw new AppError(ERROR_CODES.BAD_REQUEST, '回复的评论不存在', 400);
    }
    const [created] = await this.database.db
      .insert(articleComments)
      .values({
        articleId: id,
        userId: viewer.id,
        parentId: input.parentId ?? null,
        content: content.slice(0, 1000),
        ipRegion: currentRegionContext().ipLocationEnabled
          ? (currentRegionContext().code ?? null)
          : null,
      })
      .returning();
    await this.database.db
      .update(articles)
      .set({ commentCount: sql`${articles.commentCount} + 1` })
      .where(eq(articles.id, id));
    if (article.authorId !== viewer.id) {
      await this.database.db.insert(notifications).values({
        userId: article.authorId,
        actorId: viewer.id,
        type: 'comment',
        title: `${viewer.displayName} 评论了你的专栏`,
        body: content.slice(0, 120),
        link: `/columns/${id}`,
      });
      await grantExperience(this.database.db, article.authorId, 1);
    }
    return { id: created?.id ?? '' };
  }

  async removeComment(id: string, commentId: string, viewer: AuthUser) {
    const article = await this.requirePublished(id);
    const rows = await this.database.db
      .select({ id: articleComments.id, userId: articleComments.userId })
      .from(articleComments)
      .where(and(eq(articleComments.id, commentId), eq(articleComments.articleId, id)))
      .limit(1);
    const comment = rows[0];
    if (!comment) throw new AppError(ERROR_CODES.NOT_FOUND, '评论不存在', 404);
    if (comment.userId !== viewer.id && article.authorId !== viewer.id) {
      throw new AppError(ERROR_CODES.FORBIDDEN, '无权删除该评论', 403);
    }
    await this.database.db
      .update(articleComments)
      .set({ status: 'deleted', deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(articleComments.id, commentId));
    await this.database.db
      .update(articles)
      .set({ commentCount: sql`GREATEST(0, ${articles.commentCount} - 1)` })
      .where(eq(articles.id, id));
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Creator studio

  async myArticles(userId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const where = and(eq(articles.authorId, userId), isNull(articles.deletedAt));
    const [rows, total] = await Promise.all([
      this.database.db
        .select()
        .from(articles)
        .where(where)
        .orderBy(desc(articles.updatedAt))
        .limit(limit)
        .offset(offset),
      this.database.db.select({ value: count() }).from(articles).where(where),
    ]);
    return {
      items: rows.map((article) => this.studioPayload(article)),
      total: Number(total[0]?.value ?? 0),
      page,
      limit,
    };
  }

  async myArticle(userId: string, id: string) {
    const rows = await this.database.db
      .select()
      .from(articles)
      .where(and(eq(articles.id, id), eq(articles.authorId, userId), isNull(articles.deletedAt)))
      .limit(1);
    const article = rows[0];
    if (!article) throw new AppError(ERROR_CODES.NOT_FOUND, '专栏不存在', 404);
    return { ...this.studioPayload(article), content: article.content };
  }

  async create(userId: string, input: ArticleCreateInput) {
    const [created] = await this.database.db
      .insert(articles)
      .values({
        authorId: userId,
        title: input.title,
        summary: input.summary,
        content: input.content,
        coverUrl: input.coverUrl ?? null,
        categoryId: input.categoryId ?? null,
        visibility: input.visibility,
        allowComments: input.allowComments,
        status: 'draft',
      })
      .returning();
    if (!created) throw new AppError(ERROR_CODES.INTERNAL_ERROR, '创建专栏失败', 500);
    return this.studioPayload(created);
  }

  async update(userId: string, id: string, input: Partial<ArticleCreateInput>) {
    const [updated] = await this.database.db
      .update(articles)
      .set({
        title: input.title,
        summary: input.summary,
        content: input.content,
        coverUrl: input.coverUrl,
        categoryId: input.categoryId,
        visibility: input.visibility,
        allowComments: input.allowComments,
        updatedAt: new Date(),
      })
      .where(and(eq(articles.id, id), eq(articles.authorId, userId), isNull(articles.deletedAt)))
      .returning();
    if (!updated) throw new AppError(ERROR_CODES.NOT_FOUND, '专栏不存在', 404);
    return this.studioPayload(updated);
  }

  async remove(userId: string, id: string) {
    const [updated] = await this.database.db
      .update(articles)
      .set({ status: 'deleted', deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(articles.id, id), eq(articles.authorId, userId), isNull(articles.deletedAt)))
      .returning();
    if (!updated) throw new AppError(ERROR_CODES.NOT_FOUND, '专栏不存在', 404);
    return { ok: true };
  }

  async publish(userId: string, id: string, canReview: boolean) {
    const rows = await this.database.db
      .select()
      .from(articles)
      .where(and(eq(articles.id, id), eq(articles.authorId, userId), isNull(articles.deletedAt)))
      .limit(1);
    const article = rows[0];
    if (!article) throw new AppError(ERROR_CODES.NOT_FOUND, '专栏不存在', 404);
    if (!article.title.trim()) throw new AppError(ERROR_CODES.BAD_REQUEST, '请先填写标题', 400);
    if (!article.content.trim()) throw new AppError(ERROR_CODES.BAD_REQUEST, '请先填写正文', 400);
    const review = await this.settings.getReviewSettings();
    const pending = Boolean(review.articles) && !canReview;
    const [updated] = await this.database.db
      .update(articles)
      .set({
        status: pending ? 'pending_review' : 'published',
        publishedAt: article.publishedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(articles.id, id))
      .returning();
    return updated ? this.studioPayload(updated) : null;
  }

  async unpublish(userId: string, id: string) {
    const [updated] = await this.database.db
      .update(articles)
      .set({ status: 'draft', updatedAt: new Date() })
      .where(and(eq(articles.id, id), eq(articles.authorId, userId), isNull(articles.deletedAt)))
      .returning();
    if (!updated) throw new AppError(ERROR_CODES.NOT_FOUND, '专栏不存在', 404);
    return this.studioPayload(updated);
  }

  // ---------------------------------------------------------------------------
  // Administration

  async adminList(query: { page: number; limit: number; status?: string; q?: string }) {
    const offset = (query.page - 1) * query.limit;
    const where = and(
      query.status ? eq(articles.status, query.status) : undefined,
      query.q ? ilike(articles.title, `%${query.q}%`) : undefined,
    );
    const [rows, total] = await Promise.all([
      this.database.db
        .select({
          article: articles,
          authorName: users.displayName,
          authorUsername: users.username,
        })
        .from(articles)
        .innerJoin(users, eq(users.id, articles.authorId))
        .where(where)
        .orderBy(desc(articles.createdAt))
        .limit(query.limit)
        .offset(offset),
      this.database.db.select({ value: count() }).from(articles).where(where),
    ]);
    return {
      items: rows.map((row) => ({
        ...this.studioPayload(row.article),
        authorName: row.authorName,
        authorUsername: row.authorUsername,
      })),
      total: Number(total[0]?.value ?? 0),
      page: query.page,
      limit: query.limit,
    };
  }

  async adminModerate(actorId: string, id: string, status: string, note?: string) {
    const allowed = ['published', 'blocked', 'pending_review', 'deleted'];
    if (!allowed.includes(status)) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '无效的状态', 400);
    }
    const [updated] = await this.database.db
      .update(articles)
      .set({
        status,
        publishedAt: status === 'published' ? new Date() : undefined,
        deletedAt: status === 'deleted' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, id))
      .returning();
    if (!updated) throw new AppError(ERROR_CODES.NOT_FOUND, '专栏不存在', 404);
    await this.database.db.insert(notifications).values({
      userId: updated.authorId,
      actorId,
      type: 'moderation',
      title:
        status === 'published'
          ? '你的专栏已通过审核'
          : status === 'blocked'
            ? '你的专栏已被下架'
            : '你的专栏状态已更新',
      body: (note ?? updated.title).slice(0, 200),
      link: `/columns/${id}`,
    });
    return this.studioPayload(updated);
  }

  // ---------------------------------------------------------------------------

  private async requirePublished(id: string) {
    const rows = await this.database.db
      .select({
        id: articles.id,
        authorId: articles.authorId,
        title: articles.title,
        allowComments: articles.allowComments,
      })
      .from(articles)
      .where(
        and(
          eq(articles.id, id),
          eq(articles.status, PUBLIC_ARTICLE_STATUS),
          isNull(articles.deletedAt),
        ),
      )
      .limit(1);
    const article = rows[0];
    if (!article) throw new AppError(ERROR_CODES.NOT_FOUND, '专栏不存在', 404);
    return article;
  }

  private card(
    article: DbArticle,
    author: typeof users.$inferSelect,
    category: typeof categories.$inferSelect | null,
  ) {
    return {
      id: article.id,
      title: article.title,
      summary: article.summary,
      coverUrl: article.coverUrl,
      status: article.status,
      visibility: article.visibility,
      viewCount: article.viewCount,
      likeCount: article.likeCount,
      favoriteCount: article.favoriteCount,
      commentCount: article.commentCount,
      publishedAt: article.publishedAt?.toISOString() ?? null,
      createdAt: article.createdAt.toISOString(),
      author: {
        id: author.id,
        username: author.username,
        displayName: author.displayName,
        avatarUrl: author.avatarUrl,
        level: author.level,
      },
      category: category ? { id: category.id, name: category.name, slug: category.slug } : null,
    };
  }

  private studioPayload(article: DbArticle) {
    return {
      id: article.id,
      title: article.title,
      summary: article.summary,
      coverUrl: article.coverUrl,
      categoryId: article.categoryId,
      status: article.status,
      visibility: article.visibility,
      allowComments: article.allowComments,
      viewCount: article.viewCount,
      likeCount: article.likeCount,
      favoriteCount: article.favoriteCount,
      commentCount: article.commentCount,
      publishedAt: article.publishedAt?.toISOString() ?? null,
      createdAt: article.createdAt.toISOString(),
      updatedAt: article.updatedAt.toISOString(),
    };
  }
}
