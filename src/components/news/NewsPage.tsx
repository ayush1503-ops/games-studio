import React, { useState } from 'react';
import { Search, Clock, ArrowRight, Ghost } from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import { ARTICLE_COLORS } from '../../utils/catalog';
import { Reveal } from '../ui/Reveal';
import { Squiggle } from '../ui/Bits';

interface NewsPageProps {
  mode?: 'news' | 'blog';
}

const NEWS_CATS = ['ALL', 'NEWS', 'ANNOUNCEMENT', 'COMMUNITY', 'STUDIO'];
const BLOG_CATS = ['ALL', 'DEVLOG', 'BEHIND THE SCENES', 'STUDIO', 'COMMUNITY'];

export const NewsPage: React.FC<NewsPageProps> = ({ mode = 'news' }) => {
  const { news, setSelectedArticle } = useStudio();
  const [category, setCategory] = useState('ALL');
  const [query, setQuery] = useState('');

  const published = news.filter((a) => a.published);
  const cats = mode === 'news' ? NEWS_CATS : BLOG_CATS;

  const filtered = published.filter((a) => {
    const matchCat = category === 'ALL' || a.category === category;
    const q = query.trim().toLowerCase();
    const matchQ =
      !q ||
      a.title.toLowerCase().includes(q) ||
      a.excerpt.toLowerCase().includes(q) ||
      a.tags.some((t) => t.toLowerCase().includes(q));
    return matchCat && matchQ;
  });

  const featured = filtered.find((a) => a.featured) || filtered[0];
  const rest = filtered.filter((a) => a.id !== featured?.id);

  return (
    <div id="news-page" className="relative min-h-screen overflow-hidden pt-32 pb-24 sm:pt-36">
      <div className="pointer-events-none absolute -left-32 top-24 h-96 w-96 rounded-full bg-sky/10 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-24 top-2/3 h-80 w-80 rounded-full bg-sun/20 blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        {/* Header */}
        <Reveal className="max-w-3xl space-y-5">
          <span className="inline-flex -rotate-1 items-center gap-2 rounded-full border-2 border-ink bg-sky px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-white shadow-sticker-sm">
            {mode === 'news' ? '📰 The newsroom' : '✍️ The blog'}
          </span>
          <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.92] tracking-tight text-ink sm:text-7xl">
            {mode === 'news' ? (
              <>
                What’s happening in the{' '}
                <span className="relative inline-block text-coral">
                  game world
                  <Squiggle className="absolute -bottom-3 left-0 h-4 w-full" />
                </span>
              </>
            ) : (
              <>
                Devlogs, stories &{' '}
                <span className="relative inline-block text-grape">
                  behind the scenes
                  <Squiggle color="#6C4CF1" className="absolute -bottom-3 left-0 h-4 w-full" />
                </span>
              </>
            )}
          </h1>
          <p className="text-base font-medium leading-relaxed text-inksoft">
            {mode === 'news'
              ? 'Announcements, updates and community happenings — straight from the studio floor, lightly edited for spelling.'
              : 'Long-form writeups from the people building the worlds: physics post-mortems, sound experiments, jam week chaos and mascot lore.'}
          </p>
        </Reveal>

        {/* Filters + search */}
        <Reveal delay={0.06} className="mt-10 flex flex-col gap-4 border-b-2 border-dashed border-ink/15 pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {cats.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`rounded-full border-2 border-ink px-4 py-2 text-xs font-extrabold uppercase tracking-wide transition-all duration-200 cursor-pointer ${
                  category === cat
                    ? '-rotate-1 scale-105 bg-grape text-white shadow-sticker-sm'
                    : 'bg-cream text-inksoft hover:-translate-y-0.5 hover:text-ink hover:shadow-sticker-sm'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-72">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-inksoft" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search stories…"
              className="w-full rounded-full border-2 border-ink/15 bg-cream py-2.5 pl-10 pr-4 text-sm font-semibold text-ink placeholder-inksoft/60 focus:border-grape focus:outline-none"
            />
          </div>
        </Reveal>

        {/* Featured cover story */}
        {featured && (
          <Reveal delay={0.08} className="mt-10">
            <article
              onClick={() => setSelectedArticle(featured)}
              className="group grid cursor-pointer grid-cols-1 overflow-hidden rounded-[30px] border-2 border-ink/10 bg-cream shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:border-ink/30 hover:shadow-lift lg:grid-cols-12"
            >
              <div className="relative overflow-hidden lg:col-span-7">
                <img
                  src={featured.coverImage}
                  alt={featured.title}
                  className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-105 lg:h-full"
                />
                <span
                  className={`absolute left-4 top-4 -rotate-2 rounded-full border-2 border-ink px-3.5 py-1 text-[10px] font-extrabold uppercase tracking-wider shadow-sticker-sm ${
                    ARTICLE_COLORS[featured.category]
                  }`}
                >
                  Cover story · {featured.category}
                </span>
              </div>
              <div className="flex flex-col justify-between gap-6 p-7 sm:p-10 lg:col-span-5">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-inksoft">
                    <span>{featured.date}</span>
                    <span className="h-1 w-1 rounded-full bg-ink/30" />
                    <span className="inline-flex items-center gap-1">
                      <Clock size={12} /> {featured.readTime}
                    </span>
                  </div>
                  <h2 className="font-display text-2xl font-extrabold leading-tight text-ink transition-colors group-hover:text-grape sm:text-4xl">
                    {featured.title}
                  </h2>
                  <p className="text-sm font-medium leading-relaxed text-inksoft">{featured.excerpt}</p>
                </div>
                <div className="flex items-center justify-between border-t-2 border-dashed border-ink/15 pt-4">
                  <span className="text-xs font-bold text-inksoft">
                    By <span className="text-ink">{featured.author.name}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-wider text-coral">
                    Read <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </div>
            </article>
          </Reveal>
        )}

        {/* Grid */}
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rest.map((article, i) => (
            <Reveal key={article.id} delay={0.05 * i}>
              <article
                onClick={() => setSelectedArticle(article)}
                className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-[26px] border-2 border-ink/10 bg-cream shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:border-ink/30 hover:shadow-lift"
              >
                <div className="relative overflow-hidden">
                  <img
                    src={article.coverImage}
                    alt={article.title}
                    className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span
                    className={`absolute left-3 top-3 -rotate-2 rounded-full border-2 border-ink px-3 py-0.5 text-[9px] font-extrabold uppercase tracking-wider shadow-sticker-sm ${
                      ARTICLE_COLORS[article.category]
                    }`}
                  >
                    {article.category}
                  </span>
                </div>
                <div className="flex flex-1 flex-col justify-between gap-4 p-6">
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-inksoft">
                      <span>{article.date}</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={11} /> {article.readTime}
                      </span>
                    </div>
                    <h3 className="font-display text-lg font-extrabold leading-snug text-ink transition-colors group-hover:text-grape">
                      {article.title}
                    </h3>
                    <p className="text-xs font-medium leading-relaxed text-inksoft line-clamp-3">{article.excerpt}</p>
                  </div>
                  <div className="flex items-center justify-between border-t-2 border-dashed border-ink/10 pt-3 text-[11px] font-bold">
                    <span className="text-inksoft">{article.author.name}</span>
                    <span className="inline-flex items-center gap-1 uppercase tracking-wider text-coral">
                      Read <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="mt-12 flex flex-col items-center gap-3 rounded-[26px] border-2 border-dashed border-ink/25 bg-cream/60 p-14 text-center">
            <Ghost size={40} className="text-sky" />
            <p className="font-display text-2xl font-extrabold uppercase text-ink">No stories here yet</p>
            <p className="max-w-sm text-sm font-medium text-inksoft">
              Try another category, or clear the search — the ink is still drying on a few pieces.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
