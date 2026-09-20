import React from 'react';
import { Heart, Star, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Game } from '../../types';
import { useStudio } from '../../context/StudioContext';
import { statusColor, platformShort, gameCategories, CATEGORY_COLORS } from '../../utils/catalog';
import { StarSticker } from '../ui/Bits';

interface GameCardProps {
  game: Game;
  index?: number;
  wide?: boolean;
}

/** A collectible-card style game tile: lifts, zooms, reveals info & CTA on hover. */
export const GameCard: React.FC<GameCardProps> = ({ game, index = 0, wide = false }) => {
  const { setSelectedGame, toggleWishlist, isWishlisted } = useStudio();
  const wished = isWishlisted(game.id);
  const cats = gameCategories(game).slice(0, 2);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.06, 0.3), ease: [0.22, 1, 0.36, 1] }}
      className={`group relative shrink-0 snap-start ${wide ? 'w-full' : 'w-[270px] sm:w-[300px] lg:w-auto'}`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => setSelectedGame(game)}
        onKeyDown={(e) => e.key === 'Enter' && setSelectedGame(game)}
        className="relative cursor-pointer rounded-[26px] border-2 border-ink/10 bg-cream p-3 shadow-soft transition-all duration-300 ease-out group-hover:-translate-y-2 group-hover:border-ink/25 group-hover:shadow-lift focus:outline-none focus-visible:ring-4 focus-visible:ring-grape/40"
      >
        {/* Artwork */}
        <div className="relative overflow-hidden rounded-[18px] border-2 border-ink/10">
          <div className={wide ? 'aspect-[16/10]' : 'aspect-[4/5]'}>
            <img
              src={game.heroImage}
              alt={`${game.title} key art`}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Status sticker */}
          <span
            className={`absolute left-3 top-3 -rotate-3 rounded-full border-2 border-ink px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider shadow-sticker-sm ${statusColor(
              game.status
            )}`}
          >
            {game.status}
          </span>

          {/* Wishlist heart */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleWishlist(game.id);
            }}
            aria-label={wished ? `Remove ${game.title} from wishlist` : `Add ${game.title} to wishlist`}
            className={`absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full border-2 border-ink transition-all duration-200 cursor-pointer ${
              wished ? 'bg-coral text-white scale-105' : 'bg-cream/95 text-ink hover:bg-cream hover:scale-110'
            }`}
          >
            <Heart size={16} className={wished ? 'fill-white' : ''} />
          </button>

          {/* Rating chip */}
          {typeof game.rating === 'number' && (
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full border-2 border-ink bg-cream/95 px-2.5 py-0.5 text-[11px] font-extrabold">
              <Star size={11} className="fill-sun text-sun" />
              {game.rating.toFixed(1)}
            </span>
          )}

          {/* Hover reveal: extra info + CTA */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-4 bg-gradient-to-t from-ink/85 via-ink/45 to-transparent p-3 pt-10 opacity-0 transition-all duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100">
            <div className="flex items-end justify-between gap-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-paper/90">
                {platformShort(game.platforms)}
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-coral px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                View game <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </div>

          {/* Playful spinning star on hover */}
          <StarSticker className="absolute -right-2 -top-2 w-8 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:rotate-[20deg] animate-spin-slow" />
        </div>

        {/* Meta */}
        <div className="space-y-2 px-2 pb-2 pt-3.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-lg font-extrabold uppercase leading-tight tracking-tight text-ink transition-colors group-hover:text-grape">
              {game.title}
            </h3>
            <span className="mt-0.5 shrink-0 text-xs font-extrabold text-ink">{game.price ?? game.releaseYear}</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {cats.map((c) => (
              <span
                key={c}
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${CATEGORY_COLORS[c]}`}
              >
                {c}
              </span>
            ))}
            <span className="text-[11px] font-medium text-inksoft">{game.genre}</span>
          </div>
        </div>
      </div>
    </motion.article>
  );
};
