/** Shapes returned by the studio API. Kept in one place so pages stay dumb. */

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR';

export interface AdminUser {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
  permissions?: string[];
  avatarColor?: string;
  isActive?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  /** Only ever returned for the signed-in user's own profile. */
  sessionCount?: number;
}

export interface SessionSummary {
  id: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  expiresAt: string;
  current?: boolean;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface Paged<T> {
  items: T[];
  pagination: Pagination;
  counts?: Record<string, number>;
}

export type GameStatus = 'IN_DEVELOPMENT' | 'EARLY_ACCESS' | 'WISHLIST_NOW' | 'AVAILABLE_NOW';

export interface GameMechanic {
  title: string;
  description: string;
}

export interface StoreLink {
  name: string;
  url: string;
  badge?: string | null;
}

export interface AdminGame {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  genre: string;
  categories: string[];
  rating?: number | null;
  price: string;
  salePrice?: string | null;
  currency: string;
  isFree: boolean;
  platforms: string[];
  status: string;
  statusEnum: GameStatus;
  releaseYear: string;
  description: string;
  longDescription: string;
  heroImage?: string | null;
  secondaryImage?: string | null;
  screenshots: string[];
  trailerUrl?: string | null;
  tags: string[];
  features: string[];
  gameplayMechanics: GameMechanic[];
  devStory: string;
  storeLinks: StoreLink[];
  awards: string[];
  featured: boolean;
  featuredOrder?: number | null;
  published: boolean;
  publishedAt?: string | null;
  wishlistCount: number;
  viewCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type GameInput = Partial<
  Omit<AdminGame, 'id' | 'featuredOrder' | 'published' | 'publishedAt' | 'wishlistCount' | 'viewCount' | 'version' | 'createdAt' | 'updatedAt' | 'statusEnum'>
> & {
  title: string;
  genre: string;
  categories: string[];
  platforms: string[];
  description: string;
};

export type PostStatus = 'DRAFT' | 'PUBLISHED';

export interface AdminPost {
  id: string;
  slug: string;
  title: string;
  category: string;
  categorySlug?: string;
  categoryColor?: string;
  categoryId?: string | null;
  date: string;
  readTime: string;
  readTimeOverride?: string | null;
  excerpt: string;
  contentHtml: string;
  content: string;
  coverImage: string;
  author: { name: string; role: string; avatar?: string };
  tags: string[];
  featured: boolean;
  published: boolean;
  status: PostStatus;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PostInput {
  title: string;
  slug?: string;
  categoryId?: string | null;
  content: string;
  contentFormat?: 'html' | 'text';
  excerpt?: string;
  coverImage?: string | null;
  authorName?: string;
  authorRole?: string;
  authorImage?: string | null;
  tags?: string[];
  readTimeOverride?: string | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  color: string;
  postCount?: number;
  newsCount?: number;
  blogCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminJob {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  typeEnum?: string;
  experience: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  niceToHave: string[];
  perks: string[];
  status: 'open' | 'closed';
  statusEnum?: string;
  postedDate: string;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface MediaAsset {
  id: string;
  url: string;
  filename: string;
  originalName?: string | null;
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  alt?: string | null;
  uploadedById?: string | null;
  createdAt: string;
  usageCount?: number;
}

export interface Player {
  id: string;
  email: string;
  displayName: string;
  country?: string | null;
  role: 'PLAYER' | 'PRESS' | 'MODERATOR';
  status: 'ACTIVE' | 'DISABLED' | 'BANNED';
  emailVerified: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string | null;
  wishlistGames?: { id: string; title: string; slug: string; heroImage?: string | null }[];
}

export interface Subscriber {
  id: string;
  email: string;
  name?: string | null;
  status: 'ACTIVE' | 'UNSUBSCRIBED' | 'BOUNCED';
  source?: string | null;
  interests: string[];
  subscribedAt: string;
  unsubscribedAt?: string | null;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  company?: string | null;
  subject: string;
  projectType: string;
  budget?: string | null;
  message: string;
  status: 'UNREAD' | 'REVIEWED' | 'REPLIED' | 'ARCHIVED' | 'SPAM';
  notes?: string | null;
  handledById?: string | null;
  handledAt?: string | null;
  createdAt: string;
}

export interface ActivityEntry {
  id: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  description?: string | null;
  /** Human summary written by the audit trail (e.g. “Updated content block”). */
  summary?: string | null;
  /** Email of the admin who performed the action. */
  actorEmail?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  admin?: { id: string; name: string; email: string; role: Role } | null;
}

export interface ContentBlock {
  key: string;
  section: string;
  value: unknown;
  customized: boolean;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  lastLoginAt?: string | null;
  failedLoginCount?: number;
  lockedUntil?: string | null;
  createdAt?: string;
}

export interface DashboardStats {
  stats: {
    games: { total: number; published: number; featured: number };
    posts: { total: number; drafts: number };
    jobs: { total: number; open: number };
    subscribers: { total: number; active: number; last30Days: number };
    players: { total: number; new30Days: number };
    messages: { unread: number };
    media: { files: number; bytes: number };
  };
  featuredGames: { id: string; title: string; slug: string; heroImage?: string | null; featuredOrder?: number | null }[];
  recentActivity: ActivityEntry[];
  recentPosts: { id: string; title: string; slug: string; status: PostStatus; publishedAt?: string | null; updatedAt: string; coverImage: string }[];
  recentGames: { id: string; title: string; slug: string; status: string; published: boolean; updatedAt: string; heroImage?: string | null }[];
  recentMessages: { id: string; name: string; email: string; subject: string; status: string; createdAt: string }[];
  topGames: { id: string; title: string; slug: string; views: number; wishlists: number; heroImage?: string | null }[];
  subscriberTrend: { day: string; count: number }[];
  contentChecklist: { key: string; section: string; customized: boolean; updatedAt?: string | null }[];
}

export interface SystemSnapshot {
  generatedAt: string;
  runtime: Record<string, unknown>;
  database: Record<string, unknown>;
  storage: Record<string, unknown>;
  security: Record<string, unknown>;
  counts?: Record<string, number>;
}

export const GAME_STATUS_LABELS: Record<GameStatus, string> = {
  IN_DEVELOPMENT: 'In Development',
  EARLY_ACCESS: 'Early Access',
  WISHLIST_NOW: 'Wishlist Now',
  AVAILABLE_NOW: 'Available Now',
};

export const GAME_STATUS_OPTIONS = Object.entries(GAME_STATUS_LABELS) as [GameStatus, string][];

export const GAME_CATEGORIES = ['Action', 'Puzzle', 'Racing', 'Adventure', 'Sports', 'RPG', 'Horror', 'Indie'] as const;

export const JOB_DEPARTMENTS = [
  'Engineering',
  'Art & Animation',
  'Game Design',
  'Production',
  'Audio',
  'Community',
] as const;

export const JOB_TYPES = [
  ['FULL_TIME', 'Full-time'],
  ['CONTRACT', 'Contract'],
  ['FREELANCE', 'Freelance'],
  ['REMOTE_HYBRID', 'Remote / Hybrid'],
] as const;

export const JOB_EXPERIENCE = ['Mid', 'Senior', 'Lead', 'Director'] as const;

export const ARTICLE_COLORS = ['#FF5A3C', '#6C4CF1', '#FFC53D', '#A8D92C', '#2FB9DD', '#7A6BFF'] as const;
