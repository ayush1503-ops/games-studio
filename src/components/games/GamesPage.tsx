import React, { useState } from 'react';
import { Ghost } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useStudio } from '../../context/StudioContext';
import { GameCategory } from '../../types';
import { GAME_CATEGORIES, gameCategories } from '../../utils/catalog';
import { GameCard } from './GameCard';
import { Reveal } from '../ui/Reveal';
import { Squiggle, JoystickBit } from '../ui/Bits';

type Filter = 'All' | GameCategory;

export const GamesPage: React.FC = () => {
  const { games, wishlist } = useStudio();
  const [filter, setFilter] = useState<Filter>('All');

  const filtered = filter === 'All' ? games : games.filter((g) => gameCategories(g).includes(filter));

  return (
    <div id="games-page" className="relative min-h-screen overflow-hidden pt-32 pb-24 sm:pt-36">
      <div className="pointer-events-none absolute -right-32 top-24 h-96 w-96 rounded-full bg-grape/10 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -left-24 top-1/2 h-80 w-80 rounded-full bg-coral/10 blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        {/* Header */}
        <Reveal className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-5">
            <span className="inline-flex -rotate-1 items-center gap-2 rounded-full border-2 border-ink bg-coral px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-white shadow-sticker-sm">
              🕹️ The full shelf
            </span>
            <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.92] tracking-tight text-ink sm:text-7xl">
              All our{' '}
              <span className="relative inline-block text-grape">
                worlds
                <Squiggle color="#6C4CF1" className="absolute -bottom-3 left-0 h-4 w-full" />
              </span>
            </h1>
            <p className="max-w-xl text-base font-medium leading-relaxed text-inksoft">
              Every world we have built, are building, or are secretly prototyping in the jam room.
              Flip a card to open its full dossier: mechanics, dev stories, screenshots and store
              links.
            </p>
          </div>

          <div className="flex items-center gap-4 lg:flex-col lg:items-end">
            <div className="rounded-2xl border-2 border-ink bg-cream px-5 py-3 shadow-sticker-sm">
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-inksoft">On the shelf</div>
              <div className="font-display text-2xl font-extrabold text-ink">{games.length} worlds</div>
            </div>
            <div className="rounded-2xl border-2 border-ink bg-sun px-5 py-3 shadow-sticker-sm">
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-ink/70">Your wishlist</div>
              <div className="font-display text-2xl font-extrabold text-ink">{wishlist.length} ♥</div>
            </div>
          </div>
        </Reveal>

        {/* Filters */}
        <Reveal delay={0.06} className="mt-12 flex flex-wrap gap-2.5">
          <button
            onClick={() => setFilter('All')}
            className={`rounded-full border-2 border-ink px-5 py-2.5 text-sm font-extrabold transition-all duration-200 cursor-pointer ${
              filter === 'All'
                ? '-rotate-1 scale-105 bg-ink text-paper shadow-sticker-sm'
                : 'bg-cream text-inksoft hover:-translate-y-0.5 hover:text-ink hover:shadow-sticker-sm'
            }`}
          >
            ✨ All
          </button>
          {GAME_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilter(cat.id)}
              className={`rounded-full border-2 border-ink px-5 py-2.5 text-sm font-extrabold transition-all duration-200 cursor-pointer ${
                filter === cat.id
                  ? '-rotate-1 scale-105 bg-grape text-white shadow-sticker-sm'
                  : 'bg-cream text-inksoft hover:-translate-y-0.5 hover:text-ink hover:shadow-sticker-sm'
              }`}
            >
              <span className="mr-1.5">{cat.emoji}</span>
              {cat.id}
            </button>
          ))}
        </Reveal>

        {/* Grid */}
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((game, i) => (
              <GameCard key={game.id} game={game} index={i} />
            ))}
          </AnimatePresence>
        </div>

        {filtered.length === 0 && (
          <div className="mt-10 flex flex-col items-center gap-3 rounded-[26px] border-2 border-dashed border-ink/25 bg-cream/60 p-14 text-center">
            <Ghost size={40} className="text-grape" />
            <p className="font-display text-2xl font-extrabold uppercase text-ink">Empty shelf!</p>
            <p className="max-w-sm text-sm font-medium text-inksoft">
              No {filter} worlds yet — but the jam room is warm and the coffee is on. Something new
              is always cooking.
            </p>
            <button
              onClick={() => setFilter('All')}
              className="mt-2 rounded-xl border-2 border-ink bg-sun px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider text-ink shadow-sticker-sm transition-transform hover:-translate-y-0.5 cursor-pointer"
            >
              Show everything
            </button>
          </div>
        )}

        {/* Footnote */}
        <Reveal delay={0.1} className="mt-14 flex items-center justify-center gap-3 text-center text-xs font-bold uppercase tracking-wider text-inksoft">
          <JoystickBit className="w-8 animate-bob" />
          Can’t decide? Pix recommends starting with Aetherbound. Pix is biased. Pix is also right.
        </Reveal>
      </div>
    </div>
  );
};
