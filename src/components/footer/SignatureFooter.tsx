import React from 'react';
import { ArrowUp, MessageCircle, Youtube, Twitch, Twitter, Terminal } from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import { PageRoute } from '../../types';
import { Squiggle, ControllerBit, DiceBit, CoinBit } from '../ui/Bits';

/** Fallbacks — the “footer.studio” block in the CMS overrides these. */
const DEFAULT_FOOTER = {
  tagline: 'Handmade with too many snacks in Montreal, QC. Every gravity equation double-checked by Pix.',
  copyright: '© 2019–2026 Brainchild Games Inc.',
  discordNote: '18,000 players hang out in our Discord. The pizza channel is strictly off-limits.',
  credits: 'Made with ♥ and Unreal Engine 5',
  about:
    'An independent studio crafting warm, kinetic, slightly quirky worlds for players who like their games handmade. Always independent, always player-first.',
};

const EXPLORE: { label: string; route: PageRoute }[] = [
  { label: 'Games', route: 'games' },
  { label: 'News', route: 'news' },
  { label: 'Blog', route: 'blog' }
];
const STUDIO: { label: string; route: PageRoute }[] = [
  { label: 'About', route: 'about' },
  { label: 'Careers', route: 'careers' },
  { label: 'Contact', route: 'contact' }
];

export const SignatureFooter: React.FC = () => {
  const { setCurrentRoute, setIsCmsOpen, block, setting } = useStudio();
  const studio = block('footer.studio', DEFAULT_FOOTER);
  const audience = setting('site.audience', { discordMembers: 18000 });

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <footer id="signature-footer" className="relative overflow-hidden border-t-2 border-ink bg-ink text-paper">
      <div className="absolute inset-0 bg-dots-light opacity-20" aria-hidden="true" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-10 pt-16 sm:px-6 sm:pt-20 lg:px-10">
        {/* Big playful sign-off */}
        <div className="flex flex-col items-start justify-between gap-10 border-b-2 border-paper/15 pb-14 lg:flex-row lg:items-end">
          <div>
            <h2 className="font-display text-5xl font-extrabold uppercase leading-[0.92] tracking-tight sm:text-7xl lg:text-8xl">
              Good games.
              <br />
              <span className="text-sun">Good times.</span>
              <Squiggle color="#FF5A3C" className="mt-3 block h-4 w-56 sm:w-80" />
            </h2>
            <p className="mt-6 max-w-md text-sm font-medium leading-relaxed text-paper/70">
              {studio.tagline}
            </p>
          </div>

          <div className="flex items-end gap-6">
            <div className="hidden gap-4 sm:flex" aria-hidden="true">
              <ControllerBit className="w-14 animate-float" />
              <DiceBit className="w-10 animate-bob" />
              <CoinBit className="w-10 animate-float-slow" />
            </div>
            <button
              onClick={scrollToTop}
              className="group inline-flex items-center gap-2 rounded-xl border-2 border-paper bg-coral px-6 py-3.5 text-xs font-extrabold uppercase tracking-wider text-white shadow-[4px_4px_0_0_var(--color-paper)] transition-all hover:-translate-y-1 hover:bg-coraldeep active:translate-y-0 cursor-pointer"
            >
              Back to top
              <ArrowUp size={14} className="transition-transform group-hover:-translate-y-1" />
            </button>
          </div>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 gap-10 py-12 md:grid-cols-12">
          <div className="col-span-2 space-y-4 md:col-span-5">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl border-2 border-paper bg-cream">
                <img src="/images/mascot_pix.png" alt="" className="h-full w-full object-cover" />
              </span>
              <div className="leading-none">
                <div className="font-display text-base font-extrabold uppercase tracking-tight">Brainchild Games</div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.28em] text-sun">Est. 2019 · Indie</div>
              </div>
            </div>
            <p className="max-w-sm text-xs font-medium leading-relaxed text-paper/65">
              {studio.about}
            </p>
            <button
              onClick={() => window.location.assign('/admin')}
              className="inline-flex items-center gap-1.5 rounded-lg border-2 border-paper/25 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-paper/70 transition-colors hover:border-sun hover:text-sun cursor-pointer"
            >
              <Terminal size={12} /> Studio CMS
            </button>
          </div>

          <div className="md:col-span-2">
            <div className="text-[11px] font-extrabold uppercase tracking-widest text-sun">Explore</div>
            <ul className="mt-4 space-y-2.5">
              {EXPLORE.map((l) => (
                <li key={l.route}>
                  <button
                    onClick={() => setCurrentRoute(l.route)}
                    className="text-sm font-semibold text-paper/75 transition-colors hover:text-sun cursor-pointer"
                  >
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-2">
            <div className="text-[11px] font-extrabold uppercase tracking-widest text-sun">Studio</div>
            <ul className="mt-4 space-y-2.5">
              {STUDIO.map((l) => (
                <li key={l.route}>
                  <button
                    onClick={() => setCurrentRoute(l.route)}
                    className="text-sm font-semibold text-paper/75 transition-colors hover:text-sun cursor-pointer"
                  >
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-3">
            <div className="text-[11px] font-extrabold uppercase tracking-widest text-sun">Play with us</div>
            <div className="mt-4 flex gap-2.5">
              {[
                { icon: MessageCircle, label: 'Discord' },
                { icon: Twitter, label: 'X / Twitter' },
                { icon: Youtube, label: 'YouTube' },
                { icon: Twitch, label: 'Twitch' }
              ].map((s) => (
                <a
                  key={s.label}
                  href="#social"
                  onClick={(e) => e.preventDefault()}
                  aria-label={s.label}
                  title={s.label}
                  className="grid h-10 w-10 place-items-center rounded-xl border-2 border-paper/25 text-paper/80 transition-all hover:-translate-y-1 hover:border-sun hover:text-sun"
                >
                  <s.icon size={16} />
                </a>
              ))}
            </div>
            <p className="mt-4 text-xs font-medium text-paper/60">{studio.discordNote}</p>
          </div>
        </div>

        {/* Legal bar */}
        <div className="flex flex-col items-center justify-between gap-4 border-t-2 border-paper/15 pt-7 text-[11px] font-bold uppercase tracking-wider text-paper/55 sm:flex-row">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <span>{studio.copyright}</span>
            <span className="hidden sm:inline text-paper/30">•</span>
            <button className="transition-colors hover:text-sun cursor-pointer">Privacy</button>
            <span className="hidden sm:inline text-paper/30">•</span>
            <button className="transition-colors hover:text-sun cursor-pointer">Terms</button>
            <span className="hidden sm:inline text-paper/30">•</span>
            <button className="transition-colors hover:text-sun cursor-pointer">Cookies</button>
          </div>
          <span className="text-paper/45">Made with ♥ and Unreal Engine 5</span>
        </div>
      </div>
    </footer>
  );
};
