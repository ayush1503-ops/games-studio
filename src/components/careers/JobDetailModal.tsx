import React from 'react';
import { X, MapPin, Briefcase, Gauge, CalendarDays, Check, Send, Gift } from 'lucide-react';
import { motion } from 'motion/react';
import { Job } from '../../types';
import { useStudio } from '../../context/StudioContext';

interface JobDetailModalProps {
  job: Job | null;
  onClose: () => void;
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({ job, onClose }) => {
  const { notify, block } = useStudio();
  const applyEmail = block('careers.intro', { applyEmail: 'jobs@brainchild.games' }).applyEmail || 'jobs@brainchild.games';
  if (!job) return null;

  return (
    <div
      id="job-detail-modal"
      className="fixed inset-0 z-[70] overflow-y-auto bg-ink/50 p-2 backdrop-blur-sm sm:p-6 lg:p-10"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="relative mx-auto my-auto w-full max-w-4xl overflow-hidden rounded-[32px] border-2 border-ink bg-paper shadow-lift"
      >
        {/* Header band */}
        <div className="relative overflow-hidden border-b-2 border-ink bg-grape p-6 sm:p-10">
          <div className="absolute inset-0 bg-dots-light opacity-30" aria-hidden="true" />
          <button
            onClick={onClose}
            className="absolute right-5 top-5 z-30 grid h-11 w-11 place-items-center rounded-full border-2 border-ink bg-cream text-ink shadow-sticker-sm transition-all hover:bg-coral hover:text-white cursor-pointer"
            aria-label="Close role"
          >
            <X size={19} />
          </button>
          <div className="relative z-10 space-y-3">
            <div className="flex flex-wrap gap-2">
              <span className="-rotate-1 rounded-full border-2 border-ink bg-sun px-3.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-ink shadow-sticker-sm">
                {job.department}
              </span>
              <span className="rotate-1 rounded-full border-2 border-ink bg-cream px-3.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-ink shadow-sticker-sm">
                {job.experience}
              </span>
            </div>
            <h2 className="font-display text-3xl font-extrabold uppercase leading-tight tracking-tight text-white sm:text-5xl">
              {job.title}
            </h2>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-bold uppercase tracking-wider text-white/85">
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={13} className="text-sun" /> {job.location}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Briefcase size={13} className="text-sun" /> {job.type}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={13} className="text-sun" /> Posted {job.postedDate}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-8 p-6 sm:p-10">
          <p className="text-base font-medium leading-relaxed text-inksoft">{job.description}</p>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 font-display text-lg font-extrabold uppercase text-ink">
                <Gauge size={16} className="text-coral" /> What you’ll do
              </h3>
              <ul className="space-y-2.5">
                {job.responsibilities.map((r, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm font-medium leading-relaxed text-inksoft">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-coral" /> {r}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 font-display text-lg font-extrabold uppercase text-ink">
                <Check size={16} className="text-grape" /> What you bring
              </h3>
              <ul className="space-y-2.5">
                {job.requirements.map((r, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm font-medium leading-relaxed text-inksoft">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-grape" /> {r}
                  </li>
                ))}
              </ul>
              {job.niceToHave.length > 0 && (
                <>
                  <h4 className="pt-2 text-xs font-extrabold uppercase tracking-widest text-inksoft">Bonus points</h4>
                  <ul className="space-y-2">
                    {job.niceToHave.map((r, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm font-medium leading-relaxed text-inksoft">
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sun" /> {r}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>

          {/* Perks */}
          <div className="rounded-[24px] border-2 border-ink bg-sun/40 p-6">
            <h3 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-ink">
              <Gift size={14} /> The good stuff
            </h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {job.perks.map((p) => (
                <span key={p} className="rounded-full border-2 border-ink bg-cream px-3.5 py-1.5 text-xs font-bold text-ink">
                  {p}
                </span>
              ))}
            </div>
          </div>

          {/* Apply */}
          <div className="flex flex-col items-start justify-between gap-4 border-t-2 border-dashed border-ink/15 pt-7 sm:flex-row sm:items-center">
            <p className="text-xs font-bold uppercase tracking-wider text-inksoft">
              Applications read by humans · reply within a week
            </p>
            <a
              href={`mailto:${applyEmail}?subject=${encodeURIComponent(`Application: ${job.title}`)}`}
              onClick={() => notify('Opening your mail app — good luck, hero!')}
              className="group inline-flex items-center gap-2.5 rounded-xl border-2 border-ink bg-coral px-7 py-4 text-sm font-extrabold uppercase tracking-wide text-white shadow-sticker transition-all hover:-translate-y-1 hover:bg-coraldeep hover:shadow-[6px_6px_0_0_var(--color-ink)] active:translate-y-0"
            >
              Apply for this role
              <Send size={15} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-0.5" />
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
