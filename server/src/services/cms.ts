import type {
  CategoryRow,
  GameRow,
  GameplayMechanicRow,
  JobRow,
  NewsPostRow,
  StoreLinkRow,
} from '../db/schema.js';
import { estimateReadTime, sanitizeRichText } from '../utils/sanitize.js';

type GameStatusValue = 'IN_DEVELOPMENT' | 'EARLY_ACCESS' | 'WISHLIST_NOW' | 'AVAILABLE_NOW';
type JobTypeValue = 'FULL_TIME' | 'CONTRACT' | 'FREELANCE' | 'REMOTE_HYBRID';
type PostStatusValue = 'DRAFT' | 'PUBLISHED';

/* ------------------------------------------------------------------ */
/* Public serialisers                                                  */
/* ------------------------------------------------------------------ */

type GameWithRelations = GameRow & {
  mechanics?: GameplayMechanicRow[];
  storeLinks?: StoreLinkRow[];
};

const GAME_STATUS_LABEL: Record<GameStatusValue, string> = {
  IN_DEVELOPMENT: 'In Development',
  EARLY_ACCESS: 'Early Access',
  WISHLIST_NOW: 'Wishlist Now',
  AVAILABLE_NOW: 'Available Now',
};

export const GAME_STATUS_VALUES = Object.keys(GAME_STATUS_LABEL) as GameStatusValue[];
export const gameStatusToEnum = (label: string): GameStatusValue =>
  (Object.entries(GAME_STATUS_LABEL).find(([, value]) => value === label)?.[0] as GameStatusValue) ??
  'IN_DEVELOPMENT';

export function serialisePublicGame(game: GameWithRelations) {
  return {
    id: game.id,
    slug: game.slug,
    title: game.title,
    subtitle: game.subtitle ?? '',
    genre: game.genre,
    categories: game.categories,
    rating: game.rating ?? 0,
    price: game.price,
    salePrice: game.salePrice ?? null,
    currency: game.currency,
    isFree: game.isFree,
    platforms: game.platforms,
    status: GAME_STATUS_LABEL[game.status as GameStatusValue] ?? 'In Development',
    releaseYear: game.releaseYear,
    description: game.description,
    longDescription: game.longDescription,
    heroImage: game.heroImage ?? '',
    secondaryImage: game.secondaryImage ?? '',
    screenshots: game.screenshots,
    videoUrl: game.trailerUrl ?? undefined,
    tags: game.tags,
    features: game.features,
    gameplayMechanics: (game.mechanics ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(({ title, description }) => ({ title, description })),
    devStory: game.devStory,
    storeLinks: (game.storeLinks ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(({ name, url, badge }) => ({ name, url, badge: badge ?? undefined })),
    awards: game.awards,
    featured: game.featured,
  };
}

/** Admin view: everything the public sees, plus editorial metadata. */
export function serialiseAdminGame(game: GameWithRelations) {
  return {
    ...serialisePublicGame(game),
    statusEnum: game.status,
    featuredOrder: game.featuredOrder,
    published: game.published,
    publishedAt: game.publishedAt,
    wishlistCount: game.wishlistCount,
    viewCount: game.viewCount,
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
    version: game.version,
  };
}

type PostWithCategory = NewsPostRow & { category?: Pick<CategoryRow, 'id' | 'name' | 'slug' | 'color'> | null };

const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

export function formatPostDate(date: Date | null): string {
  const value = date ?? new Date();
  return `${MONTHS[value.getUTCMonth()]} ${value.getUTCFullYear()}`;
}

export function serialisePublicPost(post: PostWithCategory) {
  const categoryName = (post.category?.name ?? 'News').toUpperCase();
  const contentHtml = sanitizeRichText(post.contentHtml ?? '');

  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    category: categoryName,
    categorySlug: post.category?.slug ?? 'news',
    categoryColor: post.category?.color ?? '#6C4CF1',
    date: formatPostDate(post.publishedAt ?? post.createdAt),
    readTime: post.readTimeOverride?.trim() || estimateReadTime(contentHtml),
    excerpt: post.excerpt,
    contentHtml,
    content: contentHtmlToPlainBlockText(contentHtml),
    coverImage: post.coverImage ?? '',
    author: { name: post.authorName, role: post.authorRole, avatar: post.authorImage ?? undefined },
    tags: post.tags,
    featured: post.featured,
    published: post.status === 'PUBLISHED',
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
  };
}

export function serialiseAdminPost(post: PostWithCategory) {
  return {
    ...serialisePublicPost(post),
    status: post.status,
    categoryId: post.categoryId,
    readTimeOverride: post.readTimeOverride,
    createdAt: post.createdAt,
  };
}

/** Plain-text fallback so older clients / previews still render something sane. */
function contentHtmlToPlainBlockText(html: string): string {
  return html
    .replace(/<\/(p|h2|h3|h4|li|blockquote)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const JOB_TYPE_LABEL: Record<JobTypeValue, string> = {
  FULL_TIME: 'Full-time',
  CONTRACT: 'Contract',
  FREELANCE: 'Freelance',
  REMOTE_HYBRID: 'Remote / Hybrid',
};

export const JOB_TYPE_VALUES = Object.keys(JOB_TYPE_LABEL) as JobTypeValue[];

export function serialisePublicJob(job: JobRow) {
  return {
    id: job.id,
    slug: job.id,
    title: job.title,
    department: job.department,
    location: job.location,
    type: JOB_TYPE_LABEL[job.type as JobTypeValue] ?? 'Full-time',
    experience: job.experience,
    description: job.description,
    responsibilities: job.responsibilities,
    requirements: job.requirements,
    niceToHave: job.niceToHave,
    perks: job.perks,
    status: job.status === 'OPEN' ? 'open' : 'closed',
    postedDate: job.postedDate,
    sortOrder: job.sortOrder,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export function serialiseAdminJob(job: JobRow) {
  return {
    ...serialisePublicJob(job),
    statusEnum: job.status,
    department: job.department,
    experience: job.experience,
  };
}

/* ------------------------------------------------------------------ */
/* Editable content defaults                                           */
/* ------------------------------------------------------------------ */

/**
 * Defaults for every editable page block. The seed writes these verbatim so the
 * public site renders pixel-identically the moment the database is connected.
 */
export const CONTENT_DEFAULTS: Record<string, { section: string; value: unknown }> = {
  'about.hero': {
    section: 'about',
    value: {
      badge: '❤️ Our story · 2019 → today',
      title: 'We make games worth',
      highlight: 'playing',
      lead:
        'Brainchild Games began around a wobbly kitchen table in Montreal, founded by two developers who wanted out of assembly-line production. Today we are 28 artists, physicists, composers and professional bell-ringers, united by one obsession: building places worth visiting twice.',
      mission:
        'Our mission is simple to say and hard to do — make worlds that hug you back. Games that respect your time, reward your curiosity, and leave you humming their theme song in the grocery store.',
      chips: ['Player-first', 'Handmade', 'Independent', 'Slightly quirky'],
      quote:
        '“If a world doesn’t make the team want to step inside the monitor at 3am, we scrap it and start over.”',
      quoteAttribution: '— Julian Vance & Maya Lin-Torvalds, co-founders. Still true, eight years and four worlds later.',
      teamBadge: '28 humans',
    },
  },
  'about.timeline': {
    section: 'about',
    value: {
      items: [
        {
          year: '2019',
          title: 'THE SPARK IN THE BASEMENT',
          description:
            'Founded by two indie developers tired of predictable mechanics, with a single manifesto taped to the wall: "Build places you want to inhabit."',
          tag: 'ORIGIN',
        },
        {
          year: '2021',
          title: 'BIRTH OF PIX',
          description:
            'We sketch our mascot Pix on a late train ride, and ship our first physics toy "Cloudhop", winning Best Indie Prototype at a jam with 400 entries.',
          tag: 'MILESTONE',
        },
        {
          year: '2023',
          title: 'SOLARIS DIVER UNVEILED',
          description:
            'Our golden-sea expedition launches into Early Access to warm critical reception, crossing 100,000 wishlists in its first month.',
          tag: 'RELEASE',
        },
        {
          year: '2025',
          title: 'TEAM EXPANSION & UNREAL 5',
          description:
            'The studio grows to 28 artists, programmers and composers worldwide, and Aetherbound moves fully onto Unreal Engine 5.',
          tag: 'EXPANSION',
        },
        {
          year: '2026 & BEYOND',
          title: 'THE NEXT SHELF',
          description:
            'Preparing the global launch of Aetherbound: Echoes of Zero while prototyping two radical new genre experiments in the jam room.',
          tag: 'PRESENT',
        },
      ],
    },
  },
  'about.team': {
    section: 'about',
    value: {
      members: [
        {
          name: 'Julian Vance',
          role: 'Creative Director & Co-Founder',
          bio: 'Former architect turned worldbuilder. Obsessed with bell towers, swing physics and modular analog synthesizers.',
          favoriteGame: 'Outer Wilds & Shadow of the Colossus',
          photoColor: '#ff5a3c',
        },
        {
          name: 'Maya Lin-Torvalds',
          role: 'Technical Director & Co-Founder',
          bio: 'Veteran graphics and physics architect. Loves rendering volumetric clouds, writing compute shaders, and brewing dark roast espresso.',
          favoriteGame: 'Homeworld & Metroid Prime',
          photoColor: '#6c4cf1',
        },
        {
          name: 'Elena Rostova',
          role: 'Lead Systems Programmer',
          bio: 'Mathematics enthusiast who believes every mechanic should have weight and inertia. Built Aetherbound’s tether-swing model.',
          favoriteGame: 'Kerbal Space Program & Portal 2',
          photoColor: '#ffc53d',
        },
        {
          name: 'Sariel Moreau',
          role: 'Audio Director',
          bio: 'Sound sculptor who records creaking bells in abandoned chapels and turns them into skies full of wind.',
          favoriteGame: 'Silent Hill 2 & Journey',
          photoColor: '#2fb9dd',
        },
      ],
    },
  },
  'about.philosophy': {
    section: 'about',
    value: {
      items: [
        {
          emoji: '🎮',
          title: 'Play over polish, until polish feels like play',
          desc: 'If a mechanic doesn’t spark a grin in a greybox room within fifteen seconds, no amount of shader work will rescue it. We prototype relentlessly and throw away happily.',
        },
        {
          emoji: '🗺️',
          title: 'Worlds first, always',
          desc: 'Our environments are characters, not backdrops. Rocks have history, bells have moods, and every corner hides one small delightful secret for the curious.',
        },
        {
          emoji: '🌿',
          title: 'Human pace over crunch',
          desc: 'Great games come from rested people with lives outside of games. Strict 4-day week, zero mandatory overtime, and a pizza oven we genuinely regret.',
        },
      ],
    },
  },
  'contact.details': {
    section: 'contact',
    value: {
      email: 'hello@brainchild.games',
      discord: 'Discord · 18,000 players',
      address: '4210 Saint-Laurent, Montreal',
      hours: 'Replies within 48h, Mon–Thu',
      faq: [
        { q: 'How fast do you reply?', a: 'Within 48 hours, by a human with a name.' },
        { q: 'Press & review keys?', a: 'Email us with your outlet and we’ll sort you out same-day.' },
        { q: 'Bug reports?', a: 'Yes please! Player Support category, screenshots appreciated.' },
      ],
    },
  },
  'careers.intro': {
    section: 'careers',
    value: {
      lead:
        'We hire curious engineers, environment sculptors, word wizards and audio alchemists who want their craft to define a genre. Applications are read by humans, replied to by humans. No automated filtering. Ever.',
      applicationNote: 'Applications read by humans · reply within a week',
      applyEmail: 'jobs@brainchild.games',
      benefits: [
        {
          emoji: '🗓️',
          title: '4-day work week',
          desc: 'Monday–Thursday, 36 hours. Fridays are for playing games, hiking, family, or forbidden prototypes.',
        },
        {
          emoji: '💰',
          title: 'Real profit sharing',
          desc: '15% of net revenue from every game is pooled and split equally across the team. No fine print.',
        },
        {
          emoji: '🛑',
          title: 'Zero crunch culture',
          desc: 'We scope games to fit life, not the other way around. Milestones move before sleep does.',
        },
        {
          emoji: '🌍',
          title: 'Remote-first, human-always',
          desc: '$4k hardware budget, health & dental coverage, and one annual cabin retreat with board games.',
        },
      ],
    },
  },
  'home.hero': {
    section: 'home',
    value: {
      studioLine: 'Independent game studio · Montreal',
      est: 'Est. 2019',
      worlds: '4 handmade worlds',
      motto: 'Pix approved ✓',
      rating: '4.8 average rating',
      players: '120k players',
      madeIn: 'Made in Montreal',
      ticker: [
        'Aetherbound lands Q4 2026',
        'Good games. Good times.',
        'Solaris Diver 0.8 is live',
        'Player-first, always',
        '4-day work week studio',
        'Void Protocol alpha soon',
        'Handmade in Montreal',
      ],
    },
  },
  'home.values': {
    section: 'home',
    value: {
      items: [
        {
          icon: 'gamepad',
          title: 'Play first',
          text: 'If a mechanic isn’t fun in a greybox in 15 seconds, we start over.',
        },
        {
          icon: 'users',
          title: 'Small crew',
          text: '28 artists, coders and composers. No assembly lines, no filler.',
        },
        {
          icon: 'heart',
          title: 'Human pace',
          text: '4-day work week. Rested people make better worlds.',
        },
      ],
    },
  },
  'home.about_band': {
    section: 'home',
    value: {
      lead:
        'Brainchild started in a Montreal basement in 2019 with two devs, one manifest and a pizza oven we still regret buying. Today we are 28 people who believe games are the warmest medium ever invented — and that a world should hug you back.',
      crewBadge: '28 creators',
      studioCaption: 'Studio floor · Montreal',
    },
  },
  'footer.studio': {
    section: 'footer',
    value: {
      tagline:
        'Handmade with too many snacks in Montreal, QC. Every gravity equation double-checked by hand.',
      copyright: '© 2019–2026 Brainchild Games Inc.',
      discordNote: '18,000 players hang out in our Discord. The pizza channel is strictly off-limits.',
      credits: 'Made with ♥ and Unreal Engine 5',
    },
  },
};

export const SETTING_DEFAULTS: Record<string, unknown> = {
  'site.brand': {
    name: 'Brainchild Games',
    shortName: 'Brainchild',
    tagline: 'Play. Discover. Repeat.',
  },
  'site.social': [
    { name: 'Discord', url: 'https://discord.gg/brainchild', icon: 'MessageCircle' },
    { name: 'X / Twitter', url: 'https://x.com/brainchildgames', icon: 'Twitter' },
    { name: 'YouTube', url: 'https://youtube.com/@brainchildgames', icon: 'Youtube' },
    { name: 'Twitch', url: 'https://twitch.tv/brainchildgames', icon: 'Twitch' },
  ],
  'site.audience': {
    discordMembers: 18000,
    newsletterReaders: 12400,
    newsletterBadge: '1 email / month',
  },
  'site.seo': {
    title: 'Brainchild Games — Play. Discover. Repeat.',
    description:
      'Brainchild Games is a playful home for handcrafted worlds: discover sky-island adventures, golden-sea expeditions, surreal puzzles and co-op heists. Good games. Good times.',
  },
  'site.commerce': {
    defaultCurrency: 'USD',
    saleBadge: 'ON SALE',
    wishlistEnabled: true,
  },
  'players.registration': {
    registrationOpen: true,
    welcomeMessage: 'Welcome to the Brainchild fleet!',
  },
};

export const CONTENT_SECTIONS = ['about', 'contact', 'careers', 'home', 'footer'] as const;

export function defaultContentMap(): Record<string, { section: string; value: unknown }> {
  return CONTENT_DEFAULTS;
}

export function defaultSettingsMap(): Record<string, unknown> {
  return SETTING_DEFAULTS;
}
