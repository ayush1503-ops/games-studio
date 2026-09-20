import React, { useState, useEffect } from 'react';
import { Newspaper, Plus, Search, Filter, Edit3, Trash2, Eye, Calendar, Tag, Image as ImageIcon } from 'lucide-react';
import { newsApi, categoriesApi, mediaApi, ApiError } from '../utils/api';
import type { NewsFilters } from '../utils/api';
import type { AdminPost } from '../types';
import { notify } from '../utils/toast';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';

interface NewsItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage?: string;
  categoryId: string;
  category?: { id: string; name: string; color: string };
  authorName: string;
  authorRole: string;
  tags: string[];
  status: 'DRAFT' | 'PUBLISHED';
  featured: boolean;
  publishedAt?: string;
  createdAt: string;
}

/** Maps the API's AdminPost shape onto this page's working model. */
function toNewsItem(post: AdminPost): NewsItem {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    content: post.content,
    coverImage: post.coverImage,
    categoryId: post.categoryId ?? '',
    category: { id: post.categoryId ?? '', name: post.category, color: post.categoryColor ?? '' },
    authorName: post.author?.name ?? 'Studio Team',
    authorRole: post.author?.role ?? 'Editor',
    tags: post.tags,
    status: post.status,
    featured: post.featured,
    publishedAt: post.publishedAt ?? undefined,
    createdAt: post.createdAt,
  };
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export const NewsAdminPage: React.FC = () => {
  const [articles, setArticles] = useState<NewsItem[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<NewsItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NewsItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    excerpt: '',
    content: '',
    coverImage: '',
    categoryId: '',
    authorName: 'Studio Team',
    authorRole: 'Editor',
    tags: '',
    status: 'DRAFT' as 'DRAFT' | 'PUBLISHED',
    featured: false
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [newsRes, catRes] = await Promise.all([
        newsApi.list({ search: search || undefined, status: statusFilter as NewsFilters['status'] }),
        categoriesApi.list()
      ]);
      setArticles(newsRes.items.map(toNewsItem));
      setCategories(catRes);
    } catch (err) {
      notify(errorMessage(err, 'Failed to load news posts'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, statusFilter]);

  const handleOpenCreate = () => {
    setEditingArticle(null);
    setFormData({
      title: '',
      excerpt: '',
      content: '',
      coverImage: '',
      categoryId: categories[0]?.id || '',
      authorName: 'Studio Team',
      authorRole: 'Editor',
      tags: '',
      status: 'DRAFT',
      featured: false
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (article: NewsItem) => {
    setEditingArticle(article);
    setFormData({
      title: article.title,
      excerpt: article.excerpt,
      content: article.content,
      coverImage: article.coverImage || '',
      categoryId: article.categoryId,
      authorName: article.authorName,
      authorRole: article.authorRole,
      tags: article.tags.join(', '),
      status: article.status,
      featured: article.featured
    });
    setIsModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const asset = await mediaApi.upload(file);
      setFormData(prev => ({ ...prev, coverImage: asset.url }));
      notify('Cover image uploaded', 'success');
    } catch (err) {
      notify(errorMessage(err, 'Failed to upload image'), 'error');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.categoryId || !formData.content) {
      notify('Please fill out title, category, and content', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean)
      };

      if (editingArticle) {
        await newsApi.update(editingArticle.id, payload);
        notify('Article updated successfully', 'success');
      } else {
        await newsApi.create(payload);
        notify('Article created successfully', 'success');
      }

      setIsModalOpen(false);
      loadData();
    } catch (err) {
      notify(errorMessage(err, 'Failed to save article'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await newsApi.remove(deleteTarget.id, deleteTarget.slug);
      notify('Article deleted', 'success');
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      notify(errorMessage(err, 'Failed to delete article'), 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold uppercase tracking-tight text-ink flex items-center gap-2">
            <Newspaper className="text-grape" /> News & Devlog Articles
          </h1>
          <p className="text-sm font-medium text-inksoft">
            Manage studio announcements, devlogs, patch notes, and articles
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 rounded-xl border-2 border-ink bg-coral px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider text-white shadow-sticker hover:bg-coraldeep cursor-pointer"
        >
          <Plus size={16} /> Add Article
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-cream p-4 rounded-2xl border-2 border-ink shadow-sticker-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-inksoft" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search articles by title or excerpt..."
            className="w-full rounded-xl border-2 border-ink/15 bg-paper px-4 py-2 pl-9 text-xs font-semibold text-ink placeholder-inksoft focus:border-grape focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter size={16} className="text-inksoft" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="rounded-xl border-2 border-ink/15 bg-paper px-3 py-2 text-xs font-bold text-ink focus:border-grape focus:outline-none"
          >
            <option value="ALL">All Status</option>
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Drafts</option>
          </select>
        </div>
      </div>

      {/* Articles Table */}
      <div className="rounded-2xl border-2 border-ink bg-cream overflow-hidden shadow-sticker-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-semibold">
            <thead className="border-b-2 border-ink bg-sand/50 text-[10px] uppercase tracking-wider text-inksoft">
              <tr>
                <th className="p-4">Article</th>
                <th className="p-4">Category</th>
                <th className="p-4">Author</th>
                <th className="p-4">Status</th>
                <th className="p-4">Featured</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y border-ink/10">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-inksoft">Loading news articles...</td>
                </tr>
              ) : articles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-inksoft">No articles found. Click "Add Article" to publish your first post.</td>
                </tr>
              ) : (
                articles.map(article => (
                  <tr key={article.id} className="hover:bg-sand/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {article.coverImage ? (
                          <img src={article.coverImage} alt="" className="h-10 w-14 object-cover rounded-lg border border-ink/20" />
                        ) : (
                          <div className="h-10 w-14 bg-paper rounded-lg border border-ink/20 flex items-center justify-center text-inksoft">
                            <ImageIcon size={16} />
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-ink line-clamp-1">{article.title}</p>
                          <p className="text-[10px] text-inksoft line-clamp-1">{article.excerpt}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-grape/10 text-grape border border-grape/20">
                        {article.category?.name || 'News'}
                      </span>
                    </td>
                    <td className="p-4 text-inksoft">{article.authorName}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                        article.status === 'PUBLISHED' ? 'bg-moss/10 text-moss border border-moss/20' : 'bg-sun/20 text-ink border border-sun'
                      }`}>
                        {article.status}
                      </span>
                    </td>
                    <td className="p-4">
                      {article.featured ? (
                        <span className="text-[10px] font-bold text-coral uppercase tracking-wide">★ Featured</span>
                      ) : (
                        <span className="text-[10px] text-inksoft/60">Standard</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(article)}
                          className="p-1.5 rounded-lg border border-ink/15 bg-paper hover:bg-grape hover:text-white transition-colors cursor-pointer"
                          title="Edit Article"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(article)}
                          className="p-1.5 rounded-lg border border-coral/30 bg-coral/10 text-coral hover:bg-coral hover:text-white transition-colors cursor-pointer"
                          title="Delete Article"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit / Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[24px] border-2 border-ink bg-cream p-6 shadow-lift my-8">
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-ink mb-4">
              {editingArticle ? 'Edit Article' : 'Create Article'}
            </h2>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-inksoft">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full rounded-xl border-2 border-ink/15 bg-paper px-3 py-2 text-xs font-semibold text-ink"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-inksoft">Category *</label>
                  <select
                    value={formData.categoryId}
                    onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full rounded-xl border-2 border-ink/15 bg-paper px-3 py-2 text-xs font-semibold text-ink"
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-inksoft">Publishing Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full rounded-xl border-2 border-ink/15 bg-paper px-3 py-2 text-xs font-semibold text-ink"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-inksoft">Excerpt (Short Summary)</label>
                <textarea
                  value={formData.excerpt}
                  onChange={e => setFormData({ ...formData, excerpt: e.target.value })}
                  className="w-full rounded-xl border-2 border-ink/15 bg-paper p-3 text-xs font-semibold text-ink h-20"
                  placeholder="Brief summary of the article..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-inksoft">Full Content (Markdown supported) *</label>
                <textarea
                  value={formData.content}
                  onChange={e => setFormData({ ...formData, content: e.target.value })}
                  className="w-full rounded-xl border-2 border-ink/15 bg-paper p-3 text-xs font-semibold text-ink h-44 font-mono"
                  placeholder="Write article content here..."
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-inksoft">Cover Image</label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={formData.coverImage}
                    onChange={e => setFormData({ ...formData, coverImage: e.target.value })}
                    placeholder="/uploads/news-cover.jpg"
                    className="flex-1 rounded-xl border-2 border-ink/15 bg-paper px-3 py-2 text-xs font-semibold text-ink"
                  />
                  <label className="rounded-xl border-2 border-ink bg-grape px-3 py-2 text-xs font-bold text-white cursor-pointer hover:bg-grapedeep">
                    Upload
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-inksoft">Author Name</label>
                  <input
                    type="text"
                    value={formData.authorName}
                    onChange={e => setFormData({ ...formData, authorName: e.target.value })}
                    className="w-full rounded-xl border-2 border-ink/15 bg-paper px-3 py-2 text-xs font-semibold text-ink"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-inksoft">Tags (comma separated)</label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={e => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="Devlog, Physics, Update"
                    className="w-full rounded-xl border-2 border-ink/15 bg-paper px-3 py-2 text-xs font-semibold text-ink"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="featured"
                  checked={formData.featured}
                  onChange={e => setFormData({ ...formData, featured: e.target.checked })}
                  className="h-4 w-4 rounded border-2 border-ink"
                />
                <label htmlFor="featured" className="text-xs font-bold text-ink cursor-pointer">
                  Feature this article on the homepage header
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t-2 border-ink/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border-2 border-ink/20 px-4 py-2 text-xs font-bold uppercase text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl border-2 border-ink bg-coral px-5 py-2 text-xs font-extrabold uppercase text-white shadow-sticker"
                >
                  {isSaving ? 'Saving...' : 'Save Article'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        title="Delete News Article"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
};
