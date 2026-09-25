import React, { useRef } from 'react';
import { Play, ArrowRight, Star, Heart } from 'lucide-react';
import { motion, useScroll, useTransform } from 'motion/react';
import { useStudio } from '../../context/StudioContext';
import { platformShort } from '../../utils/catalog';
import { TrophyBit, CoinBit } from '../ui/Bits';
import { assetUrl } from '../../utils/asset';

export const FeaturedGameSection: React.FC = () => {
  const { games, setSelectedGame, toggleWishlist, isWishlisted, setCurrentRoute } = useStudio();
  const featured = games.find((g) => g.featured) || games[0];
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['4%', '-4%']);

  if (!featured) return null;
  const wished = isWishlisted(featured.id);

  return (
    <section id="featured-game-section" className="relative py-10 sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        <div
          ref={ref}
          className="relative overflow-hidden rounded-[36px] border-2 border-ink shadow-lift"
        >
          {/* Artwork with gentle parallax */}
          <motion.img
            style={{ y }}
            src={assetUrl("/images/art_week_wide.jpg")}
            alt="The connected worlds of Brainchild Games"
            className="absolute inset-0 h-[112%] w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-ink/92 via-ink/60 to-ink/10" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent" aria-hidden="true" />

          {/* Floating badges */}
          <span className="absolute right-6 top-8 rotate-6 rounded-full border-2 border-ink bg-lime px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-ink shadow-sticker-sm animate-bob sm:right-12 sm:top-12">
            98% players love it
          </span>
          <span className="absolute right-16 top-32 hidden -rotate-6 rounded-full border-2 border-ink bg-coral px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-sticker-sm animate-float md:block">
            New
          </span>
          <span className="absolute bottom-24 right-8 hidden rotate-3 rounded-full border-2 border-ink bg-grape px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-sticker-sm animate-float-slow md:block">
            Editor’s pick
          </span>
          <div className="absolute bottom-10 right-14 hidden lg:block" aria-hidden="true">
            <CoinBit className="w-12 animate-float" />
          </div>

          {/* Content */}
          <div className="relative z-10 px-6 py-16 sm:px-12 sm:py-20 lg:px-20 lg:py-24">
            <div className="max-w-xl space-y-6">
              <span className="inline-flex -rotate-2 items-center gap-2 rounded-full border-2 border-ink bg-sun px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-ink shadow-sticker-sm">
                <TrophyBit className="w-4" /> Game of the week
              </span>

              <div>
                <div className="text-xs font-extrabold uppercase tracking-[0.3em] text-sun">
                  {featured.subtitle}
                </div>
                <h2 className="mt-2 font-display text-5xl font-extrabold uppercase leading-[0.92] tracking-tight text-paper sm:text-7xl">
                  {featured.title}
                </h2>
              </div>

              <p className="text-lg font-medium italic leading-relaxed text-paper/90">
                “An unforgettable adventure — like catching an updraft on a paper plane the size of a
                island.”
              </p>
              <p className="max-w-md text-sm font-medium leading-relaxed text-paper/75">
                {featured.description}
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  onClick={() => setCurrentRoute('games')}
                  className="group inline-flex items-center gap-2.5 rounded-xl border-2 border-ink bg-coral px-7 py-4 text-sm font-extrabold uppercase tracking-wide text-white shadow-sticker transition-all hover:-translate-y-1 hover:bg-coraldeep hover:shadow-[6px_6px_0_0_var(--color-ink)] active:translate-y-0 cursor-pointer"
                >
                  <Play size={15} className="fill-white" /> Play now
                </button>
                <button
                  onClick={() => setSelectedGame(featured)}
                  className="group inline-flex items-center gap-2.5 rounded-xl border-2 border-paper/70 bg-paper/10 px-7 py-4 text-sm font-extrabold uppercase tracking-wide text-paper backdrop-blur-sm transition-all hover:-translate-y-1 hover:bg-paper hover:text-ink cursor-pointer"
                >
                  View game
                  <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                </button>
                <button
                  onClick={() => toggleWishlist(featured.id)}
                  aria-label="Toggle wishlist"
                  className={`grid h-12 w-12 place-items-center rounded-xl border-2 border-ink transition-all hover:scale-105 cursor-pointer ${
                    wished ? 'bg-coral text-white' : 'bg-paper text-ink'
                  }`}
                >
                  <Heart size={18} className={wished ? 'fill-white' : ''} />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 text-xs font-bold uppercase tracking-wider text-paper/80">
                <span className="inline-flex items-center gap-1.5">
                  <Star size={13} className="fill-sun text-sun" /> {featured.rating?.toFixed(1) ?? '4.9'}
                </span>
                <span className="h-1 w-1 rounded-full bg-paper/40" />
                <span>{platformShort(featured.platforms)}</span>
                <span className="h-1 w-1 rounded-full bg-paper/40" />
                <span>{featured.releaseYear}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
