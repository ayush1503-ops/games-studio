import React from 'react';
import { ArrowRight, MapPin, Briefcase, Gauge } from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import { Reveal } from '../ui/Reveal';
import { DiceBit, StarSticker } from '../ui/Bits';

/** Fallback perks — the “careers.intro” block in the CMS overrides these. */
const DEFAULT_PERKS = ['🗓️ 4-day work week', '💰 Profit sharing', '🛑 Zero crunch', '🌍 Remote-first', '🎮 $4k gear budget'];

export const CareersTeaserSection: React.FC = () => {
  const { jobs, setCurrentRoute, setSelectedJob, block } = useStudio();
  const careers = block('careers.intro', { benefits: [], applicationNote: 'Applications read by humans · reply within a week' });
  const PERKS = careers.benefits?.length
    ? careers.benefits.map((benefit: any) => `${benefit.emoji ?? '•'} ${benefit.title}`)
    : DEFAULT_PERKS;
  const open = jobs.filter((j) => j.status === 'open').slice(0, 3);

  return (
    <section id="careers-teaser" className="relative overflow-hidden py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        <Reveal>
          <div className="relative overflow-hidden rounded-[36px] border-2 border-ink bg-grape shadow-lift">
            <div className="absolute inset-0 bg-dots-light opacity-40" aria-hidden="true" />
            <div className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 rounded-full bg-coral/30 blur-3xl" aria-hidden="true" />
            <div className="absolute right-8 top-8 hidden rotate-6 lg:block" aria-hidden="true">
              <DiceBit className="w-14 animate-float" />
            </div>

            <div className="relative z-10 p-8 sm:p-12 lg:p-16">
              <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
                <div className="lg:col-span-5">
                  <span className="inline-flex -rotate-2 items-center gap-2 rounded-full border-2 border-ink bg-sun px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-ink shadow-sticker-sm">
                    💼 Open roles
                  </span>
                  <h2 className="mt-5 font-display text-4xl font-extrabold uppercase leading-[0.95] tracking-tight text-white sm:text-5xl">
                    Come build the next level with us
                  </h2>
                  <p className="mt-5 max-w-md text-sm font-medium leading-relaxed text-white/85 sm:text-base">
                    We hire curious humans who argue kindly, prototype obsessively, and ship worlds
                    players tattoo on their arms. Probably. It has happened twice.
                  </p>

                  <div className="mt-7 flex flex-wrap gap-2">
                    {PERKS.map((p) => (
                      <span
                        key={p}
                        className="rounded-full border-2 border-ink/30 bg-white/15 px-3.5 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm"
                      >
                        {p}
                      </span>
                    ))}
                  </div>

                  <button
                    onClick={() => setCurrentRoute('careers')}
                    className="group mt-8 inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-coral px-6 py-3.5 text-xs font-extrabold uppercase tracking-wider text-white shadow-sticker transition-all hover:-translate-y-1 hover:bg-coraldeep hover:shadow-[6px_6px_0_0_var(--color-ink)] active:translate-y-0 cursor-pointer"
                  >
                    See all roles
                    <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                  </button>
                </div>

                {/* Job cards */}
                <div className="flex flex-col gap-4 lg:col-span-7">
                  {open.map((job, i) => (
                    <Reveal key={job.id} delay={0.08 * i}>
                      <button
                        onClick={() => setSelectedJob(job)}
                        className="group flex w-full flex-col gap-3 rounded-[22px] border-2 border-ink bg-cream p-5 text-left shadow-sticker-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-sticker sm:flex-row sm:items-center sm:justify-between cursor-pointer"
                      >
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider">
                            <span className="rounded-full bg-grape px-2.5 py-0.5 text-white">{job.department}</span>
                            <span className="rounded-full bg-sand px-2.5 py-0.5 text-inksoft">{job.experience}</span>
                          </div>
                          <h3 className="font-display text-lg font-extrabold leading-tight text-ink group-hover:text-grape">
                            {job.title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-inksoft">
                            <span className="inline-flex items-center gap-1">
                              <MapPin size={11} /> {job.location.split('/')[0].trim()}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Briefcase size={11} /> {job.type}
                            </span>
                          </div>
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border-2 border-ink bg-sun px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-ink transition-transform group-hover:translate-x-1">
                          <Gauge size={13} /> View position
                        </span>
                      </button>
                    </Reveal>
                  ))}

                  <div className="flex items-center gap-2 px-2 text-[11px] font-bold uppercase tracking-wider text-white/70">
                    <StarSticker className="w-4" />
                    {jobs.filter((j) => j.status === 'open').length} open roles · applications reviewed by humans, always
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};
