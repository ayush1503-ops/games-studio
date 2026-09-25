import React, { useState } from 'react';
import { ArrowRight, Award, Heart, Gamepad2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { STUDIO_TIMELINE, TEAM_MEMBERS } from '../../data/initialData';

/** Fallbacks — the matching CMS blocks override every one of these. */
const DEFAULT_ABOUT_HERO = {
  badge: '❤️ Our story · 2019 → today',
  lead:
    'Brainchild Games began around a wobbly kitchen table in Montreal, founded by two developers who wanted out of assembly-line production. Today we are 28 artists, physicists, composers and professional bell-ringers, united by one obsession: building places worth visiting twice.',
  mission:
    'Our mission is simple to say and hard to do — make worlds that hug you back. Games that respect your time, reward your curiosity, and leave you humming their theme song in the grocery store.',
  teamBadge: '28 humans',
};
const DEFAULT_TEAM = TEAM_MEMBERS;
import { useStudio } from '../../context/StudioContext';
import { Reveal } from '../ui/Reveal';
import { Squiggle, StarSticker, ControllerBit, TrophyBit } from '../ui/Bits';
import { assetUrl } from '../../utils/asset';

const DEFAULT_PHILOSOPHY = [
  {
    emoji: '🎮',
    title: 'Play over polish, until polish feels like play',
    desc: 'If a mechanic doesn’t spark a grin in a greybox room within fifteen seconds, no amount of shader work will rescue it. We prototype relentlessly and throw away happily.'
  },
  {
    emoji: '🗺️',
    title: 'Worlds first, always',
    desc: 'Our environments are characters, not backdrops. Rocks have history, bells have moods, and every corner hides one small delightful secret for the curious.'
  },
  {
    emoji: '🌿',
    title: 'Human pace over crunch',
    desc: 'Great games come from rested people with lives outside of games. Strict 4-day week, zero mandatory overtime, and a pizza oven we genuinely regret.'
  }
];

export const AboutPage: React.FC = () => {
  const { setCurrentRoute, block } = useStudio();
  const aboutHero = block('about.hero', DEFAULT_ABOUT_HERO);
  const TIMELINE = block('about.timeline', { items: STUDIO_TIMELINE }).items ?? STUDIO_TIMELINE;
  const PHILOSOPHY = block('about.philosophy', { items: DEFAULT_PHILOSOPHY }).items ?? DEFAULT_PHILOSOPHY;
  const TEAM = block('about.team', { members: DEFAULT_TEAM }).members ?? DEFAULT_TEAM;
  const [activeIdx, setActiveIdx] = useState(0);
  const active = TIMELINE[activeIdx];

  return (
    <div id="about-page" className="relative min-h-screen overflow-hidden pt-32 pb-24 sm:pt-36">
      <div className="pointer-events-none absolute -right-32 top-32 h-96 w-96 rounded-full bg-coral/10 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -left-24 top-2/3 h-96 w-96 rounded-full bg-grape/10 blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl space-y-24 px-4 sm:px-6 lg:px-10">
        {/* Hero */}
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <span className="inline-flex -rotate-1 items-center gap-2 rounded-full border-2 border-ink bg-grape px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-white shadow-sticker-sm">
              {aboutHero.badge}
            </span>
            <h1 className="mt-6 font-display text-5xl font-extrabold uppercase leading-[0.92] tracking-tight text-ink sm:text-7xl">
              We make games worth{' '}
              <span className="relative inline-block text-coral">
                playing
                <Squiggle className="absolute -bottom-3 left-0 h-4 w-full" />
              </span>
            </h1>
            <p className="mt-7 max-w-xl text-base font-medium leading-relaxed text-inksoft sm:text-lg">
              {aboutHero.lead}
            </p>
            <p className="mt-4 max-w-xl text-sm font-medium leading-relaxed text-inksoft">
              {aboutHero.mission}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {['Player-first', 'Handmade', 'Independent', 'Slightly quirky'].map((chip, i) => (
                <span
                  key={chip}
                  className={`rounded-full border-2 border-ink px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider shadow-sticker-sm ${
                    i % 2 === 0 ? 'bg-sun text-ink' : 'bg-cream text-ink'
                  } ${i % 2 === 0 ? '-rotate-1' : 'rotate-1'}`}
                >
                  {chip}
                </span>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.1} className="relative lg:col-span-5">
            <div className="relative mx-auto max-w-sm">
              <div className="-rotate-2 rounded-[30px] border-2 border-ink bg-cream p-3 shadow-sticker transition-transform duration-300 hover:rotate-0">
                <img
                  src={assetUrl("/images/art_studio.jpg")}
                  alt="Inside the Brainchild studio"
                  className="aspect-[4/3] w-full rounded-[20px] border-2 border-ink/10 object-cover"
                />
              </div>
              <div className="absolute -bottom-8 -right-4 w-32 rotate-6 rounded-3xl border-2 border-ink bg-cream p-2 shadow-sticker-sm">
                <img src={assetUrl("/images/mascot_pix.png")} alt="Pix the mascot" className="w-full rounded-2xl" />
              </div>
              <span className="absolute -left-4 -top-5 -rotate-6 rounded-full border-2 border-ink bg-lime px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-ink shadow-sticker-sm animate-bob">
                {aboutHero.teamBadge}
              </span>
              <div className="absolute -left-10 bottom-10 hidden lg:block" aria-hidden="true">
                <ControllerBit className="w-14 animate-float-slow" />
              </div>
            </div>
          </Reveal>
        </div>

        {/* Mission banner */}
        <Reveal>
          <div className="relative overflow-hidden rounded-[36px] border-2 border-ink bg-grape p-8 shadow-lift sm:p-14">
            <div className="absolute inset-0 bg-dots-light opacity-30" aria-hidden="true" />
            <div className="absolute right-8 top-8 rotate-6" aria-hidden="true">
              <TrophyBit className="w-14 animate-float" />
            </div>
            <div className="relative z-10 max-w-3xl space-y-5">
              <span className="inline-flex -rotate-1 items-center gap-2 rounded-full border-2 border-ink bg-sun px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-ink shadow-sticker-sm">
                🎯 The mission
              </span>
              <blockquote className="font-display text-2xl font-extrabold leading-snug text-white sm:text-4xl">
                “If a world doesn’t make the team want to step inside the monitor at 3am, we scrap
                it and start over.”
              </blockquote>
              <p className="text-sm font-medium text-white/80">
                — Julian Vance & Maya Lin-Torvalds, co-founders. Still true, eight years and four
                worlds later.
              </p>
            </div>
          </div>
        </Reveal>

        {/* Timeline */}
        <div className="space-y-8">
          <Reveal className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="inline-flex rotate-1 items-center gap-2 rounded-full border-2 border-ink bg-sun px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-ink shadow-sticker-sm">
                🧭 Milestones
              </span>
              <h2 className="mt-4 font-display text-4xl font-extrabold uppercase tracking-tight text-ink sm:text-5xl">
                The story so far
              </h2>
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-inksoft">Tap a year to peek</span>
          </Reveal>

          <Reveal delay={0.05} className="flex flex-wrap gap-2.5">
            {TIMELINE.map((item, idx) => (
              <button
                key={item.year}
                onClick={() => setActiveIdx(idx)}
                className={`rounded-full border-2 border-ink px-5 py-2.5 text-sm font-extrabold transition-all duration-200 cursor-pointer ${
                  activeIdx === idx
                    ? '-rotate-1 scale-105 bg-coral text-white shadow-sticker-sm'
                    : 'bg-cream text-inksoft hover:-translate-y-0.5 hover:text-ink hover:shadow-sticker-sm'
                }`}
              >
                {item.year}
              </button>
            ))}
          </Reveal>

          <AnimatePresence mode="wait">
            <motion.div
              key={active.year}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 items-center gap-8 rounded-[30px] border-2 border-ink bg-cream p-8 shadow-sticker sm:p-12 lg:grid-cols-12"
            >
              <div className="space-y-4 lg:col-span-8">
                <span className="inline-block rounded-full bg-grape px-3.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white">
                  {active.tag} · {active.year}
                </span>
                <h3 className="font-display text-2xl font-extrabold uppercase tracking-tight text-ink sm:text-4xl">
                  {active.title}
                </h3>
                <p className="max-w-2xl text-sm font-medium leading-relaxed text-inksoft sm:text-base">
                  {active.description}
                </p>
              </div>
              <div className="flex justify-center lg:col-span-4">
                <div className="grid h-28 w-28 rotate-3 place-items-center rounded-3xl border-2 border-ink bg-sun shadow-sticker-sm">
                  <Award size={40} className="text-ink" />
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Philosophy */}
        <div className="space-y-8">
          <Reveal>
            <span className="inline-flex -rotate-1 items-center gap-2 rounded-full border-2 border-ink bg-lime px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-ink shadow-sticker-sm">
              🧠 How we think
            </span>
            <h2 className="mt-4 font-display text-4xl font-extrabold uppercase tracking-tight text-ink sm:text-5xl">
              Creative philosophy
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {PHILOSOPHY.map((p, i) => (
              <Reveal key={p.title} delay={0.06 * i}>
                <div className="flex h-full flex-col justify-between gap-6 rounded-[26px] border-2 border-ink/10 bg-cream p-7 shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:border-ink/30 hover:shadow-lift">
                  <div className="space-y-3">
                    <span className="text-3xl">{p.emoji}</span>
                    <h3 className="font-display text-lg font-extrabold leading-snug text-ink">{p.title}</h3>
                    <p className="text-sm font-medium leading-relaxed text-inksoft">{p.desc}</p>
                  </div>
                  <div className="flex items-center gap-2 border-t-2 border-dashed border-ink/10 pt-4 text-[10px] font-extrabold uppercase tracking-widest text-inksoft">
                    <Heart size={12} className="text-coral" /> Non-negotiable
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* Team */}
        <div className="space-y-8">
          <Reveal className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="inline-flex rotate-1 items-center gap-2 rounded-full border-2 border-ink bg-coral px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-white shadow-sticker-sm">
                👋 The crew
              </span>
              <h2 className="mt-4 font-display text-4xl font-extrabold uppercase tracking-tight text-ink sm:text-5xl">
                World architects
              </h2>
            </div>
            <button
              onClick={() => setCurrentRoute('careers')}
              className="group inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-cream px-5 py-3 text-xs font-extrabold uppercase tracking-wider text-ink shadow-sticker-sm transition-all hover:-translate-y-0.5 hover:bg-sun cursor-pointer"
            >
              Join the crew <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
            </button>
          </Reveal>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TEAM.map((m, i) => (
              <Reveal key={m.name} delay={0.06 * i}>
                <div className="group flex h-full flex-col justify-between gap-5 rounded-[26px] border-2 border-ink/10 bg-cream p-6 shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:border-ink/30 hover:shadow-lift">
                  <div className="space-y-3">
                    <div
                      className="grid h-14 w-14 place-items-center rounded-2xl border-2 border-ink font-display text-xl font-extrabold text-white shadow-sticker-sm transition-transform group-hover:-rotate-6"
                      style={{ backgroundColor: m.photoColor }}
                    >
                      {m.name[0]}
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-extrabold text-ink">{m.name}</h3>
                      <div className="mt-0.5 text-xs font-extrabold uppercase tracking-wider text-grape">{m.role}</div>
                    </div>
                    <p className="text-xs font-medium leading-relaxed text-inksoft">{m.bio}</p>
                  </div>
                  <div className="flex items-center gap-2 border-t-2 border-dashed border-ink/10 pt-3 text-[11px] font-bold text-inksoft">
                    <Gamepad2 size={13} className="shrink-0 text-coral" /> {m.favoriteGame}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* Fun closing strip */}
        <Reveal>
          <div className="flex flex-col items-center justify-between gap-6 rounded-[30px] border-2 border-ink bg-sun p-8 shadow-sticker sm:flex-row sm:p-10">
            <div className="flex items-center gap-4">
              <StarSticker className="w-10 animate-wiggle" />
              <div>
                <div className="font-display text-xl font-extrabold uppercase text-ink sm:text-2xl">
                  Curious what we jam on Fridays?
                </div>
                <div className="text-sm font-medium text-ink/70">
                  41 prototypes last jam week. One of them is a pigeon dating sim. We are not sorry.
                </div>
              </div>
            </div>
            <button
              onClick={() => setCurrentRoute('news')}
              className="group inline-flex shrink-0 items-center gap-2 rounded-xl border-2 border-ink bg-ink px-6 py-3.5 text-xs font-extrabold uppercase tracking-wider text-paper shadow-[4px_4px_0_0_var(--color-coral)] transition-all hover:-translate-y-1 cursor-pointer"
            >
              <Sparkles size={14} /> Read the devlogs
            </button>
          </div>
        </Reveal>
      </div>
    </div>
  );
};
