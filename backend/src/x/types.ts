// Subset of X API v2 response shapes used by this service.

export interface XUrlEntity {
  start: number;
  end: number;
  url: string;
  expanded_url?: string;
  unwound_url?: string;
  display_url?: string;
  title?: string;
  description?: string;
  images?: { url: string; width: number; height: number }[];
}

export interface XPost {
  id: string;
  text: string;
  author_id?: string;
  created_at?: string;
  lang?: string;
  possibly_sensitive?: boolean;
  edit_history_tweet_ids?: string[];
  entities?: { urls?: XUrlEntity[] };
  public_metrics?: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
    quote_count: number;
  };
}

export interface XUser {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
  verified?: boolean;
  verified_type?: string;
}

export interface XProblem {
  resource_id?: string;
  resource_type?: string;
  title: string;
  detail?: string;
  type?: string;
}

export interface XSearchResponse {
  data?: XPost[];
  meta: { result_count: number; newest_id?: string; oldest_id?: string; next_token?: string };
  errors?: XProblem[];
}

export interface XLookupResponse<T> {
  data?: T[];
  errors?: XProblem[];
}
