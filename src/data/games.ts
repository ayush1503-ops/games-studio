import { assetUrl } from '../utils/asset';
export type Game = {
  id: string;
  title: string;
  tagline: string;
  description: string;
  releaseDate: string;
  status: 'In Development' | 'Released' | 'Early Access';
  genre: string[];
  coverImage: string;
  screenshots: string[];
};

export const games: Game[] = [
  {
    id: 'project-nebula',
    title: 'Project Nebula',
    tagline: 'Defy gravity. Survive the void.',
    description: 'A next-generation zero-gravity survival game where physics are your weapon and your enemy. Navigate derelict space stations and unravel the mystery of the collapse.',
    releaseDate: '2027',
    status: 'In Development',
    genre: ['Action', 'Survival', 'Sci-Fi'],
    coverImage: assetUrl('/images/games/nebula-cover.jpg'),
    screenshots: [
      assetUrl('/images/games/nebula-1.jpg'),
      assetUrl('/images/games/nebula-2.jpg')
    ]
  },
  {
    id: 'neon-drifter',
    title: 'Neon Drifter',
    tagline: 'Speed is survival.',
    description: 'A high-octane cyberpunk racing game with deep customization and a dynamic synthwave soundtrack that reacts to your driving.',
    releaseDate: '2025',
    status: 'Released',
    genre: ['Racing', 'Cyberpunk', 'Rhythm'],
    coverImage: assetUrl('/images/games/neon-cover.jpg'),
    screenshots: [
      assetUrl('/images/games/neon-1.jpg'),
      assetUrl('/images/games/neon-2.jpg')
    ]
  }
];

export async function getGames(): Promise<Game[]> {
  // Simulate network delay or file reading if we move to markdown later
  return games;
}

export async function getGameById(id: string): Promise<Game | undefined> {
  return games.find((g) => g.id === id);
}
