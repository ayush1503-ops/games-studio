import { Game, Article, Job, StudioTimelineItem, TeamMember } from '../types';

export const INITIAL_GAMES: Game[] = [
  {
    id: 'game-01',
    slug: 'aetherbound-echoes-of-zero',
    title: 'AETHERBOUND',
    subtitle: 'Echoes of Zero',
    genre: 'Sky-Island Adventure',
    categories: ['Adventure', 'Action', 'Indie'],
    rating: 4.9,
    price: 'Wishlist free',
    platforms: ['PC (Steam)', 'PlayStation 5', 'Xbox Series X|S'],
    status: 'Wishlist Now',
    releaseYear: 'Q4 2026',
    description:
      'Swing, glide and grapple across floating sky-islands where waterfalls fall forever into a sea of clouds.',
    longDescription:
      'In Aetherbound you play a young cartographer charting a sky full of drifting islands. Ride warm wind currents, tether-grapple between vine-wrapped ruins, and wake the ancient wind shrines that keep the whole archipelago afloat. Every island is a little pocket world: a garden, a bell tower, a sleepy village, a storm you can surf.',
    heroImage: '/images/art_aetherbound.jpg',
    secondaryImage: '/images/art_week_wide.jpg',
    screenshots: [
      '/images/art_aetherbound.jpg',
      '/images/art_week_wide.jpg',
      '/images/art_chrono.jpg'
    ],
    tags: ['Sky Islands', 'Grapple', 'Exploration', 'Feel-Good', 'Single Player'],
    features: [
      'Momentum-based tether grappling with zero loading screens between islands',
      'A living sky: weather fronts, hot-air currents and cloud seas that react to you',
      'Hand-painted shrines, bell towers and villages full of small friendly stories',
      'A collectible sticker journal that records every island you chart'
    ],
    gameplayMechanics: [
      {
        title: 'Tether Swing',
        description:
          'Fire your coral tether into any grapple point and swing with real weight and momentum — easy to learn, delicious to master.'
      },
      {
        title: 'Wind Reading',
        description:
          'Watch the clouds and banners to spot rising currents that launch you across huge gaps in a single breath.'
      },
      {
        title: 'Shrine Tuning',
        description:
          'Ring the old wind shrines in the right order to rebuild bridges of solid breeze between broken islands.'
      }
    ],
    devStory:
      'Born in a greybox room where we spent three months doing nothing but swinging at a wall and laughing. If the swing stopped feeling good, we threw the build away and started again.',
    storeLinks: [
      { name: 'Steam', url: '#steam', badge: 'Wishlist' },
      { name: 'PlayStation Store', url: '#psn', badge: 'Coming Soon' },
      { name: 'Xbox', url: '#xbox', badge: 'Coming Soon' }
    ],
    awards: ['Best Art Direction Nominee — Indie Game Festival', 'Most Anticipated World — PlayForward 2025'],
    featured: true
  },
  {
    id: 'game-02',
    slug: 'solaris-diver',
    title: 'SOLARIS DIVER',
    subtitle: 'Into the Corona',
    genre: 'Golden-Sea Expedition RPG',
    categories: ['RPG', 'Adventure'],
    rating: 4.7,
    price: '$24.99',
    platforms: ['PC (Steam / GOG)', 'Mac'],
    status: 'Early Access',
    releaseYear: 'Live Now',
    description:
      'Pilote a cozy little submarine through an ocean of liquid light, harvesting glowing anomalies before the tide turns.',
    longDescription:
      'Solaris Diver puts you at the helm of a round, creaky, loveable diving bell. Balance heat, ballast and crew morale as you descend through golden currents, tether shining cores back to the surface, and trade them for a bigger bell, a faster propeller, and a very unnecessary brass horn.',
    heroImage: '/images/art_solaris.jpg',
    secondaryImage: '/images/art_aetherbound.jpg',
    screenshots: [
      '/images/art_solaris.jpg',
      '/images/art_week_wide.jpg',
      '/images/art_void.jpg'
    ],
    tags: ['Survival', 'Deep Dive', 'Procedural', 'Resource Management'],
    features: [
      'A warm, wobbling buoyancy sim that rewards patience and clever routes',
      'Over 80 hull plates, fins and lamps to kit out your diving bell',
      'A radio that picks up half-heard songs from other divers down in the glow'
    ],
    gameplayMechanics: [
      {
        title: 'Thermal Drift',
        description:
          'Ride warm updrafts to save ballast, then vent heat in time before your glass dome foggs up.'
      },
      {
        title: 'Light Harpoons',
        description:
          'Tether unstable glow-cores and reel them in through swirling golden currents without snapping the line.'
      }
    ],
    devStory:
      'Created after a studio trip to a bioluminescent bay in Puerto Rico. We wanted that exact feeling: dark water, glowing everywhere, and nobody wanting to go back to shore.',
    storeLinks: [
      { name: 'Steam Early Access', url: '#steam', badge: 'Play Now ($24.99)' },
      { name: 'GOG', url: '#gog', badge: 'DRM-Free' }
    ],
    awards: ['Innovation in Audio Excellence 2024'],
    featured: false
  },
  {
    id: 'game-03',
    slug: 'chrono-monolith',
    title: 'CHRONO MONOLITH',
    subtitle: 'The Architecture of Time',
    genre: 'Surreal Puzzle Mystery',
    categories: ['Puzzle', 'Indie'],
    rating: 4.8,
    price: 'Wishlist free',
    platforms: ['PC', 'Nintendo Switch', 'PlayStation 5'],
    status: 'In Development',
    releaseYear: '2026',
    description:
      'Rewind, shatter and rebuild impossible marble ruins that exist in three time periods at once.',
    longDescription:
      'A contemplative puzzle odyssey set in a desert that refuses to settle on a century. Every structure exists simultaneously as fresh-built, golden-age and crumbled ruin. Slide between the three eras to reconnect aqueducts, freeze sandfalls into climbable stairs, and wake the stone automata who still remember the architects.',
    heroImage: '/images/art_chrono.jpg',
    secondaryImage: '/images/art_aetherbound.jpg',
    screenshots: ['/images/art_chrono.jpg', '/images/art_week_wide.jpg'],
    tags: ['Puzzle', 'Narrative', 'Architecture', 'Stylized', 'Cozy Brain-Bender'],
    features: [
      'Seamless triple-era sliding with zero loading delay',
      'Impossible staircases and Escher-flavoured courtyards that always play fair',
      'An orchestral score recorded with broken tape delays and a very patient cellist'
    ],
    gameplayMechanics: [
      {
        title: 'Tri-Phase Slicing',
        description:
          'Split your chamber between past and future planes to step through doors that have not been carved yet.'
      },
      {
        title: 'Entropy Reversion',
        description:
          'Freeze a collapsing sandfall mid-fall and climb it like a marble staircase.'
      }
    ],
    devStory:
      'Inspired by a rainy week spent sketching brutalist chapels and arguing about whether ruins are sadder or happier than new buildings.',
    storeLinks: [
      { name: 'Steam', url: '#steam', badge: 'Wishlist' },
      { name: 'Nintendo eShop', url: '#eshop', badge: 'Coming Soon' }
    ],
    awards: ['Selected for BitSummit Showcase Kyoto'],
    featured: false
  },
  {
    id: 'game-04',
    slug: 'void-protocol',
    title: 'VOID PROTOCOL',
    subtitle: 'The Great Rooftop Caper',
    genre: 'Co-op Heist Action',
    categories: ['Action', 'Indie'],
    rating: 4.6,
    price: 'Alpha soon',
    platforms: ['PC', 'Xbox Series X|S', 'PlayStation 5'],
    status: 'In Development',
    releaseYear: '2027',
    description:
      'Plan the perfect rooftop heist with three friends, then watch it gloriously survive contact with reality.',
    longDescription:
      'Void Protocol blends a chill planning phase with a fizzy real-time caper. Mark the guard routes, rig the zip-lines, assign who carries the snacks — then execute together as four gloriously mismatched thieves across a city of round towers, string lights and very confused pigeons.',
    heroImage: '/images/art_void.jpg',
    secondaryImage: '/images/art_solaris.jpg',
    screenshots: ['/images/art_void.jpg', '/images/art_week_wide.jpg'],
    tags: ['Tactical', 'Co-op', 'Heist', 'Stealth', 'Comedy'],
    features: [
      'A sync-planner: draw the plan in seconds, execute it in fluid real-time',
      'Four asymmetric roles: Infiltrator, Rigger, Heavy and Lookout',
      'Every heist ends with a replay card of your best (and worst) moment'
    ],
    gameplayMechanics: [
      {
        title: 'Synchro-Breach',
        description:
          'Queue simultaneous entries down to the frame — or panic and improvise, which also works, sometimes.'
      }
    ],
    devStory:
      'Born from friday-night co-op sessions where the plan never survived the first guard. We decided that was the game.',
    storeLinks: [{ name: 'Steam', url: '#steam', badge: 'Wishlist' }],
    featured: false
  }
];

export const INITIAL_NEWS: Article[] = [
  {
    id: 'article-01',
    slug: 'crafting-weightless-gliding-in-aetherbound',
    title: 'Defying Gravity: How We Made Gliding Feel Like a Deep Breath',
    category: 'DEVLOG',
    date: 'SEPTEMBER 2026',
    readTime: '6 MIN READ',
    excerpt:
      'How we threw out conventional third-person camera rules to build a wind-current flight system that feels weightless yet completely under control.',
    content: `When we began prototyping Aetherbound in early 2023, our biggest challenge was comfort: in a world with no floor, traditional cameras become disorienting within minutes.

To solve this, our technical director designed what we call the "Horizon Anchor Algorithm". Rather than forcing the camera to roll against an arbitrary world vector, it builds a soft optical horizon from your last three swing impulses and the curve of the nearest island.

### The Physics of Cloud Drifts

Every particle in the cloud sea carries a dynamic velocity vector. When you fire your tether into a vine-wrapped ruin, tension propagates through custom spline spring dampers. You do not just snap to the rock — you feel the island sway slightly under your weight.

### Sound Where There Is Only Wind

Your tether hums, the canvas of your glide-suit flaps, and distant shrines chime when a weather front passes. We recorded over 400 real mechanical impacts using contact mics on playground swings, boat rigging and old church bells around Montreal.`,
    coverImage: '/images/art_aetherbound.jpg',
    author: {
      name: 'Elena Rostova',
      role: 'Lead Systems & Physics Programmer'
    },
    tags: ['Physics Engine', 'Game Feel', 'Aetherbound'],
    featured: true,
    published: true
  },
  {
    id: 'article-02',
    slug: 'meet-pix-the-heart-of-brainchild',
    title: 'Meet Pix: The Little Robot Who Became Our Studio Heart',
    category: 'BEHIND THE SCENES',
    date: 'AUGUST 2026',
    readTime: '4 MIN READ',
    excerpt:
      'Why a chunky cream-and-coral robot with a purple controller became the guiding mascot for our studio culture.',
    content: `When Brainchild Games was founded in 2019, we didn't want a cold geometric badge or an aggressive predator logo. We wanted a player. A buddy who is curious rather than competitive, who holds a controller slightly too big for its hands and grins anyway.

Pix was born in an old sketchbook during a late train ride. The star-tipped antenna represents the small spark of every new prototype. The coral joints stand for human warmth, and the purple controller is a playful nod to the four-button pads we grew up on.

Whenever a new member joins the studio, they receive an enamel Pix pin and a tiny desk statue. Pix reminds us why we make games: that childhood feeling of pressing start and believing, completely, that something wonderful is on the other side of the screen.`,
    coverImage: '/images/mascot_pix.png',
    author: {
      name: 'Julian Vance',
      role: 'Creative Director & Co-Founder'
    },
    tags: ['Studio Culture', 'Brand Identity', 'Character Design'],
    featured: false,
    published: true
  },
  {
    id: 'article-03',
    slug: 'solaris-diver-major-update-prominence',
    title: 'Solaris Diver: Update 0.8 "Prominence" Is Live on Steam',
    category: 'ANNOUNCEMENT',
    date: 'JULY 2026',
    readTime: '3 MIN READ',
    excerpt:
      'Dive deeper into the golden sea with 14 new hull modules, dynamic light-storms, and expanded radio lore.',
    content: `Update 0.8 is our largest Early Access content drop to date for Solaris Diver. Based on feedback from over 45,000 divers, we have overhauled the core heat dispersion mechanics and added two completely new deep-glow biomes: the Prominence Hollows and the Lantern Trench.

Check out the full patch notes on our Steam community hub, or hop into our studio Discord to share your bell loadouts!`,
    coverImage: '/images/art_solaris.jpg',
    author: {
      name: 'Kai Takahashi',
      role: 'Lead Producer'
    },
    tags: ['Solaris Diver', 'Patch Notes', 'Early Access'],
    featured: false,
    published: true
  },
  {
    id: 'article-04',
    slug: 'music-of-the-monolith-analog-synthesis',
    title: 'Sounding the Monolith: Broken Synths, Cellos & Sand',
    category: 'DEVLOG',
    date: 'JUNE 2026',
    readTime: '5 MIN READ',
    excerpt:
      'Behind the warm, crumbling soundscapes shaping the surreal architectural puzzles of Chrono Monolith.',
    content: `For Chrono Monolith, standard orchestral strings felt too tidy. We wanted a score that sounds like old stone stretching in the sun.

We brought vintage tape delays, custom resonant filters and microtonal cello bowing into an abandoned chapel in Normandy to capture pure natural reverberation. The resulting textures pulse gently as you slide between the three eras of every structure.`,
    coverImage: '/images/art_chrono.jpg',
    author: {
      name: 'Sariel Moreau',
      role: 'Audio Director'
    },
    tags: ['Sound Design', 'Chrono Monolith', 'Music'],
    featured: false,
    published: true
  },
  {
    id: 'article-05',
    slug: 'void-protocol-coop-alpha-signups',
    title: 'Void Protocol: Co-op Alpha Sign-ups Are Open',
    category: 'NEWS',
    date: 'SEPTEMBER 2026',
    readTime: '2 MIN READ',
    excerpt:
      'Grab three friends and your best bad ideas: the first closed alpha of our rooftop caper opens next month.',
    content: `The first closed alpha of Void Protocol opens next month for squads of four. Alpha crews will get access to two full heists, the sync-planner, and a feedback channel straight to the design team.

We are specifically looking for squads who talk too much on voice chat. That is the target demographic, apparently.`,
    coverImage: '/images/art_void.jpg',
    author: {
      name: 'Kai Takahashi',
      role: 'Lead Producer'
    },
    tags: ['Void Protocol', 'Alpha', 'Co-op'],
    featured: false,
    published: true
  },
  {
    id: 'article-06',
    slug: 'game-jam-week-41-prototypes',
    title: 'Jam Week: 41 Prototypes, 5 Days, One Very Tired Pizza Oven',
    category: 'COMMUNITY',
    date: 'MAY 2026',
    readTime: '4 MIN READ',
    excerpt:
      'Our whole-studio jam produced a pigeon dating sim, a bell-ringing rhythm game, and the seed of our next unannounced title.',
    content: `Every spring we shut down production for one week and jam. The only rule: the prototype must make someone in the room laugh or gasp within fifteen seconds.

This year's highlights include "Pigeon Protocol" (now merged into Void Protocol's lookout role), "Bellhop" (a shrine-ringing rhythm toy), and a one-button glider that quietly became the seed of our next unannounced world.`,
    coverImage: '/images/art_studio.jpg',
    author: {
      name: 'Maya Lin-Torvalds',
      role: 'Technical Director & Co-Founder'
    },
    tags: ['Game Jam', 'Studio Life', 'Prototypes'],
    featured: false,
    published: true
  }
];

export const INITIAL_JOBS: Job[] = [
  {
    id: 'job-01',
    title: 'Lead Systems & Physics Programmer',
    department: 'Engineering',
    location: 'Montreal, Canada / Remote (Americas & EU)',
    type: 'Full-time',
    experience: 'Lead',
    description:
      'Lead the design and implementation of the swing, glide and wind systems that make our worlds feel alive under the player’s hands.',
    responsibilities: [
      'Architect and optimize real-time physics and movement systems in Unreal Engine 5 (C++)',
      'Tune kinematic feel, momentum preservation and responsive control with game designers',
      'Mentor a tight-knit team of 6 systems and gameplay engineers',
      'Profile memory, cache locality and thread budgets across PC, PS5 and Xbox Series X'
    ],
    requirements: [
      '7+ years of gameplay and systems engineering with at least 1 shipped high-profile title',
      'Deep mastery of modern C++, vector math, rigid body dynamics and engine optimization',
      'Proven track record building bespoke character controllers or vehicle physics',
      'Passion for game feel, micro-feedback and tactile responsiveness'
    ],
    niceToHave: [
      'Experience with custom HLSL/GLSL compute shaders for particle simulation',
      'Familiarity with network prediction for physics-driven co-op play'
    ],
    perks: [
      'Competitive salary with a generous project profit-sharing pool',
      'Comprehensive health, dental and wellness coverage',
      'Flexible 4-day work week (Monday–Thursday, 36 hours)',
      '$4,000 annual home office & gaming hardware stipend',
      'Annual studio retreat to a cabin with questionable Wi-Fi and excellent board games'
    ],
    status: 'open',
    postedDate: 'SEPTEMBER 2026'
  },
  {
    id: 'job-02',
    title: 'Senior 3D Environment Artist',
    department: 'Art & Animation',
    location: 'Remote (Worldwide)',
    type: 'Full-time',
    experience: 'Senior',
    description:
      'Shape the sky-islands, marble deserts and rooftop cities that define the Brainchild look: warm, bold, and a little bit whimsical.',
    responsibilities: [
      'Build modular environment kits, hero props and stylized landscape shaders',
      'Establish technical art pipelines for Nanite, Lumen and custom volumetric skies',
      'Push color balance, focal lighting and architectural mood with the Art Director',
      'Optimize geometry and texture budgets without sacrificing painterly fidelity'
    ],
    requirements: [
      '5+ years of 3D environment production for games',
      'A portfolio of stylized worlds with a distinct, confident art direction',
      'Expertise in Blender/Maya, Substance and Unreal Engine 5 shader graph',
      'Firm grasp of lighting theory, composition and visual storytelling'
    ],
    niceToHave: ['Experience with Houdini procedural asset generation', 'Stylized sculpting proficiency in ZBrush'],
    perks: [
      'Full health benefits & wellness allowance',
      'Flexible asynchronous hours across timezones',
      'Generous gear & software license provisions',
      'Profit sharing on all studio releases'
    ],
    status: 'open',
    postedDate: 'AUGUST 2026'
  },
  {
    id: 'job-03',
    title: 'Senior Narrative Designer & Worldbuilder',
    department: 'Game Design',
    location: 'Montreal / Hybrid',
    type: 'Full-time',
    experience: 'Senior',
    description:
      'Write the small, human stories hidden inside our worlds: shrine inscriptions, village gossip, radio chatter and bell-tower secrets.',
    responsibilities: [
      'Write in-world documents, audio logs, signage and warm, funny dialogue',
      'Embed narrative clues subtly inside environmental architecture',
      'Maintain the studio’s overarching Worldbuilding Bible across all titles'
    ],
    requirements: [
      '4+ years of professional narrative design or game writing',
      'A writing sample demonstrating subtle, evocative, non-expository storytelling',
      'Ability to integrate narrative mechanics directly into gameplay systems'
    ],
    niceToHave: [
      'Background in speculative fiction, poetry or architectural history',
      'Experience scripting branching dialogue in Ink or Twine'
    ],
    perks: ['Book purchase stipend & festival attendance', '4-day work week and generous paid time off', 'Studio profit sharing'],
    status: 'open',
    postedDate: 'SEPTEMBER 2026'
  },
  {
    id: 'job-04',
    title: 'Audio Director & Sound Designer',
    department: 'Audio',
    location: 'Remote / Montreal',
    type: 'Full-time',
    experience: 'Director',
    description:
      'Direct the auditory soul of Brainchild Games: creaking bells, flapping canvas, broken synths and one very patient cello.',
    responsibilities: [
      'Establish the auditory identity for all Brainchild titles from concept to ship',
      'Design, record and process bespoke foley and synthetic sound palettes',
      'Implement interactive audio graphs in Wwise / UE5 Sound Cues'
    ],
    requirements: [
      '6+ years of sound design in games with at least 1 shipped title as Lead or Director',
      'Expertise in Pro Tools / Reaper, modular synthesis and Wwise',
      'An exceptional ear for unconventional, emotional sound palettes'
    ],
    niceToHave: ['Experience recording real-world industrial foley', 'C++ or visual scripting for procedural audio triggers'],
    perks: ['Dedicated studio sound lab budget', 'Profit sharing & comprehensive healthcare', '4-day work week'],
    status: 'open',
    postedDate: 'AUGUST 2026'
  }
];

export const STUDIO_TIMELINE: StudioTimelineItem[] = [
  {
    year: '2019',
    title: 'THE SPARK IN THE BASEMENT',
    description:
      'Founded by two indie developers tired of predictable mechanics, with a single manifesto taped to the wall: "Build places you want to inhabit."',
    tag: 'ORIGIN'
  },
  {
    year: '2021',
    title: 'BIRTH OF PIX',
    description:
      'We sketch our mascot Pix on a late train ride, and ship our first physics toy "Cloudhop", winning Best Indie Prototype at a jam with 400 entries.',
    tag: 'MILESTONE'
  },
  {
    year: '2023',
    title: 'SOLARIS DIVER UNVEILED',
    description:
      'Our golden-sea expedition launches into Early Access to warm critical reception, crossing 100,000 wishlists in its first month.',
    tag: 'RELEASE'
  },
  {
    year: '2025',
    title: 'TEAM EXPANSION & UNREAL 5',
    description:
      'The studio grows to 28 artists, programmers and composers worldwide, and Aetherbound moves fully onto Unreal Engine 5.',
    tag: 'EXPANSION'
  },
  {
    year: '2026 & BEYOND',
    title: 'THE NEXT SHELF',
    description:
      'Preparing the global launch of Aetherbound: Echoes of Zero while prototyping two radical new genre experiments in the jam room.',
    tag: 'PRESENT'
  }
];

export const TEAM_MEMBERS: TeamMember[] = [
  {
    name: 'Julian Vance',
    role: 'Creative Director & Co-Founder',
    bio: 'Former architect turned worldbuilder. Obsessed with bell towers, swing physics and modular analog synthesizers.',
    favoriteGame: 'Outer Wilds & Shadow of the Colossus',
    photoColor: '#ff5a3c'
  },
  {
    name: 'Maya Lin-Torvalds',
    role: 'Technical Director & Co-Founder',
    bio: 'Veteran graphics and physics architect. Loves rendering volumetric clouds, writing compute shaders, and brewing dark roast espresso.',
    favoriteGame: 'Homeworld & Metroid Prime',
    photoColor: '#6c4cf1'
  },
  {
    name: 'Elena Rostova',
    role: 'Lead Systems Programmer',
    bio: 'Mathematics enthusiast who believes every mechanic should have weight and inertia. Built Aetherbound’s tether-swing model.',
    favoriteGame: 'Kerbal Space Program & Portal 2',
    photoColor: '#ffc53d'
  },
  {
    name: 'Sariel Moreau',
    role: 'Audio Director',
    bio: 'Sound sculptor who records creaking bells in abandoned chapels and turns them into skies full of wind.',
    favoriteGame: 'Silent Hill 2 & Journey',
    photoColor: '#2fb9dd'
  }
];
