import React from 'react';
import { ArrowRight, ArrowDown, Newspaper, Star, Heart, Play } from 'lucide-react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { useStudio } from '../../context/StudioContext';
import { Sticker } from '../ui/Reveal';
import {
  ControllerBit,
  CartridgeBit,
  CoinBit,
  DiceBit,
  JoystickBit,
  StarSticker,
  Squiggle
} from '../ui/Bits';
import { platformShort, statusColor } from '../../utils/catalog';

/** Fallback text — overridden by the “home.hero” block in the CMS. */
const DEFAULT_HERO = {
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
};

export const HeroSection: React.FC = () => {
  const { setCurrentRoute, games, setSelectedGame, toggleWishlist, isWishlisted, block } = useStudio();
  const hero = block('home.hero', DEFAULT_HERO);
  const ticker = hero.ticker?.length ? hero.ticker : DEFAULT_HERO.ticker;
  const featured = games.find((g) => g.featured) || games[0];

  // Pointer position (0..1) over the hero stage
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);

  // Normalised, spring-smoothed axes for parallax layers
  const nx = useSpring(useTransform(mx, [0, 1], [-1, 1]), { stiffness: 110, damping: 20 });
  const ny = useSpring(useTransform(my, [0, 1], [-1, 1]), { stiffness: 110, damping: 20 });

  // Card tilt
  const rotateY = useSpring(useTransform(mx, [0, 1], [-7, 7]), { stiffness: 160, damping: 22 });
  const rotateX = useSpring(useTransform(my, [0, 1], [6, -6]), { stiffness: 160, damping: 22 });

  // Per-object parallax depths (px)
  const controllerX = useTransform(nx, (v) => v * 22);
  const controllerY = useTransform(ny, (v) => v * 14);
  const cartridgeX = useTransform(nx, (v) => v * -18);
  const cartridgeY = useTransform(ny, (v) => v * -12);
  const coinX = useTransform(nx, (v) => v * 30);
  const coinY = useTransform(ny, (v) => v * -18);
  const diceX = useTransform(nx, (v) => v * -26);
  const diceY = useTransform(ny, (v) => v * 16);
  const joystickX = useTransform(nx, (v) => v * 14);
  const joystickY = useTransform(ny, (v) => v * -22);
  const starX = useTransform(nx, (v) => v * -12);
  const starY = useTransform(ny, (v) => v * 20);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  };
  const onLeave = () => {
    mx.set(0.5);
    my.set(0.5);
  };

  const scrollToShelf = () => {
    const el = document.getElementById('discover-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const wished = featured ? isWishlisted(featured.id) : false;

  return (
    <section
      id="hero-section"
      className="relative flex min-h-screen flex-col justify-between overflow-hidden pt-28 sm:pt-32"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {/* Playful background washes */}
      <div className="pointer-events-none absolute -left-32 top-24 h-96 w-96 rounded-full bg-coral/15 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-24 top-40 h-[28rem] w-[28rem] rounded-full bg-grape/15 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute left-1/2 top-16 h-40 w-[36rem] -translate-x-1/2 bg-dots opacity-60" aria-hidden="true" />

      {/* ---- Top meta row (editorial composition) ---- */}
      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-[0.22em] text-inksoft">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-coral animate-bob" />
            <span className="text-ink">{hero.studioLine}</span>
          </div>
          <div className="hidden items-center gap-4 sm:flex">
            <span>{hero.est}</span>
            <span className="h-1 w-1 rounded-full bg-ink/30" />
            <span>{hero.worlds}</span>
            <span className="h-1 w-1 rounded-full bg-ink/30" />
            <span className="text-grape">{hero.motto}</span>
          </div>
        </div>
      </div>

      {/* ---- Middle: pitch + featured card with floating object cluster ---- */}
      <div className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 sm:py-12 lg:px-10">
        <div className="grid h-full grid-cols-1 items-center gap-14 lg:grid-cols-12 lg:gap-8">
          {/* LEFT: pitch */}
          <div className="lg:col-span-6 xl:col-span-6">
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <Sticker className="bg-sun text-ink" rotate={-2}>
                <StarSticker className="w-4" /> New release · Aetherbound
              </Sticker>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08 }}
              className="mt-6 font-display text-6xl font-extrabold uppercase leading-[0.9] tracking-tight text-ink sm:text-7xl xl:text-8xl"
            >
              Play.
              <br />
              <span className="text-grape">Discover.</span>
              <br />
              <span className="relative inline-block text-coral">
                Repeat.
                <Squiggle className="absolute -bottom-3 left-0 h-4 w-full" />
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.16 }}
              className="mt-7 max-w-md text-base font-medium leading-relaxed text-inksoft sm:text-lg"
            >
              Brainchild Games is a playful home for handcrafted worlds — sky-island adventures,
              golden-sea expeditions, impossible puzzles and rooftop capers. Pick a card, press
              start, stay a while.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.24 }}
              className="mt-8 flex flex-wrap items-center gap-4"
            >
              <button
                id="hero-cta-explore"
                onClick={() => setCurrentRoute('games')}
                className="group inline-flex items-center gap-2.5 rounded-xl border-2 border-ink bg-coral px-7 py-4 text-sm font-extrabold uppercase tracking-wide text-white shadow-sticker transition-all hover:-translate-y-1 hover:bg-coraldeep hover:shadow-[6px_6px_0_0_var(--color-ink)] active:translate-y-0 active:shadow-sticker-sm cursor-pointer"
              >
                Explore games
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </button>
              <button
                id="hero-cta-news"
                onClick={() => setCurrentRoute('news')}
                className="group inline-flex items-center gap-2.5 rounded-xl border-2 border-ink bg-cream px-7 py-4 text-sm font-extrabold uppercase tracking-wide text-ink shadow-sticker transition-all hover:-translate-y-1 hover:bg-sun hover:shadow-[6px_6px_0_0_var(--color-ink)] active:translate-y-0 active:shadow-sticker-sm cursor-pointer"
              >
                <Newspaper size={16} className="transition-transform group-hover:-rotate-12" />
                Latest news
              </button>
            </motion.div>

            {/* Playful proof chips */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.34 }}
              className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-bold uppercase tracking-wider text-inksoft"
            >
              <span className="inline-flex items-center gap-1.5">
                <Star size={13} className="fill-sun text-sun" /> {hero.rating}
              </span>
              <span className="h-1 w-1 rounded-full bg-ink/30" />
              <span>{hero.players}</span>
              <span className="h-1 w-1 rounded-full bg-ink/30" />
              <span>{hero.worlds}</span>
              <span className="h-1 w-1 rounded-full bg-ink/30" />
              <span>{hero.madeIn}</span>
            </motion.div>
          </div>

          {/* RIGHT: featured card orbited by floating game objects */}
          <div className="relative lg:col-span-6 xl:col-span-6">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              {/* halo + dot ring behind everything */}
              <div className="pointer-events-none absolute -inset-8 -rotate-3 rounded-[44px] bg-grape/10" aria-hidden="true" />
              <div
                className="pointer-events-none absolute -inset-14 rounded-full border-4 border-dashed border-ink/10 animate-spin-slow"
                aria-hidden="true"
              />

              {/* Floating 3D-style object cluster (parallax layers) */}
              <motion.div style={{ x: controllerX, y: controllerY }} className="pointer-events-none absolute -left-12 -top-12 z-20 sm:-left-16" aria-hidden="true">
                <ControllerBit className="w-24 rotate-[-10deg] drop-shadow-[0_14px_18px_rgba(38,32,43,0.28)] animate-float sm:w-28" />
              </motion.div>
              <motion.div style={{ x: cartridgeX, y: cartridgeY }} className="pointer-events-none absolute -right-8 -top-6 z-20 sm:-right-12" aria-hidden="true">
                <CartridgeBit className="w-16 rotate-[9deg] drop-shadow-[0_12px_16px_rgba(38,32,43,0.26)] animate-float-slow sm:w-20" />
              </motion.div>
              <motion.div style={{ x: joystickX, y: joystickY }} className="pointer-events-none absolute -top-14 left-1/3 z-0 hidden sm:block" aria-hidden="true">
                <JoystickBit className="w-16 rotate-[6deg] opacity-90 blur-[0.4px] drop-shadow-[0_10px_14px_rgba(38,32,43,0.22)] animate-bob" />
              </motion.div>
              <motion.div style={{ x: coinX, y: coinY }} className="pointer-events-none absolute -left-8 bottom-24 z-20 sm:-left-12" aria-hidden="true">
                <CoinBit className="w-14 rotate-[-6deg] drop-shadow-[0_10px_14px_rgba(38,32,43,0.25)] animate-float-slow sm:w-16" />
              </motion.div>
              <motion.div style={{ x: diceX, y: diceY }} className="pointer-events-none absolute -bottom-8 -right-6 z-20 sm:-right-10" aria-hidden="true">
                <DiceBit className="w-14 rotate-[12deg] drop-shadow-[0_12px_16px_rgba(38,32,43,0.25)] animate-bob sm:w-16" />
              </motion.div>
              <motion.div style={{ x: starX, y: starY }} className="pointer-events-none absolute -bottom-5 left-10 z-20" aria-hidden="true">
                <StarSticker className="w-9 rotate-[-8deg] animate-wiggle" />
              </motion.div>

              {/* Featured game card */}
              {featured && (
                <motion.div
                  initial={{ opacity: 0, y: 34, rotate: 1 }}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
                  style={{ rotateX, rotateY, transformPerspective: 1100 }}
                  className="relative z-10"
                >
                  <div className="relative rounded-[30px] border-2 border-ink bg-cream p-4 shadow-lift">
                    {/* art */}
                    <div className="relative overflow-hidden rounded-[20px] border-2 border-ink/10">
                      <img
                        src={featured.heroImage}
                        alt={`${featured.title} key art`}
                        className="aspect-[4/3] w-full object-cover"
                      />
                      <span
                        className={`absolute left-3 top-3 -rotate-3 rounded-full border-2 border-ink px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider shadow-sticker-sm ${statusColor(
                          featured.status
                        )}`}
                      >
                        {featured.status}
                      </span>
                      <span className="absolute right-3 top-3 rotate-6 rounded-full border-2 border-ink bg-sun px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider shadow-sticker-sm">
                        Featured
                      </span>
                    </div>

                    {/* body */}
                    <div className="space-y-3 px-2 pb-2 pt-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="rounded-full bg-grape px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white">
                          {featured.genre}
                        </span>
                        <span className="inline-flex items-center gap-1 text-sm font-extrabold text-ink">
                          <Star size={14} className="fill-sun text-sun" />
                          {featured.rating?.toFixed(1) ?? '4.9'}
                        </span>
                      </div>

                      <div>
                        <h2 className="font-display text-3xl font-extrabold uppercase tracking-tight text-ink">
                          {featured.title}
                        </h2>
                        <p className="mt-1.5 text-sm font-medium leading-relaxed text-inksoft">
                          {featured.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 pt-1">
                        <button
                          onClick={() => setCurrentRoute('games')}
                          className="group inline-flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-ink bg-grape px-5 py-3 text-xs font-extrabold uppercase tracking-wider text-white shadow-sticker-sm transition-all hover:-translate-y-0.5 hover:bg-grapedeep active:translate-y-0 cursor-pointer"
                        >
                          <Play size={13} className="fill-white" /> Play now
                        </button>
                        <button
                          onClick={() => setSelectedGame(featured)}
                          className="grid h-11 shrink-0 place-items-center rounded-xl border-2 border-ink bg-cream px-3.5 text-[10px] font-extrabold uppercase tracking-wider text-ink transition-all hover:-translate-y-0.5 hover:bg-sun cursor-pointer"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => toggleWishlist(featured.id)}
                          aria-label="Toggle wishlist"
                          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 border-ink transition-all hover:scale-105 cursor-pointer ${
                            wished ? 'bg-coral text-white' : 'bg-cream text-ink'
                          }`}
                        >
                          <Heart size={17} className={wished ? 'fill-white' : ''} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between border-t-2 border-dashed border-ink/15 pt-3 text-[11px] font-bold uppercase tracking-wider text-inksoft">
                        <span>{platformShort(featured.platforms)}</span>
                        <span className="text-ink">{featured.releaseYear}</span>
                      </div>
                    </div>
                  </div>

                  {/* floating stickers on the card */}
                  <span className="absolute -left-5 top-16 hidden -rotate-6 rounded-full border-2 border-ink bg-lime px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-ink shadow-sticker-sm animate-bob sm:block">
                    98% love it
                  </span>
                  <span className="absolute -right-4 bottom-24 hidden rotate-6 rounded-full border-2 border-ink bg-cream px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-ink shadow-sticker-sm animate-float sm:block">
                    Editor’s pick
                  </span>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ---- Bottom info row (editorial composition) ---- */}
      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between border-t-2 border-dashed border-ink/15 pt-5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-inksoft">
          <button
            onClick={scrollToShelf}
            className="group inline-flex items-center gap-2 text-ink transition-colors hover:text-coral cursor-pointer"
          >
            <span>Scroll to the game shelf</span>
            <ArrowDown size={14} className="animate-bob transition-colors group-hover:text-coral" />
          </button>
          <div className="hidden items-center gap-4 md:flex">
            <span>Current focus: Aetherbound (Q4 2026)</span>
            <span className="h-1 w-1 rounded-full bg-ink/30" />
            <span>PC · PS5 · Xbox</span>
          </div>
        </div>
      </div>

      {/* Ticker marquee */}
      <div className="relative -rotate-1 border-y-2 border-ink bg-ink py-3.5">
        <div className="flex w-max animate-marquee items-center gap-10 pr-10">
          {[...ticker, ...ticker].map((item, i) => (
            <span key={i} className="flex items-center gap-10 text-xs font-extrabold uppercase tracking-[0.2em] text-paper">
              {item}
              <StarSticker className="w-4" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};
