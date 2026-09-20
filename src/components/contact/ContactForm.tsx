import React, { useState } from 'react';
import { Send, CheckCircle2, RotateCcw } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useStudio } from '../../context/StudioContext';

const CATEGORIES = ['Publishing', 'Press', 'Partnership', 'Player Support', 'Other'] as const;
type Category = (typeof CATEGORIES)[number];

interface ContactFormProps {
  compact?: boolean;
}

export const ContactForm: React.FC<ContactFormProps> = ({ compact = false }) => {
  const { submitContact, notify } = useStudio();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<Category>('Player Support');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) return;

    const result = await submitContact({
      name,
      email,
      company: company || undefined,
      subject: subject || `${category} inquiry from ${name}`,
      projectType: category,
      message,
    });

    if (!result.success) {
      notify(result.message);
      return;
    }

    confetti({
      particleCount: 90,
      spread: 75,
      origin: { y: 0.7 },
      colors: ['#FF5A3C', '#6C4CF1', '#FFC53D', '#A8D92C', '#2FB9DD']
    });
    notify(result.message || 'Message sent — Pix is fetching the team!');
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 rounded-[26px] border-2 border-ink bg-cream p-10 text-center shadow-soft animate-pop">
        <span className="grid h-16 w-16 place-items-center rounded-2xl border-2 border-ink bg-lime shadow-sticker-sm">
          <CheckCircle2 size={30} className="text-ink" />
        </span>
        <h3 className="font-display text-2xl font-extrabold uppercase text-ink">Message received!</h3>
        <p className="max-w-sm text-sm font-medium leading-relaxed text-inksoft">
          Thanks, <span className="font-extrabold text-ink">{name}</span>. A human (not a bot, we
          promise) will reply to <span className="font-extrabold text-grape">{email}</span> within 48
          hours.
        </p>
        <button
          onClick={() => {
            setIsSubmitted(false);
            setName('');
            setEmail('');
            setMessage('');
            setSubject('');
            setCompany('');
          }}
          className="inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-sun px-5 py-3 text-xs font-extrabold uppercase tracking-wider text-ink shadow-sticker-sm transition-transform hover:-translate-y-0.5 cursor-pointer"
        >
          <RotateCcw size={13} /> Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!compact && (
        <div className="space-y-2">
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-inksoft">
            What’s this about?
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`rounded-full border-2 border-ink px-4 py-1.5 text-xs font-extrabold transition-all cursor-pointer ${
                  category === cat
                    ? '-rotate-1 bg-grape text-white shadow-sticker-sm'
                    : 'bg-cream text-inksoft hover:-translate-y-0.5 hover:text-ink'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="contact-name" className="text-[11px] font-extrabold uppercase tracking-widest text-inksoft">
            Name *
          </label>
          <input
            id="contact-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex Player"
            className="w-full rounded-xl border-2 border-ink/15 bg-cream px-4 py-3 text-sm font-semibold text-ink placeholder-inksoft/60 transition-colors focus:border-grape focus:outline-none"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="contact-email" className="text-[11px] font-extrabold uppercase tracking-widest text-inksoft">
            Email *
          </label>
          <input
            id="contact-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="alex@playground.gg"
            className="w-full rounded-xl border-2 border-ink/15 bg-cream px-4 py-3 text-sm font-semibold text-ink placeholder-inksoft/60 transition-colors focus:border-grape focus:outline-none"
          />
        </div>
      </div>

      {!compact && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="contact-company" className="text-[11px] font-extrabold uppercase tracking-widest text-inksoft">
              Studio / outlet (optional)
            </label>
            <input
              id="contact-company"
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Edge Magazine"
              className="w-full rounded-xl border-2 border-ink/15 bg-cream px-4 py-3 text-sm font-semibold text-ink placeholder-inksoft/60 transition-colors focus:border-grape focus:outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="contact-subject" className="text-[11px] font-extrabold uppercase tracking-widest text-inksoft">
              Subject
            </label>
            <input
              id="contact-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="One-line summary"
              className="w-full rounded-xl border-2 border-ink/15 bg-cream px-4 py-3 text-sm font-semibold text-ink placeholder-inksoft/60 transition-colors focus:border-grape focus:outline-none"
            />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="contact-message" className="text-[11px] font-extrabold uppercase tracking-widest text-inksoft">
          Message *
        </label>
        <textarea
          id="contact-message"
          rows={compact ? 4 : 5}
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us everything. Especially the fun parts."
          className="w-full resize-y rounded-xl border-2 border-ink/15 bg-cream px-4 py-3 text-sm font-semibold text-ink placeholder-inksoft/60 transition-colors focus:border-grape focus:outline-none"
        />
      </div>

      <button
        type="submit"
        className="group inline-flex w-full items-center justify-center gap-2.5 rounded-xl border-2 border-ink bg-coral px-8 py-4 text-sm font-extrabold uppercase tracking-wide text-white shadow-sticker transition-all hover:-translate-y-1 hover:bg-coraldeep hover:shadow-[6px_6px_0_0_var(--color-ink)] active:translate-y-0 active:shadow-sticker-sm sm:w-auto cursor-pointer"
      >
        Send message
        <Send size={15} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-0.5" />
      </button>
    </form>
  );
};
