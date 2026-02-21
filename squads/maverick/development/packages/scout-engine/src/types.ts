export interface InstagramPost {
  id: string;
  url: string;
  caption: string;
  likes: number;
  comments: number;
  type: 'image' | 'video' | 'carousel' | 'reel';
  postedAt: string;
  isAd: boolean;
}

export interface InstagramProfile {
  username: string;
  fullName: string;
  bio: string;
  followerCount: number;
  followingCount: number;
  postCount: number;
  isPrivate: boolean;
  isVerified: boolean;
  profilePicUrl: string;
  recentPosts: InstagramPost[];
}

export interface ScraperOptions {
  headless?: boolean;
  timeout?: number;
  sessionCookies?: any[];
}
