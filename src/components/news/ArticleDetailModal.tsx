import React from 'react';
import { X, Clock, User, Share2, Tag } from 'lucide-react';
import { motion } from 'motion/react';
import { Article } from '../../types';
import { useStudio } from '../../context/StudioContext';
import { ARTICLE_COLORS } from '../../utils/catalog';

interface ArticleDetailModalProps {
  article: Article | null;
  onClose: () => void;
}

export const ArticleDetailModal: React.FC<ArticleDetailModalProps> = ({ article, onClose }) => {
  const { notify } = useStudio();
  if (!article) return null;

  return (
    <div
      id="article-detail-modal"
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
        <button
          onClick={onClose}
          className="absolute right-5 top-5 z-30 grid h-11 w-11 place-items-center rounded-full border-2 border-ink bg-cream text-ink shadow-sticker-sm transition-all hover:bg-coral hover:text-white cursor-pointer"
          aria-label="Close article"
        >
          <X size={19} />
        </button>

        {/* Cover */}
        <div className="relative aspect-[21/9] w-full overflow-hidden">
          <img src={article.coverImage} alt={article.title} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent" aria-hidden="true" />
          <span className={`absolute left-6 top-6 -rotate-2 rounded-full border-2 border-ink px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider shadow-sticker-sm ${ARTICLE_COLORS[article.category]}`}>
            {article.category}
          </span>
        </div>

        <div className="space-y-8 p-6 sm:p-10 lg:p-12">
          {/* Meta + title */}
          <div className="space-y-4 border-b-2 border-dashed border-ink/15 pb-8">
            <div className="flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-wider text-inksoft">
              <span>{article.date}</span>
              <span className="h-1 w-1 rounded-full bg-ink/30" />
              <span className="inline-flex items-center gap-1.5 text-grape">
                <Clock size={12} /> {article.readTime}
              </span>
            </div>

            <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
              {article.title}
            </h1>

            <div className="flex items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl border-2 border-ink bg-sun text-ink shadow-sticker-sm">
                  <User size={18} />
                </span>
                <div>
                  <div className="text-sm font-extrabold text-ink">{article.author.name}</div>
                  <div className="text-xs font-bold uppercase tracking-wider text-inksoft">{article.author.role}</div>
                </div>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href);
                  notify('Link copied — share the good stuff!');
                }}
                className="grid h-11 w-11 place-items-center rounded-xl border-2 border-ink bg-cream text-ink transition-all hover:-translate-y-0.5 hover:bg-grape hover:text-white cursor-pointer"
                title="Copy link"
              >
                <Share2 size={16} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="space-y-5 text-base font-medium leading-relaxed text-inksoft sm:text-lg">
            {article.content.split('\n\n').map((para, i) =>
              para.startsWith('### ') ? (
                <h3 key={i} className="pt-4 font-display text-xl font-extrabold text-grape sm:text-2xl">
                  {para.replace('### ', '')}
                </h3>
              ) : (
                <p key={i}>{para}</p>
              )
            )}
          </div>

          {/* Tags */}
          <div className="flex flex-wrap items-center gap-2 border-t-2 border-dashed border-ink/15 pt-7">
            <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-inksoft">
              <Tag size={12} /> Tags
            </span>
            {article.tags.map((tag) => (
              <span key={tag} className="rounded-full border-2 border-ink/15 bg-cream px-3.5 py-1 text-xs font-bold text-inksoft">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
