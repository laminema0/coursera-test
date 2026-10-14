import type { MemoryStore, StoredPost, StoredUser } from "./store.ts";

// Response shape served to the iOS app (snake_case JSON).

export interface FeedAuthor {
  id: string;
  username: string;
  name: string;
  profile_image_url?: string;
  verified: boolean;
  verified_type?: string;
}

export interface FeedPost {
  id: string;
  text: string;
  created_at: string;
  lang?: string;
  possibly_sensitive: boolean;
  /** Link back to the post on X (required attribution). */
  permalink: string;
  author: FeedAuthor;
  metrics?: { like_count: number; repost_count: number; reply_count: number; quote_count: number };
}

export interface FeedStory {
  id: string;
  url: string;
  publisher: string;
  title?: string;
  summary?: string;
  image_url?: string;
  first_seen_at: string;
  last_activity_at: string;
  posts: FeedPost[];
}

export interface FeedResponse {
  generated_at: string;
  stories: FeedStory[];
  /** Posts the client must delete from its local cache (deleted on X or expired). */
  removed_post_ids: string[];
}

export function buildFeed(store: MemoryStore, options: { since?: Date; limit: number; now: Date }): FeedResponse {
  const postsByStory = new Map<string, FeedPost[]>();
  for (const post of store.posts.values()) {
    const author = store.users.get(post.authorId);
    // X display rules need author name and handle. Without a profile we don't show the post.
    if (!author) continue;
    const list = postsByStory.get(post.storyId) ?? [];
    list.push(toFeedPost(post, author));
    postsByStory.set(post.storyId, list);
  }

  const stories = [...store.stories.values()]
    .filter((story) => postsByStory.has(story.id))
    .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))
    .slice(0, options.limit)
    .map((story): FeedStory => ({
      id: story.id,
      url: story.url,
      publisher: story.publisher,
      title: story.title,
      summary: story.description,
      image_url: story.imageUrl,
      first_seen_at: story.firstSeenAt,
      last_activity_at: story.lastActivityAt,
      posts: (postsByStory.get(story.id) ?? []).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    }));

  const since = options.since;
  return {
    generated_at: options.now.toISOString(),
    stories,
    removed_post_ids: store.tombstones.filter((t) => !since || new Date(t.removedAt) > since).map((t) => t.postId),
  };
}

function toFeedPost(post: StoredPost, author: StoredUser): FeedPost {
  return {
    id: post.id,
    text: post.text,
    created_at: post.createdAt,
    lang: post.lang,
    possibly_sensitive: post.possiblySensitive,
    permalink: `https://x.com/${author.username}/status/${post.id}`,
    author: {
      id: author.id,
      username: author.username,
      name: author.name,
      profile_image_url: author.profileImageUrl,
      verified: author.verified,
      verified_type: author.verifiedType,
    },
    metrics: post.metrics && {
      like_count: post.metrics.likes,
      repost_count: post.metrics.reposts,
      reply_count: post.metrics.replies,
      quote_count: post.metrics.quotes,
    },
  };
}
