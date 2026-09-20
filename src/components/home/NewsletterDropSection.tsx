import React, { useState } from 'react';
import { Send, CheckCircle2, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useStudio } from '../../context/StudioContext';
import { Reveal } from '../ui/Reveal';
import { CartridgeBit, StarSticker } from '../ui/Bits';

const INTERESTS = ['Beta access', 'New game drops', 'Devlogs & tech', 'Merch & vinyl'];

export const NewsletterDropSection: React.FC = () => {
  const { subscribeNewsletter, notify } = useStudio();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selected, setSelected] = useState<string[]>(['New game drops']);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const toggle = (option: string) =>
    setSelected((prev) => (prev.includes(option) ? prev.filter((i) => i !== option) : [...prev, option]));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setStatus({ type: 'error', text: 'We need an email to deliver the good stuff.' });
      return;
    }
    const res = subscribeNewsletter(name, email, selected);
    if (res.success) {
      confetti({ particleCount: 70, spread: 70, origin: { y: 0.8 }, colors: ['#FF5A3C', '#6C4CF1', '#FFC53D', '#A8D92C'] });
      notify('You’re on the list. Welcome aboard!');
      setStatus({ type: 'success', text: res.message });
      setName('');
      setEmail('');
    } else {
      setStatus({ type: 'error', text: res.message });
    }
  };

  return (
    <section id="newsletter-section" className="relative py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10">
        <Reveal>
          <div className="relative overflow-hidden rounded-[36px] border-2 border-ink bg-sun shadow-lift">
            <div className="absolute inset-0 bg-dots opacity-30" aria-hidden="true" />
            <div className="absolute -right-6 -top-8 rotate-12" aria-hidden="true">
              <CartridgeBit className="w-20 animate-float" />
            </div>

            <div className="relative z-10 grid grid-cols-1 gap-10 p-8 sm:p-12 lg:grid-cols-12 lg:p-16">
              <div className="lg:col-span-7">
                <span className="inline-flex -rotate-2 items-center gap-2 rounded-full border-2 border-ink bg-cream px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-ink shadow-sticker-sm">
                  📬 The drop
                </span>
                <h2 className="mt-5 font-display text-4xl font-extrabold uppercase leading-[0.95] tracking-tight text-ink sm:text-6xl">
                  Get the next drop first
                </h2>
                <p className="mt-4 max-w-md text-sm font-medium leading-relaxed text-ink/75 sm:text-base">
                  Launches, closed playtests, dev stories and the occasional secret prototype. One
                  email a month, zero spam, unsubscribe whenever.
                </p>

                <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Player handle (optional)"
                      aria-label="Player handle"
                      className="w-full rounded-xl border-2 border-ink bg-cream px-4 py-3.5 text-sm font-semibold text-ink placeholder-inksoft/60 focus:outline-none focus:ring-4 focus:ring-grape/30"
                    />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@playground.gg"
                      aria-label="Email address"
                      className="w-full rounded-xl border-2 border-ink bg-cream px-4 py-3.5 text-sm font-semibold text-ink placeholder-inksoft/60 focus:outline-none focus:ring-4 focus:ring-grape/30"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {INTERESTS.map((option) => {
                      const on = selected.includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => toggle(option)}
                          className={`rounded-full border-2 border-ink px-4 py-2 text-xs font-extrabold transition-all cursor-pointer ${
                            on
                              ? '-rotate-1 bg-ink text-paper shadow-sticker-sm'
                              : 'bg-cream/80 text-ink hover:-translate-y-0.5 hover:bg-cream'
                          }`}
                        >
                          {on ? '✓ ' : '+ '}
                          {option}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-col items-start gap-4 pt-1 sm:flex-row sm:items-center">
                    <button
                      type="submit"
                      className="group inline-flex items-center gap-2.5 rounded-xl border-2 border-ink bg-coral px-7 py-4 text-sm font-extrabold uppercase tracking-wide text-white shadow-sticker transition-all hover:-translate-y-1 hover:bg-coraldeep hover:shadow-[6px_6px_0_0_var(--color-ink)] active:translate-y-0 cursor-pointer"
                    >
                      Count me in
                      <Send size={15} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-0.5" />
                    </button>
                    <span className="text-xs font-bold text-ink/60">No trackers. No tricks. Just games.</span>
                  </div>

                  {status && (
                    <div
                      className={`flex items-center gap-2 rounded-xl border-2 border-ink px-4 py-3 text-xs font-extrabold ${
                        status.type === 'success' ? 'bg-lime text-ink' : 'bg-coral text-white'
                      }`}
                    >
                      {status.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                      {status.text}
                    </div>
                  )}
                </form>
              </div>

              {/* Mascot side */}
              <div className="flex flex-col items-center justify-center lg:col-span-5">
                <div className="relative w-56 rotate-3 rounded-[26px] border-2 border-ink bg-cream p-3 shadow-sticker transition-transform duration-300 hover:rotate-0 sm:w-64">
                  <img src="/images/mascot_pix.png" alt="Pix holding the newsletter" className="w-full rounded-[18px]" />
                  <span className="absolute -left-4 -top-4 -rotate-6 rounded-full border-2 border-ink bg-grape px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-sticker-sm animate-bob">
                    1 email / month
                  </span>
                </div>
                <div className="mt-5 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-ink/70">
                  <StarSticker className="w-4 animate-wiggle" />
                  12,400 players already subscribed
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};
