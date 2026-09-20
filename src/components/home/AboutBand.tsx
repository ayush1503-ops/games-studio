import React from 'react';
import { ArrowRight, Users, Gamepad2, HeartHandshake } from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import { Reveal } from '../ui/Reveal';
import { Squiggle, ControllerBit, StarSticker } from '../ui/Bits';

/** Fallbacks — the “home.values” block in the CMS overrides these. */
const VALUE_ICONS = { gamepad: Gamepad2, users: Users, heart: HeartHandshake } as const;
const VALUE_COLORS = ['bg-grape text-white', 'bg-coral text-white', 'bg-lime text-ink'];
const DEFAULT_VALUES = [
  { icon: 'gamepad', title: 'Play first', text: 'If a mechanic isn’t fun in a greybox in 15 seconds, we start over.' },
  { icon: 'users', title: 'Small crew', text: '28 artists, coders and composers. No assembly lines, no filler.' },
  { icon: 'heart', title: 'Human pace', text: '4-day work week. Rested people make better worlds.' }
];
const DEFAULT_BAND = {
  lead:
    'Brainchild started in a Montreal basement in 2019 with two devs, one manifest and a pizza oven we still regret buying. Today we are 28 people who believe games are the warmest medium ever invented — and that a world should hug you back.',
  crewBadge: '28 creators',
  studioCaption: 'Studio floor · Montreal',
};

export const AboutBand: React.FC = () => {
  const { setCurrentRoute, block } = useStudio();
  const band = block('home.about_band', DEFAULT_BAND);
  const values = (block('home.values', { items: DEFAULT_VALUES }).items ?? DEFAULT_VALUES).map((item, index) => ({
    icon: VALUE_ICONS[(item.icon as keyof typeof VALUE_ICONS) ?? 'gamepad'] ?? Gamepad2,
    color: VALUE_COLORS[index % VALUE_COLORS.length],
    title: item.title,
    text: item.text,
  }));

  return (
    <section id="about-band" className="relative overflow-hidden py-24 sm:py-28">
      <div className="pointer-events-none absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-sun/20 blur-3xl" aria-hidden="true" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-12">
          {/* Copy */}
          <Reveal className="lg:col-span-6">
            <span className="inline-flex rotate-1 items-center gap-2 rounded-full border-2 border-ink bg-coral px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-white shadow-sticker-sm">
              ❤️ Who we are
            </span>
            <h2 className="mt-5 font-display text-4xl font-extrabold uppercase leading-[0.95] tracking-tight text-ink sm:text-6xl">
              We make games worth{' '}
              <span className="relative inline-block text-grape">
                playing
                <Squiggle color="#6C4CF1" className="absolute -bottom-2 left-0 h-3.5 w-full" />
              </span>
            </h2>
            <p className="mt-6 max-w-lg text-base font-medium leading-relaxed text-inksoft">
              {band.lead}
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {values.map((v) => (
                <div
                  key={v.title}
                  className="rounded-2xl border-2 border-ink/10 bg-cream p-4 shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-ink/25 hover:shadow-lift"
                >
                  <span className={`inline-grid h-9 w-9 place-items-center rounded-xl border-2 border-ink ${v.color}`}>
                    <v.icon size={16} />
                  </span>
                  <div className="mt-3 font-display text-sm font-extrabold uppercase text-ink">{v.title}</div>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-inksoft">{v.text}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setCurrentRoute('about')}
              className="group mt-8 inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-cream px-6 py-3.5 text-xs font-extrabold uppercase tracking-wider text-ink shadow-sticker-sm transition-all hover:-translate-y-0.5 hover:bg-sun cursor-pointer"
            >
              Meet the studio
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
            </button>
          </Reveal>

          {/* Visual collage */}
          <Reveal delay={0.1} className="relative lg:col-span-6">
            <div className="relative mx-auto max-w-lg">
              <div className="rotate-2 rounded-[30px] border-2 border-ink bg-cream p-3 shadow-sticker transition-transform duration-300 hover:rotate-0">
                <img
                  src="/images/art_studio.jpg"
                  alt="The Brainchild studio at work"
                  className="aspect-[4/3] w-full rounded-[20px] border-2 border-ink/10 object-cover"
                />
                <div className="flex items-center justify-between px-2 pb-1 pt-3">
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-inksoft">
                    {band.studioCaption}
                  </span>
                  <StarSticker className="w-5 animate-wiggle" />
                </div>
              </div>

              {/* mascot peeking */}
              <div className="absolute -bottom-10 -left-6 w-32 rotate-[-6deg] rounded-3xl border-2 border-ink bg-cream p-2 shadow-sticker-sm sm:w-36">
                <img src="/images/mascot_pix.png" alt="Pix, the studio mascot" className="w-full rounded-2xl" />
              </div>

              {/* stat stickers */}
              <span className="absolute -right-3 -top-5 rotate-6 rounded-full border-2 border-ink bg-sun px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-ink shadow-sticker-sm animate-bob">
                Est. 2019
              </span>
              <span className="absolute -right-6 top-24 hidden -rotate-3 rounded-full border-2 border-ink bg-grape px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-sticker-sm animate-float sm:block">
                {band.crewBadge}
              </span>
              <div className="absolute -left-8 top-6 hidden lg:block" aria-hidden="true">
                <ControllerBit className="w-16 animate-float-slow" />
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
};
