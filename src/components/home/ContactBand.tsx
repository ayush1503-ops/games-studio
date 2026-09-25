import React from 'react';
import { Mail, MessageCircle, MapPin } from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import { ContactForm } from '../contact/ContactForm';
import { Reveal } from '../ui/Reveal';
import { Squiggle, ControllerBit, CoinBit } from '../ui/Bits';
import { assetUrl } from '../../utils/asset';

const DEFAULT_DETAILS = {
  email: 'hello@brainchild.games',
  discord: 'Discord · 18,000 players',
  address: 'Montreal + everywhere',
};

export const ContactBand: React.FC = () => {
  const { setCurrentRoute, block } = useStudio();
  const details = block('contact.details', DEFAULT_DETAILS);

  return (
    <section id="contact-band" className="relative overflow-hidden bg-sand/60 py-24 sm:py-28">
      <div className="pointer-events-none absolute -right-24 top-10 h-80 w-80 rounded-full bg-grape/10 blur-3xl" aria-hidden="true" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12">
          {/* Form card */}
          <Reveal className="lg:col-span-7">
            <div className="rounded-[30px] border-2 border-ink bg-cream p-6 shadow-sticker sm:p-10">
              <span className="inline-flex -rotate-1 items-center gap-2 rounded-full border-2 border-ink bg-lime px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-ink shadow-sticker-sm">
                ✉️ Say hi
              </span>
              <h2 className="mt-4 font-display text-4xl font-extrabold uppercase leading-[0.95] tracking-tight text-ink sm:text-5xl">
                Let’s talk{' '}
                <span className="relative inline-block text-coral">
                  game
                  <Squiggle className="absolute -bottom-2 left-0 h-3.5 w-full" />
                </span>
              </h2>
              <p className="mt-4 max-w-md text-sm font-medium leading-relaxed text-inksoft sm:text-base">
                Press, publishers, players with physics questions, or someone who just really loves
                bells — the inbox is open.
              </p>
              <div className="mt-8">
                <ContactForm compact />
              </div>
            </div>
          </Reveal>

          {/* Playful visual */}
          <Reveal delay={0.1} className="lg:col-span-5">
            <div className="relative mx-auto max-w-sm lg:mt-10">
              <div className="rotate-2 rounded-[30px] border-2 border-ink bg-grape p-6 shadow-sticker transition-transform duration-300 hover:rotate-0">
                <div className="relative rounded-[22px] border-2 border-ink bg-cream p-4">
                  <img src={assetUrl("/images/mascot_pix.png")} alt="Pix waving hello" className="w-full rounded-[16px]" />
                  <div className="absolute -top-6 left-6 max-w-[210px] rotate-[-3deg] rounded-2xl border-2 border-ink bg-sun px-4 py-2.5 shadow-sticker-sm">
                    <p className="text-xs font-extrabold uppercase tracking-wide text-ink">
                      Got a quest for us? Drop it in the form!
                    </p>
                  </div>
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
                </div>
              </div>

              <div className="absolute -left-8 -top-8 hidden lg:block" aria-hidden="true">
                <ControllerBit className="w-16 animate-float" />
              </div>
              <div className="absolute -bottom-6 -right-4 hidden lg:block" aria-hidden="true">
                <CoinBit className="w-12 animate-float-slow" />
              </div>

              <button
                onClick={() => setCurrentRoute('contact')}
                className="mt-6 w-full rounded-xl border-2 border-ink bg-cream px-5 py-3 text-xs font-extrabold uppercase tracking-wider text-ink shadow-sticker-sm transition-all hover:-translate-y-0.5 hover:bg-sun cursor-pointer"
              >
                Full contact page & FAQ
              </button>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
};
