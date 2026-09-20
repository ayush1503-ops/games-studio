import React, { useState } from 'react';
import { X, Play, Star, Heart, ArrowUpRight, Check, Sparkles, Wrench, BookOpen } from 'lucide-react';
import { motion } from 'motion/react';
import { Game } from '../../types';
import { useStudio } from '../../context/StudioContext';
import { statusColor, platformShort, gameCategories, CATEGORY_COLORS } from '../../utils/catalog';

interface GameDetailModalProps {
  game: Game | null;
  onClose: () => void;
}

export const GameDetailModal: React.FC<GameDetailModalProps> = ({ game, onClose }) => {
  const { toggleWishlist, isWishlisted, notify } = useStudio();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isPlayingTrailer, setIsPlayingTrailer] = useState(false);

  if (!game) return null;
  const wished = isWishlisted(game.id);
  const currentScreenshot = game.screenshots[activeImageIndex] || game.heroImage;

  return (
    <div
      id="game-detail-modal"
      className="fixed inset-0 z-[70] overflow-y-auto bg-ink/50 p-2 backdrop-blur-sm sm:p-6 lg:p-10"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="relative mx-auto my-auto w-full max-w-6xl overflow-hidden rounded-[32px] border-2 border-ink bg-paper shadow-lift"
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 z-30 grid h-11 w-11 place-items-center rounded-full border-2 border-ink bg-cream text-ink shadow-sticker-sm transition-all hover:bg-coral hover:text-white cursor-pointer"
          aria-label="Close game dossier"
        >
          <X size={19} />
        </button>

        {/* Hero artwork */}
        <div className="relative aspect-[16/9] w-full overflow-hidden sm:aspect-[21/9]">
          {isPlayingTrailer ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-ink p-6 text-center">
              <span className="grid h-16 w-16 animate-bob place-items-center rounded-2xl border-2 border-paper bg-coral text-white">
                <Play size={26} className="fill-white" />
              </span>
              <div>
                <h4 className="font-display text-xl font-extrabold uppercase text-paper">Official teaser</h4>
                <p className="mt-1 text-xs font-bold uppercase tracking-wider text-paper/60">
                  Pretend a very good trailer is playing here
                </p>
              </div>
              <button
                onClick={() => setIsPlayingTrailer(false)}
                className="rounded-xl border-2 border-paper/40 px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-paper hover:bg-paper hover:text-ink cursor-pointer"
              >
                Close player
              </button>
            </div>
          ) : (
            <>
              <img src={game.heroImage} alt={`${game.title} key art`} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent" aria-hidden="true" />
              <button
                onClick={() => setIsPlayingTrailer(true)}
                className="absolute inset-0 m-auto grid h-20 w-20 place-items-center rounded-2xl border-2 border-ink bg-coral text-white shadow-sticker transition-transform hover:scale-110 cursor-pointer"
                title="Play teaser"
              >
                <Play size={26} className="translate-x-0.5 fill-white" />
              </button>
              <div className="absolute left-5 top-5 flex flex-wrap items-center gap-2">
                <span className={`-rotate-2 rounded-full border-2 border-ink px-3.5 py-1 text-[10px] font-extrabold uppercase tracking-wider shadow-sticker-sm ${statusColor(game.status)}`}>
                  {game.status}
                </span>
                <span className="rotate-1 rounded-full border-2 border-ink bg-cream px-3.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-ink shadow-sticker-sm">
                  {game.genre}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="space-y-10 p-6 sm:p-10 lg:p-12">
          {/* Title bar */}
          <div className="flex flex-col gap-6 border-b-2 border-dashed border-ink/15 pb-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="text-xs font-extrabold uppercase tracking-[0.3em] text-grape">{game.subtitle}</div>
              <h2 className="font-display text-4xl font-extrabold uppercase tracking-tight text-ink sm:text-6xl">
                {game.title}
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-xs font-bold uppercase tracking-wider text-inksoft">
                <span className="inline-flex items-center gap-1 text-ink">
                  <Star size={13} className="fill-sun text-sun" /> {game.rating?.toFixed(1) ?? '4.8'}
                </span>
                <span>{platformShort(game.platforms)}</span>
                <span>{game.releaseYear}</span>
                <span className="text-coral">{game.price}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {gameCategories(game).map((c) => (
                  <span key={c} className={`rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider ${CATEGORY_COLORS[c]}`}>
                    {c}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => toggleWishlist(game.id)}
                className={`inline-flex items-center gap-2 rounded-xl border-2 border-ink px-6 py-3.5 text-xs font-extrabold uppercase tracking-wider shadow-sticker-sm transition-all hover:-translate-y-0.5 cursor-pointer ${
                  wished ? 'bg-coral text-white' : 'bg-cream text-ink hover:bg-sun'
                }`}
              >
                {wished ? <Check size={14} /> : <Heart size={14} />}
                {wished ? 'On your wishlist' : 'Wishlist it'}
              </button>
              {game.storeLinks.map((store) => (
                <a
                  key={store.name}
                  href={store.url}
                  onClick={(e) => {
                    e.preventDefault();
                    notify(`${store.name} page opens at launch — thanks for the enthusiasm!`);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border-2 border-ink bg-cream px-5 py-3.5 text-xs font-extrabold uppercase tracking-wider text-ink transition-all hover:-translate-y-0.5 hover:bg-grape hover:text-white"
                >
                  {store.name}
                  <ArrowUpRight size={13} />
                </a>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            <div className="space-y-7 lg:col-span-7">
              <div className="space-y-3">
                <h3 className="font-display text-xl font-extrabold uppercase tracking-wide text-ink">About the game</h3>
                <p className="text-base font-medium leading-relaxed text-inksoft">{game.longDescription}</p>
              </div>

              <div className="space-y-4">
                <h4 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-grape">
                  <Sparkles size={14} /> Key features
                </h4>
                <div className="space-y-3">
                  {game.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-sm font-medium leading-relaxed text-inksoft">
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 border-ink bg-sun text-[11px] font-extrabold text-ink">
                        {idx + 1}
                      </span>
                      {feat}
                    </div>
                  ))}
                </div>
              </div>

              {game.awards && game.awards.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {game.awards.map((a) => (
                    <span key={a} className="rounded-full border-2 border-ink bg-lime px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-ink shadow-sticker-sm">
                      🏆 {a}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-6 lg:col-span-5">
              <div className="rounded-[24px] border-2 border-ink bg-cream p-6 shadow-sticker-sm">
                <h4 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-coral">
                  <Wrench size={14} /> How it plays
                </h4>
                <div className="mt-4 space-y-4">
                  {game.gameplayMechanics.map((mech, i) => (
                    <div key={i} className="border-b-2 border-dashed border-ink/10 pb-3 last:border-0 last:pb-0">
                      <div className="text-sm font-extrabold text-ink">{mech.title}</div>
                      <div className="mt-1 text-xs font-medium leading-relaxed text-inksoft">{mech.description}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border-2 border-ink bg-grape p-6 shadow-sticker-sm">
                <h4 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-sun">
                  <BookOpen size={14} /> From the dev diary
                </h4>
                <p className="mt-3 text-sm font-medium italic leading-relaxed text-white/90">“{game.devStory}”</p>
              </div>
            </div>
          </div>

          {/* Screenshots */}
          <div className="space-y-4 border-t-2 border-dashed border-ink/15 pt-8">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-extrabold uppercase tracking-wide text-ink">Screenshots</h3>
              <span className="text-xs font-bold uppercase tracking-wider text-inksoft">
                {activeImageIndex + 1} / {game.screenshots.length}
              </span>
            </div>
            <div className="overflow-hidden rounded-[24px] border-2 border-ink">
              <img src={currentScreenshot} alt={`${game.title} screenshot`} className="aspect-[16/9] w-full object-cover" />
            </div>
            <div className="grid grid-cols-4 gap-3">
              {game.screenshots.map((shot, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIndex(idx)}
                  className={`overflow-hidden rounded-xl border-2 transition-all cursor-pointer ${
                    activeImageIndex === idx ? 'border-coral shadow-sticker-sm' : 'border-ink/15 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={shot} alt={`Screenshot ${idx + 1}`} className="aspect-[16/9] w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
