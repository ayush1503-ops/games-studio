import React from 'react';
import { Mail, MessageCircle, MapPin, Clock } from 'lucide-react';
import { ContactForm } from './ContactForm';
import { Reveal } from '../ui/Reveal';
import { Squiggle, ControllerBit, StarSticker, JoystickBit } from '../ui/Bits';
import { useStudio } from '../../context/StudioContext';
import { assetUrl } from '../../utils/asset';

/** Fallbacks — the “contact.details” block in the CMS overrides these. */
const DEFAULT_DETAILS = {
  email: 'hello@brainchild.games',
  discord: 'Discord · 18,000 players',
  address: '4210 Saint-Laurent, Montreal',
  hours: 'Replies within 48h, Mon–Thu',
  faq: [
    { q: 'How fast do you reply?', a: 'Within 48 hours, by a human with a name.' },
    { q: 'Press & review keys?', a: 'Email us with your outlet and we’ll sort you out same-day.' },
    { q: 'Bug reports?', a: 'Yes please! Player Support category, screenshots appreciated.' },
  ],
};

export const ContactPage: React.FC = () => {
  const { block } = useStudio();
  const details = block('contact.details', DEFAULT_DETAILS);
  const FAQ = (details.faq?.length ? details.faq : DEFAULT_DETAILS.faq).map((item: any) => ({
    q: item.q ?? item.question,
    a: item.a ?? item.answer,
  }));

  return (
    <div id="contact-page" className="relative min-h-screen overflow-hidden pt-32 pb-24 sm:pt-36">
      <div className="pointer-events-none absolute -right-32 top-24 h-96 w-96 rounded-full bg-coral/10 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -left-24 bottom-10 h-96 w-96 rounded-full bg-sky/10 blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        {/* Header */}
        <Reveal className="max-w-3xl space-y-5">
          <span className="inline-flex -rotate-1 items-center gap-2 rounded-full border-2 border-ink bg-lime px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-ink shadow-sticker-sm">
            ✉️ Open inbox
          </span>
          <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.92] tracking-tight text-ink sm:text-7xl">
            Let’s talk{' '}
            <span className="relative inline-block text-coral">
              game
              <Squiggle className="absolute -bottom-3 left-0 h-4 w-full" />
            </span>
          </h1>
          <p className="text-base font-medium leading-relaxed text-inksoft sm:text-lg">
            Publishers, journalists, composers, players with strong opinions about bell physics —
            everyone gets a reply. Pick a category, tell us everything, and Pix will fetch the right
            human.
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 items-start gap-10 lg:grid-cols-12">
          {/* Form */}
          <Reveal className="lg:col-span-7">
            <div className="rounded-[30px] border-2 border-ink bg-cream p-6 shadow-sticker sm:p-10">
              <ContactForm />
            </div>
          </Reveal>

          {/* Side: visual + channels + FAQ */}
          <div className="space-y-6 lg:col-span-5">
            <Reveal delay={0.08}>
              <div className="relative rotate-2 rounded-[30px] border-2 border-ink bg-grape p-6 shadow-sticker transition-transform duration-300 hover:rotate-0">
                <div className="rounded-[22px] border-2 border-ink bg-cream p-4">
                  <img src={assetUrl("/images/mascot_pix.png")} alt="Pix ready to help" className="w-full rounded-[16px]" />
                </div>
                <div className="absolute -top-6 right-6 max-w-[200px] rotate-3 rounded-2xl border-2 border-ink bg-sun px-4 py-2.5 shadow-sticker-sm">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-ink">Pix reads every message. Twice.</p>
                </div>
                <div className="mt-5 space-y-2.5">
                  <div className="flex items-center gap-3 rounded-xl border-2 border-ink/25 bg-white/15 px-4 py-2.5 text-xs font-bold text-white">
                    <Mail size={14} className="shrink-0 text-sun" /> {details.email}
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border-2 border-ink/25 bg-white/15 px-4 py-2.5 text-xs font-bold text-white">
                    <MessageCircle size={14} className="shrink-0 text-sun" /> {details.discord}
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border-2 border-ink/25 bg-white/15 px-4 py-2.5 text-xs font-bold text-white">
                    <MapPin size={14} className="shrink-0 text-sun" /> {details.address}
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border-2 border-ink/25 bg-white/15 px-4 py-2.5 text-xs font-bold text-white">
                    <Clock size={14} className="shrink-0 text-sun" /> {details.hours}
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.14}>
              <div className="rounded-[26px] border-2 border-ink/10 bg-cream p-6 shadow-soft">
                <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-widest text-inksoft">
                  <StarSticker className="w-4" /> Quick answers
                </div>
                <div className="mt-4 space-y-4">
                  {FAQ.map((f) => (
                    <div key={f.q} className="border-b-2 border-dashed border-ink/10 pb-3 last:border-0 last:pb-0">
                      <div className="text-sm font-extrabold text-ink">{f.q}</div>
                      <div className="mt-1 text-xs font-medium leading-relaxed text-inksoft">{f.a}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            <div className="hidden justify-center gap-6 lg:flex" aria-hidden="true">
              <ControllerBit className="w-16 animate-float" />
              <JoystickBit className="w-12 animate-float-slow" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
