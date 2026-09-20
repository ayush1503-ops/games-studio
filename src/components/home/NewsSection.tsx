import React from 'react';
import { ArrowRight, Clock, ArrowUpRight } from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import { ARTICLE_COLORS } from '../../utils/catalog';
import { Reveal } from '../ui/Reveal';

export const NewsSection: React.FC = () => {
  const { news, setSelectedArticle, setCurrentRoute } = useStudio();
  const published = news.filter((a) => a.published);
  const featured = published.find((a) => a.featured) || published[0];
  const rest = published.filter((a) => a.id !== featured?.id).slice(0, 3);

  return (
    <section id="news-section" className="relative bg-sand/60 py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        {/* Heading */}
        <Reveal className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-4">
            <span className="inline-flex -rotate-1 items-center gap-2 rounded-full border-2 border-ink bg-sky px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-white shadow-sticker-sm">
              📰 Fresh ink
            </span>
            <h2 className="max-w-xl font-display text-4xl font-extrabold uppercase leading-[0.95] tracking-tight text-ink sm:text-6xl">
              What’s happening in the game world
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setCurrentRoute('news')}
              className="group inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-cream px-5 py-3 text-xs font-extrabold uppercase tracking-wider text-ink shadow-sticker-sm transition-all hover:-translate-y-0.5 hover:bg-sun cursor-pointer"
            >
              All news <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
            </button>
            <button
              onClick={() => setCurrentRoute('blog')}
              className="group inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-grape px-5 py-3 text-xs font-extrabold uppercase tracking-wider text-white shadow-sticker-sm transition-all hover:-translate-y-0.5 hover:bg-grapedeep cursor-pointer"
            >
              Read the blog <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          </div>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Featured story */}
          {featured && (
            <Reveal className="lg:col-span-7">
              <article
                onClick={() => setSelectedArticle(featured)}
                className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-[28px] border-2 border-ink/10 bg-cream shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:border-ink/30 hover:shadow-lift"
              >
                <div className="relative overflow-hidden">
                  <img
                    src={featured.coverImage}
                    alt={featured.title}
                    className="aspect-[16/9] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span
                    className={`absolute left-4 top-4 -rotate-2 rounded-full border-2 border-ink px-3.5 py-1 text-[10px] font-extrabold uppercase tracking-wider shadow-sticker-sm ${
                      ARTICLE_COLORS[featured.category]
                    }`}
                  >
                    {featured.category}
                  </span>
                </div>
                <div className="flex flex-1 flex-col justify-between gap-5 p-6 sm:p-8">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-inksoft">
                      <span>{featured.date}</span>
                      <span className="h-1 w-1 rounded-full bg-ink/30" />
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} /> {featured.readTime}
                      </span>
                    </div>
                    <h3 className="font-display text-2xl font-extrabold leading-tight text-ink transition-colors group-hover:text-grape sm:text-3xl">
                      {featured.title}
                    </h3>
                    <p className="text-sm font-medium leading-relaxed text-inksoft">{featured.excerpt}</p>
                  </div>
                  <div className="flex items-center justify-between border-t-2 border-dashed border-ink/15 pt-4">
                    <span className="text-xs font-bold text-inksoft">
                      By <span className="text-ink">{featured.author.name}</span> · {featured.author.role}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-wider text-coral">
                      Read story <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </div>
              </article>
            </Reveal>
          )}

          {/* Side stack */}
          <div className="flex flex-col gap-5 lg:col-span-5">
            {rest.map((article, i) => (
              <Reveal key={article.id} delay={0.06 * (i + 1)} className="flex-1">
                <article
                  onClick={() => setSelectedArticle(article)}
                  className="group flex h-full cursor-pointer gap-4 rounded-[24px] border-2 border-ink/10 bg-cream p-4 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-ink/30 hover:shadow-lift"
                >
                  <div className="relative w-28 shrink-0 overflow-hidden rounded-2xl border-2 border-ink/10 sm:w-32">
                    <img
                      src={article.coverImage}
                      alt={article.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 py-1">
                    <div className="space-y-1.5">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${
                          ARTICLE_COLORS[article.category]
                        }`}
                      >
                        {article.category}
                      </span>
                      <h4 className="font-display text-base font-extrabold leading-snug text-ink transition-colors group-hover:text-grape">
                        {article.title}
                      </h4>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-inksoft">
                      <span>{article.date}</span>
                      <ArrowRight size={13} className="text-coral transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
