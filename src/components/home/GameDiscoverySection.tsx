import React, { useState } from 'react';
import { ArrowRight, Ghost } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useStudio } from '../../context/StudioContext';
import { GameCategory } from '../../types';
import { GAME_CATEGORIES, gameCategories } from '../../utils/catalog';
import { GameCard } from '../games/GameCard';
import { Reveal } from '../ui/Reveal';
import { CartridgeBit, TrophyBit } from '../ui/Bits';

type Filter = 'All' | GameCategory;

export const GameDiscoverySection: React.FC = () => {
  const { games, setCurrentRoute } = useStudio();
  const [filter, setFilter] = useState<Filter>('All');

  const filtered = filter === 'All' ? games : games.filter((g) => gameCategories(g).includes(filter));

  return (
    <section id="discover-section" className="relative py-24 sm:py-28">
      <div className="pointer-events-none absolute right-6 top-10 hidden lg:block" aria-hidden="true">
        <TrophyBit className="w-14 animate-float" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        {/* Heading */}
        <Reveal className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-4">
            <span className="inline-flex -rotate-1 items-center gap-2 rounded-full border-2 border-ink bg-grape px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-white shadow-sticker-sm">
              🕹️ The shelf
            </span>
            <h2 className="font-display text-4xl font-extrabold uppercase leading-[0.95] tracking-tight text-ink sm:text-6xl">
              Find your <span className="text-coral">next</span> game
            </h2>
            <p className="max-w-lg text-base font-medium leading-relaxed text-inksoft">
              Handmade worlds, zero filler. Filter by mood, flip a card, and fall into something
              new.
            </p>
          </div>

          <button
            onClick={() => setCurrentRoute('games')}
            className="group inline-flex items-center gap-2 self-start rounded-xl border-2 border-ink bg-cream px-5 py-3 text-xs font-extrabold uppercase tracking-wider text-ink shadow-sticker-sm transition-all hover:-translate-y-0.5 hover:bg-sun md:self-auto cursor-pointer"
          >
            Browse all {games.length} worlds
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
          </button>
        </Reveal>

        {/* Category pills */}
        <Reveal delay={0.08} className="mt-10 flex flex-wrap gap-2.5">
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

        {/* Cards: horizontal rail on mobile, grid on desktop */}
        <div className="no-scrollbar mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-6 lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-2">
          <AnimatePresence mode="popLayout">
            {filtered.map((game, i) => (
              <GameCard key={game.id} game={game} index={i} />
            ))}
          </AnimatePresence>

          {filtered.length === 0 && (
            <div className="flex min-h-[320px] w-full flex-col items-center justify-center gap-3 rounded-[26px] border-2 border-dashed border-ink/25 bg-cream/60 p-10 text-center">
              <Ghost size={36} className="text-grape" />
              <p className="font-display text-xl font-extrabold uppercase text-ink">This shelf is empty</p>
              <p className="max-w-xs text-sm font-medium text-inksoft">
                Pix is prototyping something {filter === 'Horror' ? 'delightfully spooky' : 'brand new'} for
                this corner. Check back after the next jam week!
              </p>
              <button
                onClick={() => setFilter('All')}
                className="mt-2 rounded-xl border-2 border-ink bg-sun px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider text-ink shadow-sticker-sm transition-transform hover:-translate-y-0.5 cursor-pointer"
              >
                Show everything
              </button>
            </div>
          )}
        </div>

        {/* footnote */}
        <Reveal delay={0.1} className="mt-4 flex items-center justify-between gap-4 border-t-2 border-dashed border-ink/15 pt-6">
          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-inksoft">
            <CartridgeBit className="w-7 animate-bob" />
            Every card is a full dossier: mechanics, dev stories, screenshots & store links
          </div>
          <span className="hidden text-xs font-bold uppercase tracking-wider text-inksoft sm:block">
            Showing {filtered.length} of {games.length}
          </span>
        </Reveal>
      </div>
    </section>
  );
};
