import type { Db } from '@uiliuili/db';
import { follows, notifications, videos } from '@uiliuili/db';
import { eq } from 'drizzle-orm';

export async function notifyFollowersOfNewVideo(db: Db, videoId: string): Promise<void> {
  const rows = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
  const video = rows[0];
  if (!video || video.status !== 'published') return;
  const followers = await db
    .select({ userId: follows.followerId })
    .from(follows)
    .where(eq(follows.followingId, video.uploaderId))
    .limit(2000);
  if (followers.length === 0) return;
  await db.insert(notifications).values(
    followers.map((follower) => ({
      userId: follower.userId,
      actorId: video.uploaderId,
      type: 'system',
      title: '你关注的 UP 主发布了新视频',
      body: video.title,
      link: `/video/${video.id}`,
    })),
  );
}
