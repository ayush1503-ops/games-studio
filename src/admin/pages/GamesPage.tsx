import React, { useEffect, useState } from 'react';
import {
  Plus, Search, Filter, MoreVertical, Edit2, Trash2, Copy, Eye,
  ExternalLink, Flag, Star, Loader2, X, Check, Upload, Sparkles,
  ShoppingBag, Link2, Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { gamesApi, type GameFilters } from '../utils/api';
import type { AdminGame } from '../types';
import { notify } from '../utils/toast';

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'IN_DEVELOPMENT', label: 'In Development' },
  { value: 'EARLY_ACCESS', label: 'Early Access' },
  { value: 'WISHLIST_NOW', label: 'Wishlist Now' },
  { value: 'AVAILABLE_NOW', label: 'Available Now' }
];

const STATUS_BADGES: Record<string, string> = {
  IN_DEVELOPMENT: 'bg-grape text-white',
  EARLY_ACCESS: 'bg-sun text-ink',
  WISHLIST_NOW: 'bg-coral text-white',
  AVAILABLE_NOW: 'bg-lime text-ink'
};

const DEFAULT_CATEGORIES = [
  'Adventure', 'Action', 'Indie', 'Sci-Fi', 'Survival', 'Mystery',
  'Racing', 'Arcade', 'Roguelike', 'Deckbuilder', 'Strategy', 'Puzzle', 'RPG'
];

const DEFAULT_PLATFORMS = [
  'PC (Steam)', 'Epic Games Store', 'PlayStation 5', 'Xbox Series X|S', 'Nintendo Switch', 'iOS / iPadOS', 'Android'
];

export interface StoreLinkItem {
  name: string;
  url: string;
  badge?: string;
}

interface GameFormData {
  title: string;
  subtitle: string;
  genre: string;
  categories: string[];
  status: string;
  price: string;
  releaseYear: string;
  platforms: string[];
  storeLinks: StoreLinkItem[];
  description: string;
  longDescription: string;
  heroImage: string;
  secondaryImage: string;
  screenshots: string;
  trailerUrl: string;
  tags: string;
  features: string;
  devStory: string;
  featured: boolean;
  published: boolean;
}

const emptyForm: GameFormData = {
  title: '',
  subtitle: '',
  genre: '',
  categories: ['Indie', 'Adventure'],
  status: 'WISHLIST_NOW',
  price: 'Wishlist free',
  releaseYear: '2026',
  platforms: ['PC (Steam)'],
  storeLinks: [
    { name: 'Steam', url: '', badge: 'Wishlist on Steam' }
  ],
  description: '',
  longDescription: '',
  heroImage: '/images/art_aetherbound.jpg',
  secondaryImage: '/images/art_week_wide.jpg',
  screenshots: '/images/art_aetherbound.jpg\n/images/art_week_wide.jpg',
  trailerUrl: '',
  tags: 'Indie, Single Player, Adventure',
  features: 'Exploration with fluid movement\nHandcrafted art and atmosphere\nRich story and world lore',
  devStory: '',
  featured: false,
  published: true
};

export const GamesPage: React.FC = () => {
  const [games, setGames] = useState<AdminGame[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState<GameFilters['sortBy']>('createdAt');
  const [sortOrder, setSortOrder] = useState<GameFilters['sortOrder']>('desc');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [formData, setFormData] = useState<GameFormData>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const fetchGames = async () => {
    setIsLoading(true);
    try {
      const res = await gamesApi.list({
        page: pagination.page,
        limit: pagination.limit,
        sortBy,
        sortOrder,
        status: statusFilter || undefined,
        search: search || undefined,
      });
      setGames(res.items);
      setPagination({
        page: res.pagination.page,
        limit: res.pagination.limit,
        total: res.pagination.total,
        totalPages: res.pagination.pages,
      });
    } catch (error) {
      notify('Failed to load games', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchGames(); }, [pagination.page, sortBy, sortOrder, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination(p => ({ ...p, page: 1 }));
    fetchGames();
  };

  const handleOpenCreate = () => {
    setEditingGameId(null);
    setFormData(emptyForm);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (game: AdminGame) => {
    setEditingGameId(game.id);
    setFormData({
      title: game.title || '',
      subtitle: game.subtitle || '',
      genre: game.genre || '',
      categories: game.categories || [],
      status: game.status || 'WISHLIST_NOW',
      price: game.price || 'Wishlist free',
      releaseYear: game.releaseYear || '2026',
      platforms: game.platforms || ['PC (Steam)'],
      storeLinks: game.storeLinks && game.storeLinks.length > 0
        ? game.storeLinks.map(l => ({ name: l.name || '', url: l.url || '', badge: l.badge || '' }))
        : [{ name: 'Steam', url: '', badge: 'Wishlist on Steam' }],
      description: game.description || '',
      longDescription: game.longDescription || '',
      heroImage: game.heroImage || '',
      secondaryImage: game.secondaryImage || '',
      screenshots: (game.screenshots || []).join('\n'),
      trailerUrl: game.trailerUrl || '',
      tags: (game.tags || []).join(', '),
      features: (game.features || []).join('\n'),
      devStory: game.devStory || '',
      featured: !!game.featured,
      published: !!game.published
    });
    setIsModalOpen(true);
  };

  const handleAddStoreLink = (name = 'Steam', defaultBadge = 'Wishlist on Steam') => {
    setFormData(prev => ({
      ...prev,
      storeLinks: [...prev.storeLinks, { name, url: '', badge: defaultBadge }]
    }));
  };

  const handleUpdateStoreLink = (index: number, field: keyof StoreLinkItem, value: string) => {
    setFormData(prev => {
      const updated = [...prev.storeLinks];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, storeLinks: updated };
    });
  };

  const handleRemoveStoreLink = (index: number) => {
    setFormData(prev => ({
      ...prev,
      storeLinks: prev.storeLinks.filter((_, i) => i !== index)
    }));
  };

  const handleSaveGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      notify('Game title is required', 'error');
      return;
    }
    if (!formData.genre.trim()) {
      notify('Game genre is required', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title: formData.title.trim(),
        subtitle: formData.subtitle.trim() || undefined,
        genre: formData.genre.trim(),
        categories: formData.categories.length > 0 ? formData.categories : ['Indie'],
        status: formData.status,
        price: formData.price.trim() || 'Wishlist free',
        releaseYear: formData.releaseYear.trim() || 'TBA',
        platforms: formData.platforms.length > 0 ? formData.platforms : ['PC (Steam)'],
        storeLinks: formData.storeLinks
          .filter(l => l.name.trim() && l.url.trim())
          .map(l => ({
            name: l.name.trim(),
            url: l.url.trim(),
            badge: l.badge?.trim() || undefined
          })),
        description: formData.description.trim(),
        longDescription: formData.longDescription.trim() || formData.description.trim(),
        heroImage: formData.heroImage.trim() || undefined,
        secondaryImage: formData.secondaryImage.trim() || undefined,
        screenshots: formData.screenshots.split('\n').map(s => s.trim()).filter(Boolean),
        trailerUrl: formData.trailerUrl.trim() || undefined,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
        features: formData.features.split('\n').map(f => f.trim()).filter(Boolean),
        devStory: formData.devStory.trim(),
        featured: formData.featured,
        published: formData.published
      };

      if (editingGameId) {
        await gamesApi.update(editingGameId, payload);
        notify('Game updated successfully!', 'success');
      } else {
        await gamesApi.create(payload);
        notify('New game created successfully!', 'success');
      }

      setIsModalOpen(false);
      fetchGames();
    } catch (err: any) {
      notify(err?.message || 'Failed to save game', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (game: AdminGame, published: boolean) => {
    try {
      await gamesApi.publish(game.id, published);
      notify(published ? 'Game published' : 'Game unpublished', 'success');
      fetchGames();
    } catch {
      notify('Failed to update game', 'error');
    }
  };

  const handleFeaturedChange = async (game: AdminGame, featured: boolean) => {
    try {
      await gamesApi.feature(game.id, featured);
      notify(featured ? 'Game featured' : 'Game unfeatured', 'success');
      fetchGames();
    } catch {
      notify('Failed to update featured status', 'error');
    }
  };

  const handleDelete = async (game: AdminGame) => {
    const confirmText = window.prompt(`To delete "${game.title}" permanently, type its title or slug (${game.slug}) to confirm:`);
    if (confirmText === null) return;
    if (confirmText.trim() !== game.slug && confirmText.trim().toLowerCase() !== game.title.trim().toLowerCase()) {
      notify('Confirmation did not match — nothing was deleted.', 'error');
      return;
    }
    setDeletingId(game.id);
    try {
      await gamesApi.remove(game.id, game.slug);
      notify('Game deleted', 'success');
      fetchGames();
    } catch {
      notify('Failed to delete game', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await gamesApi.duplicate(id);
      notify('Game duplicated', 'success');
      fetchGames();
    } catch {
      notify('Failed to duplicate game', 'error');
    }
  };

  const toggleCategory = (cat: string) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter(c => c !== cat)
        : [...prev.categories, cat]
    }));
  };

  const togglePlatform = (plat: string) => {
    setFormData(prev => ({
      ...prev,
      platforms: prev.platforms.includes(plat)
        ? prev.platforms.filter(p => p !== plat)
        : [...prev.platforms, plat]
    }));
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight text-ink">Games Catalog</h1>
          <p className="mt-1 text-sm font-medium text-inksoft">
            Add and manage all games in your studio catalog. Add titles, mechanics, screenshots, and prices.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-coral px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-white shadow-sticker hover:-translate-y-0.5 hover:bg-coraldeep transition-all cursor-pointer"
        >
          <Plus size={16} /> Add Game
        </button>
      </div>

      <div className="rounded-2xl border-2 border-ink/10 bg-cream shadow-soft">
        <div className="border-b-2 border-ink/10 p-4">
          <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-inksoft" />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search games by title, genre, tag..."
                className="w-full rounded-xl border-2 border-ink/15 bg-cream px-4 py-2.5 pl-11 text-sm font-semibold text-ink placeholder-inksoft/60 focus:border-grape focus:outline-none"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); fetchGames(); }}
              className="rounded-xl border-2 border-ink/15 bg-cream px-4 py-2.5 text-sm font-semibold text-ink focus:border-grape focus:outline-none"
            >
              {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full" role="grid">
            <thead>
              <tr className="border-b-2 border-ink/10 bg-sand/50 text-left text-[10px] font-extrabold uppercase tracking-wider text-inksoft">
                <th className="px-4 py-3">Game</th>
                <th className="px-4 py-3 hidden md:table-cell">Price</th>
                <th className="px-4 py-3 hidden lg:table-cell">Status</th>
                <th className="px-4 py-3 hidden xl:table-cell">Release</th>
                <th className="px-4 py-3">Featured</th>
                <th className="px-4 py-3">Published</th>
                <th className="px-4 py-3 w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {isLoading && games.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-grape" /></td></tr>
              ) : games.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <Sparkles className="h-10 w-10 text-grape mx-auto" />
                      <p className="font-display text-lg font-extrabold uppercase text-ink">Your Catalog is Ready</p>
                      <p className="text-xs font-medium text-inksoft">
                        No games are currently loaded. Click "Add Game" above to put your own games with screenshots, trailers, platforms, and pricing.
                      </p>
                      <button
                        onClick={handleOpenCreate}
                        className="mt-2 inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-sun px-4 py-2 text-xs font-extrabold uppercase text-ink shadow-sticker-sm hover:-translate-y-0.5 cursor-pointer"
                      >
                        <Plus size={14} /> Add Your First Game
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                games.map(game => (
                  <tr key={game.id} className="hover:bg-sand/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {game.heroImage ? (
                          <img src={game.heroImage} alt="" className="h-10 w-14 rounded-lg border-2 border-ink/10 object-cover" />
                        ) : (
                          <div className="h-10 w-14 rounded-lg border-2 border-ink/10 bg-sand flex items-center justify-center text-[10px] font-bold text-inksoft">
                            No Img
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-ink">{game.title}</p>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-inksoft">{game.genre}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell font-mono text-sm font-bold text-ink">{game.price}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className={`inline-flex items-center gap-1 rounded-full border-2 border-ink px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider ${STATUS_BADGES[game.status] || 'bg-sand text-ink'}`}>
                        {game.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell text-sm font-medium text-inksoft">{game.releaseYear}</td>
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={game.featured}
                          onChange={e => handleFeaturedChange(game, e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className={`relative h-5 w-10 rounded-full border-2 border-ink transition-colors peer-checked:bg-grape peer-checked:border-grape ${game.featured ? 'bg-grape' : 'bg-cream'}`}>
                          <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full border-2 border-ink bg-white transition-transform ${game.featured ? 'translate-x-5' : ''}`} />
                        </div>
                      </label>
                    </td>
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={game.published}
                          onChange={e => handleStatusChange(game, e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className={`relative h-5 w-10 rounded-full border-2 border-ink transition-colors peer-checked:bg-lime peer-checked:border-lime ${game.published ? 'bg-lime' : 'bg-cream'}`}>
                          <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full border-2 border-ink bg-white transition-transform ${game.published ? 'translate-x-5' : ''}`} />
                        </div>
                      </label>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(game)}
                          className="grid h-9 w-9 place-items-center rounded-lg border-2 border-ink/15 bg-cream text-ink hover:bg-sun transition-colors cursor-pointer"
                          title="Edit Game"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDuplicate(game.id)}
                          className="grid h-9 w-9 place-items-center rounded-lg border-2 border-ink/15 bg-cream text-ink hover:bg-sun transition-colors cursor-pointer"
                          title="Duplicate"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(game)}
                          disabled={deletingId === game.id}
                          className="grid h-9 w-9 place-items-center rounded-lg border-2 border-ink/15 bg-cream text-coral hover:bg-coral hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
                          title="Delete"
                        >
                          {deletingId === game.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t-2 border-ink/10 px-4 py-3">
            <p className="text-sm font-medium text-inksoft">Page {pagination.page} of {pagination.totalPages} · {pagination.total} games</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))} disabled={pagination.page === 1} className="rounded-lg border-2 border-ink/15 bg-cream px-3 py-1.5 text-sm font-bold disabled:opacity-50">Prev</button>
              <button onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))} disabled={pagination.page === pagination.totalPages} className="rounded-lg border-2 border-ink/15 bg-cream px-3 py-1.5 text-sm font-bold disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Game Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/70 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-3xl my-8 bg-paper rounded-3xl border-2 border-ink shadow-lift overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b-2 border-ink/10 bg-cream">
                <div>
                  <h2 className="font-display text-xl font-extrabold uppercase text-ink">
                    {editingGameId ? 'Edit Game Dossier' : 'Add New Game'}
                  </h2>
                  <p className="text-xs font-medium text-inksoft">
                    {editingGameId ? 'Update game catalog details, media, and release data' : 'Create a brand new title for your studio website'}
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-xl border-2 border-ink/15 bg-paper text-ink hover:bg-coral hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSaveGame} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-ink mb-1">
                      Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g. AETHERBOUND"
                      className="w-full rounded-xl border-2 border-ink/15 bg-cream px-3 py-2 text-sm font-bold text-ink focus:border-grape focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-ink mb-1">
                      Subtitle / Tagline
                    </label>
                    <input
                      type="text"
                      value={formData.subtitle}
                      onChange={e => setFormData({ ...formData, subtitle: e.target.value })}
                      placeholder="e.g. Echoes of Zero"
                      className="w-full rounded-xl border-2 border-ink/15 bg-cream px-3 py-2 text-sm font-bold text-ink focus:border-grape focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-ink mb-1">
                      Genre *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.genre}
                      onChange={e => setFormData({ ...formData, genre: e.target.value })}
                      placeholder="e.g. Sky-Island Adventure"
                      className="w-full rounded-xl border-2 border-ink/15 bg-cream px-3 py-2 text-sm font-bold text-ink focus:border-grape focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-ink mb-1">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value })}
                      className="w-full rounded-xl border-2 border-ink/15 bg-cream px-3 py-2 text-sm font-bold text-ink focus:border-grape focus:outline-none"
                    >
                      <option value="IN_DEVELOPMENT">In Development</option>
                      <option value="EARLY_ACCESS">Early Access</option>
                      <option value="WISHLIST_NOW">Wishlist Now</option>
                      <option value="AVAILABLE_NOW">Available Now</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-ink mb-1">
                      Price / Store Status
                    </label>
                    <input
                      type="text"
                      value={formData.price}
                      onChange={e => setFormData({ ...formData, price: e.target.value })}
                      placeholder="e.g. $24.99 or Wishlist free"
                      className="w-full rounded-xl border-2 border-ink/15 bg-cream px-3 py-2 text-sm font-bold text-ink focus:border-grape focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-ink mb-1">
                      Release Year / Window
                    </label>
                    <input
                      type="text"
                      value={formData.releaseYear}
                      onChange={e => setFormData({ ...formData, releaseYear: e.target.value })}
                      placeholder="e.g. 2026, Q4 2026, or TBA"
                      className="w-full rounded-xl border-2 border-ink/15 bg-cream px-3 py-2 text-sm font-bold text-ink focus:border-grape focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-ink mb-1">
                      Trailer URL (YouTube / Video)
                    </label>
                    <input
                      type="url"
                      value={formData.trailerUrl}
                      onChange={e => setFormData({ ...formData, trailerUrl: e.target.value })}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full rounded-xl border-2 border-ink/15 bg-cream px-3 py-2 text-sm font-bold text-ink focus:border-grape focus:outline-none"
                    />
                  </div>
                </div>

                {/* Categories */}
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-ink mb-1">
                    Categories & Tags
                  </label>
                  <div className="flex flex-wrap gap-1.5 p-3 rounded-xl border-2 border-ink/15 bg-cream">
                    {DEFAULT_CATEGORIES.map(cat => {
                      const selected = formData.categories.includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => toggleCategory(cat)}
                          className={`px-3 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                            selected
                              ? 'bg-grape text-white border-ink shadow-sticker-sm'
                              : 'bg-paper text-inksoft border-ink/10 hover:border-ink'
                          }`}
                        >
                          {selected && '✓ '}{cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Platforms */}
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-ink mb-1">
                    Platforms
                  </label>
                  <div className="flex flex-wrap gap-1.5 p-3 rounded-xl border-2 border-ink/15 bg-cream">
                    {DEFAULT_PLATFORMS.map(plat => {
                      const selected = formData.platforms.includes(plat);
                      return (
                        <button
                          key={plat}
                          type="button"
                          onClick={() => togglePlatform(plat)}
                          className={`px-3 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                            selected
                              ? 'bg-coral text-white border-ink shadow-sticker-sm'
                              : 'bg-paper text-inksoft border-ink/10 hover:border-ink'
                          }`}
                        >
                          {selected && '✓ '}{plat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Marketplace & Store Links (Where Game is Released) */}
                <div className="rounded-2xl border-2 border-ink/15 bg-paper/60 p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <ShoppingBag size={16} className="text-grape" />
                        <label className="text-xs font-extrabold uppercase tracking-wider text-ink">
                          Marketplace & Store Links (Where Game is Released)
                        </label>
                      </div>
                      <p className="text-[11px] font-medium text-inksoft mt-0.5">
                        Add marketplace links where players can buy, wishlist, or download your game (just like the Trailer URL).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddStoreLink('Steam', 'Wishlist on Steam')}
                      className="inline-flex items-center gap-1.5 rounded-xl border-2 border-ink bg-sun px-3 py-1.5 text-xs font-extrabold text-ink shadow-sticker-sm hover:bg-cream transition-colors cursor-pointer self-start sm:self-auto"
                    >
                      <Plus size={14} /> Add Marketplace Link
                    </button>
                  </div>

                  {/* Quick Add Presets */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-extrabold uppercase text-inksoft mr-1">Quick Add:</span>
                    {[
                      { name: 'Steam', badge: 'Wishlist on Steam' },
                      { name: 'Epic Games Store', badge: 'Get on Epic' },
                      { name: 'PlayStation Store', badge: 'PlayStation Store' },
                      { name: 'Xbox Store', badge: 'Xbox Store' },
                      { name: 'Nintendo eShop', badge: 'Nintendo Switch' },
                      { name: 'Apple App Store', badge: 'Download on App Store' },
                      { name: 'Google Play Store', badge: 'Get on Google Play' },
                      { name: 'itch.io', badge: 'Buy on itch.io' },
                      { name: 'GOG.com', badge: 'Buy on GOG' },
                    ].map(preset => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => handleAddStoreLink(preset.name, preset.badge)}
                        className="rounded-lg border border-ink/20 bg-cream px-2.5 py-1 text-[11px] font-bold text-ink hover:bg-grape hover:text-white transition-colors cursor-pointer"
                      >
                        + {preset.name}
                      </button>
                    ))}
                  </div>

                  {/* Links List */}
                  {formData.storeLinks.length === 0 ? (
                    <div className="rounded-xl border-2 border-dashed border-ink/20 bg-cream/50 p-4 text-center">
                      <p className="text-xs font-medium text-inksoft">
                        No marketplace links added yet. Click one of the quick presets above to add a marketplace link where this game is released.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {formData.storeLinks.map((link, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-xl border-2 border-ink/10 bg-cream p-2.5 shadow-sm"
                        >
                          <div className="w-full sm:w-44 shrink-0">
                            <label className="block text-[9px] font-extrabold uppercase text-inksoft mb-0.5">
                              Marketplace Name
                            </label>
                            <input
                              type="text"
                              value={link.name}
                              onChange={e => handleUpdateStoreLink(idx, 'name', e.target.value)}
                              placeholder="e.g. Steam, Epic Games"
                              list="marketplace-options"
                              className="w-full rounded-lg border-2 border-ink/15 bg-paper px-2.5 py-1.5 text-xs font-bold text-ink focus:border-grape focus:outline-none"
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <label className="block text-[9px] font-extrabold uppercase text-inksoft mb-0.5">
                              Marketplace URL (Direct Link) *
                            </label>
                            <div className="relative">
                              <input
                                type="url"
                                value={link.url}
                                onChange={e => handleUpdateStoreLink(idx, 'url', e.target.value)}
                                placeholder="https://store.steampowered.com/app/..."
                                className="w-full rounded-lg border-2 border-ink/15 bg-paper px-2.5 py-1.5 text-xs font-medium text-ink focus:border-grape focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="w-full sm:w-36 shrink-0">
                            <label className="block text-[9px] font-extrabold uppercase text-inksoft mb-0.5">
                              Button Label / Badge
                            </label>
                            <input
                              type="text"
                              value={link.badge || ''}
                              onChange={e => handleUpdateStoreLink(idx, 'badge', e.target.value)}
                              placeholder="e.g. Wishlist"
                              className="w-full rounded-lg border-2 border-ink/15 bg-paper px-2.5 py-1.5 text-xs font-medium text-ink focus:border-grape focus:outline-none"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveStoreLink(idx)}
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 border-transparent text-coral hover:border-coral/20 hover:bg-coral/10 transition-colors cursor-pointer self-end sm:self-center mt-1 sm:mt-3"
                            title="Remove marketplace link"
                            aria-label="Remove link"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <datalist id="marketplace-options">
                    <option value="Steam" />
                    <option value="Epic Games Store" />
                    <option value="PlayStation Store" />
                    <option value="Xbox Store" />
                    <option value="Nintendo eShop" />
                    <option value="Apple App Store" />
                    <option value="Google Play Store" />
                    <option value="GOG.com" />
                    <option value="itch.io" />
                  </datalist>
                </div>

                {/* Descriptions */}
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-ink mb-1">
                    Short Description *
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Short punchy summary displayed on cards..."
                    className="w-full rounded-xl border-2 border-ink/15 bg-cream p-3 text-sm font-medium text-ink focus:border-grape focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-ink mb-1">
                    Detailed Story & Overview
                  </label>
                  <textarea
                    rows={4}
                    value={formData.longDescription}
                    onChange={e => setFormData({ ...formData, longDescription: e.target.value })}
                    placeholder="In-depth dossier for game modal, story background, and setting..."
                    className="w-full rounded-xl border-2 border-ink/15 bg-cream p-3 text-sm font-medium text-ink focus:border-grape focus:outline-none"
                  />
                </div>

                {/* Media Artwork */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-ink mb-1">
                      Hero Image URL
                    </label>
                    <input
                      type="text"
                      value={formData.heroImage}
                      onChange={e => setFormData({ ...formData, heroImage: e.target.value })}
                      placeholder="/images/art_aetherbound.jpg or https://..."
                      className="w-full rounded-xl border-2 border-ink/15 bg-cream px-3 py-2 text-sm font-mono text-ink focus:border-grape focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-ink mb-1">
                      Secondary Banner Image URL
                    </label>
                    <input
                      type="text"
                      value={formData.secondaryImage}
                      onChange={e => setFormData({ ...formData, secondaryImage: e.target.value })}
                      placeholder="/images/art_week_wide.jpg or https://..."
                      className="w-full rounded-xl border-2 border-ink/15 bg-cream px-3 py-2 text-sm font-mono text-ink focus:border-grape focus:outline-none"
                    />
                  </div>
                </div>

                {/* Key Features & Mechanics */}
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-ink mb-1">
                    Key Features (one per line)
                  </label>
                  <textarea
                    rows={3}
                    value={formData.features}
                    onChange={e => setFormData({ ...formData, features: e.target.value })}
                    placeholder="Fluid momentum physics&#10;Zero loading screens&#10;Procedural sky biomes"
                    className="w-full rounded-xl border-2 border-ink/15 bg-cream p-3 text-sm font-medium text-ink focus:border-grape focus:outline-none"
                  />
                </div>

                {/* Dev Story */}
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-ink mb-1">
                    Behind-the-Scenes Dev Story
                  </label>
                  <textarea
                    rows={2}
                    value={formData.devStory}
                    onChange={e => setFormData({ ...formData, devStory: e.target.value })}
                    placeholder="How this game was born during game jam or incubation..."
                    className="w-full rounded-xl border-2 border-ink/15 bg-cream p-3 text-sm font-medium text-ink focus:border-grape focus:outline-none"
                  />
                </div>

                {/* Switches */}
                <div className="flex flex-wrap items-center gap-6 p-4 rounded-2xl border-2 border-ink/10 bg-cream">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.featured}
                      onChange={e => setFormData({ ...formData, featured: e.target.checked })}
                      className="h-4 w-4 rounded border-2 border-ink text-grape focus:ring-0"
                    />
                    <span className="text-xs font-extrabold uppercase text-ink">Feature on Homepage Banner</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.published}
                      onChange={e => setFormData({ ...formData, published: e.target.checked })}
                      className="h-4 w-4 rounded border-2 border-ink text-lime focus:ring-0"
                    />
                    <span className="text-xs font-extrabold uppercase text-ink">Publish to Public Shelf</span>
                  </label>
                </div>

                {/* Submit Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-ink/10">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl border-2 border-ink/15 bg-cream text-xs font-bold text-ink hover:bg-sand cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border-2 border-ink bg-coral text-xs font-extrabold uppercase tracking-wide text-white shadow-sticker hover:-translate-y-0.5 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    {editingGameId ? 'Save Game Changes' : 'Create Game'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
