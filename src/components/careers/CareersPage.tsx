import React, { useState } from 'react';
import { MapPin, Briefcase, Gauge, ArrowRight, Coffee } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Job } from '../../types';
import { useStudio } from '../../context/StudioContext';
import { Reveal } from '../ui/Reveal';
import { Squiggle, DiceBit, CoinBit } from '../ui/Bits';

/** Fallbacks — the “careers.intro” block in the CMS overrides these. */
const DEFAULT_BENEFITS = [
  { emoji: '🗓️', title: '4-day work week', desc: 'Monday–Thursday, 36 hours. Fridays are for playing games, hiking, family, or forbidden prototypes.' },
  { emoji: '💰', title: 'Real profit sharing', desc: '15% of net revenue from every game is pooled and split equally across the team. No fine print.' },
  { emoji: '🛑', title: 'Zero crunch culture', desc: 'We scope games to fit life, not the other way around. Milestones move before sleep does.' },
  { emoji: '🌍', title: 'Remote-first, human-always', desc: '$4k hardware budget, health & dental coverage, and one annual cabin retreat with board games.' }
];
const DEFAULT_CAREERS = { lead: '', applicationNote: 'Applications read by humans · reply within a week', applyEmail: 'jobs@brainchild.games', benefits: DEFAULT_BENEFITS };

const DEPTS = ['ALL', 'Engineering', 'Art & Animation', 'Game Design', 'Audio'];

export const CareersPage: React.FC = () => {
  const { jobs, setSelectedJob, block } = useStudio();
  const careers = block('careers.intro', DEFAULT_CAREERS);
  const BENEFITS = careers.benefits?.length ? careers.benefits : DEFAULT_BENEFITS;
  const applyEmail = careers.applyEmail || 'jobs@brainchild.games';
  const [dept, setDept] = useState('ALL');

  const filtered = jobs.filter((j) => (dept === 'ALL' ? true : j.department === dept));
  const openCount = jobs.filter((j) => j.status === 'open').length;

  return (
    <div id="careers-page" className="relative min-h-screen overflow-hidden pt-32 pb-24 sm:pt-36">
      <div className="pointer-events-none absolute -left-32 top-24 h-96 w-96 rounded-full bg-lime/15 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-24 top-1/2 h-96 w-96 rounded-full bg-grape/10 blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl space-y-20 px-4 sm:px-6 lg:px-10">
        {/* Hero */}
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <span className="inline-flex -rotate-1 items-center gap-2 rounded-full border-2 border-ink bg-lime px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-ink shadow-sticker-sm">
              💼 {openCount} open roles
            </span>
            <h1 className="mt-6 font-display text-5xl font-extrabold uppercase leading-[0.92] tracking-tight text-ink sm:text-7xl">
              Come build the{' '}
              <span className="relative inline-block text-grape">
                next level
                <Squiggle color="#6C4CF1" className="absolute -bottom-3 left-0 h-4 w-full" />
              </span>{' '}
              with us
            </h1>
            <p className="mt-6 max-w-xl text-base font-medium leading-relaxed text-inksoft sm:text-lg">
              We hire curious engineers, environment sculptors, word wizards and audio alchemists who
              want their craft to define a genre. Applications are read by humans, replied to by
              humans. No automated filtering. Ever.
            </p>
          </Reveal>

          <Reveal delay={0.1} className="lg:col-span-5">
            <div className="relative mx-auto max-w-xs">
              <div className="rotate-3 rounded-[30px] border-2 border-ink bg-cream p-3 shadow-sticker transition-transform duration-300 hover:rotate-0">
                <img src="/images/mascot_pix.png" alt="Pix holding a hiring sign" className="w-full rounded-[20px]" />
                <div className="absolute -top-5 left-4 -rotate-3 rounded-2xl border-2 border-ink bg-coral px-4 py-2 shadow-sticker-sm">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-white">We’re hiring!</span>
                </div>
              </div>
              <div className="absolute -right-6 -top-6" aria-hidden="true">
                <DiceBit className="w-12 animate-float" />
              </div>
              <div className="absolute -bottom-6 -left-6" aria-hidden="true">
                <CoinBit className="w-10 animate-float-slow" />
              </div>
            </div>
          </Reveal>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((b, i) => (
            <Reveal key={b.title} delay={0.06 * i}>
              <div className="flex h-full flex-col gap-4 rounded-[26px] border-2 border-ink/10 bg-cream p-6 shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:border-ink/30 hover:shadow-lift">
                <span className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-ink bg-sun text-2xl shadow-sticker-sm">
                  {b.emoji}
                </span>
                <div>
                  <h3 className="font-display text-base font-extrabold uppercase text-ink">{b.title}</h3>
                  <p className="mt-2 text-xs font-medium leading-relaxed text-inksoft">{b.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Roles */}
        <div className="space-y-8">
          <Reveal className="flex flex-col gap-5 border-b-2 border-dashed border-ink/15 pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="inline-flex rotate-1 items-center gap-2 rounded-full border-2 border-ink bg-coral px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-white shadow-sticker-sm">
                🎯 Open positions
              </span>
              <h2 className="mt-4 font-display text-4xl font-extrabold uppercase tracking-tight text-ink sm:text-5xl">
                Pick your quest
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {DEPTS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDept(d)}
                  className={`rounded-full border-2 border-ink px-4 py-2 text-xs font-extrabold uppercase tracking-wide transition-all duration-200 cursor-pointer ${
                    dept === d
                      ? '-rotate-1 scale-105 bg-grape text-white shadow-sticker-sm'
                      : 'bg-cream text-inksoft hover:-translate-y-0.5 hover:text-ink hover:shadow-sticker-sm'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </Reveal>

          <div className="space-y-5">
            <AnimatePresence mode="popLayout">
              {filtered.map((job, i) => (
                <JobCard key={job.id} job={job} index={i} onOpen={() => setSelectedJob(job)} />
              ))}
            </AnimatePresence>
          </div>

          {filtered.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-[26px] border-2 border-dashed border-ink/25 bg-cream/60 p-14 text-center">
              <span className="text-4xl">🧩</span>
              <p className="font-display text-2xl font-extrabold uppercase text-ink">No quests in this guild</p>
              <p className="max-w-sm text-sm font-medium text-inksoft">
                Nothing open in {dept} right now — but speculative applications always land on a
                human desk.
              </p>
            </div>
          )}
        </div>

        {/* Culture note */}
        <Reveal>
          <div className="flex flex-col items-center justify-between gap-6 rounded-[30px] border-2 border-ink bg-ink p-8 text-paper shadow-lift sm:flex-row sm:p-10">
            <div className="flex items-center gap-4">
              <Coffee size={28} className="shrink-0 text-sun" />
              <p className="max-w-xl text-sm font-medium leading-relaxed text-paper/85">
                <span className="font-extrabold text-sun">Not seeing your role?</span> Send us a
                speculative application anyway. Two of our current leads started as “we don’t have a
                slot for you, but please don’t stop emailing.”
              </p>
            </div>
            <a
              href={`mailto:${applyEmail}`}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border-2 border-paper bg-coral px-6 py-3.5 text-xs font-extrabold uppercase tracking-wider text-white shadow-[4px_4px_0_0_var(--color-paper)] transition-all hover:-translate-y-1 hover:bg-coraldeep"
            >
              {applyEmail} <ArrowRight size={14} />
            </a>
          </div>
        </Reveal>
      </div>
    </div>
  );
};

/* Small wrapper to keep AnimatePresence happy with typed props */
const JobCard: React.FC<{ job: Job; index: number; onOpen: () => void }> = ({ job, index, onOpen }) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.98 }}
    transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.2) }}
  >
    <button
      onClick={onOpen}
      className="group flex w-full flex-col gap-5 rounded-[26px] border-2 border-ink/10 bg-cream p-6 text-left shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:border-ink/30 hover:shadow-lift sm:p-8 lg:flex-row lg:items-center lg:justify-between cursor-pointer"
    >
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider">
          <span className="rounded-full bg-grape px-3 py-1 text-white">{job.department}</span>
          <span className="rounded-full bg-sand px-3 py-1 text-inksoft">{job.experience}</span>
          <span className="rounded-full bg-sand px-3 py-1 text-inksoft">{job.type}</span>
        </div>
        <h3 className="font-display text-xl font-extrabold leading-tight text-ink transition-colors group-hover:text-grape sm:text-2xl">
          {job.title}
        </h3>
        <div className="flex flex-wrap items-center gap-4 text-xs font-bold uppercase tracking-wider text-inksoft">
          <span className="inline-flex items-center gap-1.5">
            <MapPin size={13} className="text-coral" /> {job.location}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Briefcase size={13} className="text-grape" /> {job.postedDate}
          </span>
        </div>
        <p className="max-w-2xl text-sm font-medium leading-relaxed text-inksoft">{job.description}</p>
      </div>

      <span className="inline-flex shrink-0 items-center gap-2 rounded-xl border-2 border-ink bg-sun px-5 py-3 text-xs font-extrabold uppercase tracking-wider text-ink shadow-sticker-sm transition-all group-hover:translate-x-1 group-hover:bg-coral group-hover:text-white">
        <Gauge size={14} /> View position
      </span>
    </button>
  </motion.div>
);
