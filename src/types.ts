export type PageRoute = 'home' | 'games' | 'news' | 'blog' | 'about' | 'careers' | 'contact' | 'admin';

export type GameCategory =
  | 'Action'
  | 'Puzzle'
  | 'Racing'
  | 'Adventure'
  | 'Sports'
  | 'RPG'
  | 'Horror'
  | 'Indie';

export interface Game {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  genre: string;
  categories?: GameCategory[];
  rating?: number;
  price?: string;
  platforms: string[];
  status: 'In Development' | 'Early Access' | 'Wishlist Now' | 'Available Now';
  releaseYear: string;
  description: string;
  longDescription: string;
  heroImage: string;
  secondaryImage?: string;
  screenshots: string[];
  videoUrl?: string;
  tags: string[];
  features: string[];
  gameplayMechanics: { title: string; description: string }[];
  devStory: string;
  storeLinks: { name: string; url: string; badge?: string }[];
  awards?: string[];
  featured?: boolean;
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  category: 'NEWS' | 'DEVLOG' | 'BEHIND THE SCENES' | 'ANNOUNCEMENT' | 'STUDIO' | 'COMMUNITY';
  date: string;
  readTime: string;
  excerpt: string;
  content: string;
  coverImage: string;
  author: {
    name: string;
    role: string;
    avatar?: string;
  };
  tags: string[];
  featured?: boolean;
  published: boolean;
}

export interface Job {
  id: string;
  title: string;
  department: 'Engineering' | 'Art & Animation' | 'Game Design' | 'Production' | 'Audio' | 'Community';
  location: string;
  type: 'Full-time' | 'Contract' | 'Remote / Hybrid';
  experience: 'Mid' | 'Senior' | 'Lead' | 'Director';
  description: string;
  responsibilities: string[];
  requirements: string[];
  niceToHave: string[];
  perks: string[];
  status: 'open' | 'closed';
  postedDate: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  company?: string;
  subject: string;
  projectType: string;
  budget?: string;
  message: string;
  createdAt: string;
  status: 'unread' | 'reviewed' | 'archived';
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  name: string;
  interests: string[];
  subscribedAt: string;
}

export interface StudioTimelineItem {
  year: string;
  title: string;
  description: string;
  tag: string;
}

export interface TeamMember {
  name: string;
  role: string;
  bio: string;
  favoriteGame: string;
  photoColor: string;
}
