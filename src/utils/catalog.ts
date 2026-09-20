import { Game, GameCategory } from '../types';

export const GAME_CATEGORIES: { id: GameCategory; emoji: string }[] = [
  { id: 'Action', emoji: '🎮' },
  { id: 'Puzzle', emoji: '🧩' },
  { id: 'Racing', emoji: '🏎️' },
  { id: 'Adventure', emoji: '⚔️' },
  { id: 'Sports', emoji: '🏀' },
  { id: 'RPG', emoji: '🧙' },
  { id: 'Horror', emoji: '👻' },
  { id: 'Indie', emoji: '🎨' }
];

export const gameCategories = (game: Game): GameCategory[] => game.categories ?? ['Indie'];

export const CATEGORY_COLORS: Record<GameCategory, string> = {
  Action: 'bg-coral text-white',
  Puzzle: 'bg-grape text-white',
  Racing: 'bg-sun text-ink',
  Adventure: 'bg-lime text-ink',
  Sports: 'bg-sky text-white',
  RPG: 'bg-grape text-white',
  Horror: 'bg-ink text-paper',
  Indie: 'bg-sun text-ink'
};

export const ARTICLE_COLORS: Record<string, string> = {
  NEWS: 'bg-coral text-white',
  DEVLOG: 'bg-grape text-white',
  'BEHIND THE SCENES': 'bg-sun text-ink',
  ANNOUNCEMENT: 'bg-lime text-ink',
  STUDIO: 'bg-sky text-white',
  COMMUNITY: 'bg-coral text-white'
};

export const statusColor = (status: Game['status']): string => {
  switch (status) {
    case 'Available Now':
      return 'bg-lime text-ink';
    case 'Early Access':
      return 'bg-sun text-ink';
    case 'Wishlist Now':
      return 'bg-coral text-white';
    default:
      return 'bg-grape text-white';
  }
};

export const platformShort = (platforms: string[]): string =>
  platforms
    .map((p) => {
      if (p.includes('PlayStation')) return 'PS5';
      if (p.includes('Xbox')) return 'XBOX';
      if (p.includes('Switch')) return 'SWITCH';
      if (p.includes('Mac')) return 'MAC';
      return 'PC';
    })
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(' · ');
