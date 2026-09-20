export type Article = {
  id: string;
  title: string;
  excerpt: string;
  content: string; // Markdown or HTML
  date: string;
  author: string;
  coverImage: string;
};

export const articles: Article[] = [
  {
    id: 'nebula-alpha-release',
    title: 'Project Nebula Enters Closed Alpha',
    excerpt: 'The zero-gravity survival experience you\'ve been waiting for is finally playable.',
    content: 'We are incredibly excited to announce that Project Nebula has officially entered closed alpha. After 3 years of intense development, our physics engine is finally stable enough to handle the chaotic reality of zero-g combat...',
    date: '2026-10-15',
    author: 'Sarah Jenkins, Game Director',
    coverImage: '/images/news/nebula-alpha.jpg',
  },
  {
    id: 'studio-expansion',
    title: 'Expanding Our Horizons: Studio Growth in 2026',
    excerpt: 'We are growing our team to bring you more immersive worlds.',
    content: 'It has been a wild ride since we launched Neon Drifter. Thanks to our amazing community, we are expanding our studio space and hiring for multiple key roles...',
    date: '2026-09-01',
    author: 'Mark Sterling, Studio Head',
    coverImage: '/images/news/studio-expansion.jpg',
  }
];

export async function getArticles(): Promise<Article[]> {
  return articles;
}

export async function getArticleById(id: string): Promise<Article | undefined> {
  return articles.find(a => a.id === id);
}
