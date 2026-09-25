import React, { useState, useEffect, useRef } from 'react';
import { Search, Heart, User, Menu, X, ArrowRight, SlidersHorizontal, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence, useScroll, useSpring } from 'motion/react';
import { useStudio } from '../../context/StudioContext';
import { PageRoute } from '../../types';
import { assetUrl } from '../../utils/asset';

const NAV_LINKS: { label: string; route: PageRoute }[] = [
  { label: 'Games', route: 'games' },
  { label: 'News', route: 'news' },
  { label: 'Blog', route: 'blog' },
  { label: 'About', route: 'about' },
  { label: 'Careers', route: 'careers' },
  { label: 'Contact', route: 'contact' }
];

export const Navbar: React.FC = () => {
  const { currentRoute, setCurrentRoute, wishlist, isCmsOpen, setIsCmsOpen, isAudioActive, toggleAudio } = useStudio();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 24);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // "/" opens search, Escape closes overlays
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !searchOpen) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault();
          setSearchOpen(true);
        }
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setProfileOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen]);

  useEffect(() => {
    const onClickAway = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  const go = (route: PageRoute) => {
    setCurrentRoute(route);
    setMobileMenuOpen(false);
    setProfileOpen(false);
  };

  return (
    <>
      <header
        id="main-header"
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'border-b-2 border-ink/10 bg-paper/80 py-2 shadow-soft backdrop-blur-xl'
            : 'bg-transparent py-4'
        }`}
      >
        {/* Scroll progress */}
        <motion.div
          style={{ scaleX: progress }}
          className="absolute inset-x-0 top-0 h-1 origin-left bg-coral"
          aria-hidden="true"
        />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
          <div className="flex items-center justify-between gap-4">
            {/* Logo */}
            <button onClick={() => go('home')} className="group flex items-center gap-3 cursor-pointer" aria-label="Brainchild Games home">
              <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl border-2 border-ink bg-cream shadow-sticker-sm transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-105">
                <img src={assetUrl("/images/mascot_pix.png")} alt="" className="h-full w-full object-cover" />
              </span>
              <span className="flex flex-col items-start leading-none">
                <span className="font-display text-lg font-extrabold uppercase tracking-tight text-ink">
                  Brainchild
                </span>
                <span className="text-[9px] font-bold uppercase tracking-[0.28em] text-coral">Game Studio</span>
              </span>
            </button>

            {/* Desktop nav */}
            <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
              {NAV_LINKS.map((item) => {
                const active = currentRoute === item.route;
                return (
                  <button
                    key={item.route}
                    onClick={() => go(item.route)}
                    className={`relative rounded-full px-4 py-2 text-sm font-semibold transition-colors cursor-pointer ${
                      active ? 'text-ink' : 'text-inksoft hover:text-ink'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="nav-pill"
                        className="absolute inset-0 rounded-full border-2 border-ink bg-sun shadow-sticker-sm"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      />
                    )}
                    <span className="relative z-10">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSearchOpen(true)}
                className="grid h-10 w-10 place-items-center rounded-full border-2 border-ink/15 bg-cream text-ink transition-all hover:border-ink hover:shadow-sticker-sm cursor-pointer"
                aria-label="Search games and stories"
                title="Search ( / )"
              >
                <Search size={17} />
              </button>

              <button
                onClick={() => go('games')}
                className="relative grid h-10 w-10 place-items-center rounded-full border-2 border-ink/15 bg-cream text-ink transition-all hover:border-ink hover:shadow-sticker-sm cursor-pointer"
                aria-label={`Wishlist, ${wishlist.length} games`}
              >
                <Heart size={17} className={wishlist.length ? 'fill-coral text-coral' : ''} />
                {wishlist.length > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-ink bg-sun px-1 text-[10px] font-extrabold text-ink">
                    {wishlist.length}
                  </span>
                )}
              </button>

              {/* Profile */}
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen((v) => !v)}
                  className="grid h-10 w-10 place-items-center rounded-full border-2 border-ink/15 bg-grape text-white transition-all hover:border-ink hover:shadow-sticker-sm cursor-pointer"
                  aria-label="Player menu"
                >
                  <User size={17} />
                </button>

                <AnimatePresence>
                  {profileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.18 }}
                      className="absolute right-0 top-12 w-60 overflow-hidden rounded-2xl border-2 border-ink bg-cream shadow-lift"
                    >
                      <div className="border-b-2 border-ink/10 bg-sun/30 px-4 py-3">
                        <div className="font-display text-sm font-extrabold uppercase text-ink">Player One</div>
                        <div className="text-[11px] font-semibold text-inksoft">Level 12 · Curiosity build</div>
                      </div>
                      <div className="p-2">
                        <button
                          onClick={() => {
                            window.location.assign('/admin');
                            setProfileOpen(false);
                          }}
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-ink hover:bg-sand cursor-pointer"
                        >
                          <SlidersHorizontal size={15} className="text-grape" /> Studio CMS
                        </button>
                        <button
                          onClick={() => {
                            toggleAudio();
                            setProfileOpen(false);
                          }}
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-ink hover:bg-sand cursor-pointer"
                        >
                          {isAudioActive ? <Volume2 size={15} className="text-coral" /> : <VolumeX size={15} className="text-inksoft" />}
                          Sound {isAudioActive ? 'on' : 'off'}
                        </button>
                        <button
                          onClick={() => go('games')}
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-ink hover:bg-sand cursor-pointer"
                        >
                          <Heart size={15} className="text-coral" /> Wishlist ({wishlist.length})
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Primary CTA */}
              <button
                onClick={() => go('games')}
                className="hidden ml-1 items-center gap-2 rounded-xl border-2 border-ink bg-coral px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-white shadow-sticker transition-all hover:-translate-y-0.5 hover:bg-coraldeep hover:shadow-[5px_5px_0_0_var(--color-ink)] active:translate-y-0 active:shadow-sticker-sm md:inline-flex cursor-pointer"
              >
                Play now <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </button>

              {/* Mobile menu */}
              <button
                onClick={() => setMobileMenuOpen((v) => !v)}
                className="grid h-10 w-10 place-items-center rounded-xl border-2 border-ink bg-cream text-ink cursor-pointer lg:hidden"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="border-b-2 border-ink bg-paper px-4 pb-6 pt-4 shadow-lift lg:hidden"
            >
              <div className="grid grid-cols-2 gap-2">
                {NAV_LINKS.map((item) => (
                  <button
                    key={item.route}
                    onClick={() => go(item.route)}
                    className={`rounded-xl border-2 px-4 py-3 text-left text-sm font-bold uppercase tracking-wide cursor-pointer ${
                      currentRoute === item.route
                        ? 'border-ink bg-sun text-ink shadow-sticker-sm'
                        : 'border-ink/10 bg-cream text-inksoft'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => go('games')}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-ink bg-coral px-5 py-3.5 text-sm font-extrabold uppercase tracking-wide text-white shadow-sticker cursor-pointer"
              >
                Play now <ArrowRight size={15} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
    </>
  );
};

/* ---------------- Search overlay ---------------- */

const SearchOverlay: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { games, news, setSelectedGame, setSelectedArticle, setCurrentRoute } = useStudio();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const q = query.trim().toLowerCase();
  const gameHits = q
    ? games.filter(
        (g) =>
          g.title.toLowerCase().includes(q) ||
          g.genre.toLowerCase().includes(q) ||
          g.tags.some((t) => t.toLowerCase().includes(q))
      )
    : games.slice(0, 3);
  const newsHits = q
    ? news.filter((a) => a.published && (a.title.toLowerCase().includes(q) || a.excerpt.toLowerCase().includes(q)))
    : [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] bg-ink/40 backdrop-blur-sm p-4 sm:p-8"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: -18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="mx-auto mt-10 max-w-2xl overflow-hidden rounded-3xl border-2 border-ink bg-cream shadow-lift"
      >
        <div className="flex items-center gap-3 border-b-2 border-ink/10 px-5 py-4">
          <Search size={18} className="text-grape" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search worlds, devlogs, stories…"
            className="w-full bg-transparent text-base font-semibold text-ink placeholder-inksoft/70 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="rounded-lg border-2 border-ink/15 px-2 py-1 text-[10px] font-extrabold uppercase text-inksoft hover:border-ink hover:text-ink cursor-pointer"
          >
            Esc
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-3">
          {gameHits.length === 0 && newsHits.length === 0 && (
            <div className="px-4 py-10 text-center">
              <div className="text-2xl">🕹️</div>
              <p className="mt-2 text-sm font-semibold text-inksoft">
                Nothing found for “{query}”. Try “sky”, “heist” or “puzzle”.
              </p>
            </div>
          )}

          {gameHits.length > 0 && (
            <div className="mb-2">
              <div className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-widest text-inksoft">Games</div>
              {gameHits.map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    setSelectedGame(g);
                    onClose();
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-sand cursor-pointer"
                >
                  <img src={g.heroImage} alt="" className="h-12 w-16 rounded-lg border-2 border-ink/10 object-cover" />
                  <span className="flex-1">
                    <span className="block font-display text-sm font-extrabold uppercase text-ink">{g.title}</span>
                    <span className="block text-xs font-medium text-inksoft">{g.genre}</span>
                  </span>
                  <ArrowRight size={15} className="text-inksoft" />
                </button>
              ))}
            </div>
          )}

          {newsHits.length > 0 && (
            <div>
              <div className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-widest text-inksoft">Stories</div>
              {newsHits.map((a) => (
                <button
                  key={a.id}
                  onClick={() => {
                    setSelectedArticle(a);
                    onClose();
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-sand cursor-pointer"
                >
                  <img src={a.coverImage} alt="" className="h-12 w-16 rounded-lg border-2 border-ink/10 object-cover" />
                  <span className="flex-1">
                    <span className="block text-sm font-bold text-ink">{a.title}</span>
                    <span className="block text-xs font-medium text-inksoft">{a.category}</span>
                  </span>
                  <ArrowRight size={15} className="text-inksoft" />
                </button>
              ))}
            </div>
          )}

          {!q && (
            <button
              onClick={() => {
                setCurrentRoute('games');
                onClose();
              }}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-ink bg-sun px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-ink shadow-sticker-sm hover:-translate-y-0.5 transition-transform cursor-pointer"
            >
              Browse the full shelf <ArrowRight size={15} />
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
