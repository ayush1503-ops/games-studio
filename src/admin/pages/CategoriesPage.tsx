import React, { useState, useEffect } from 'react';
import { Tag, Plus, Edit3, Trash2, CheckCircle2 } from 'lucide-react';
import { categoriesApi, ApiError } from '../utils/api';
import type { Category as CategoryItem } from '../types';
import { notify } from '../utils/toast';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export const CategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    color: '#6C4CF1'
  });

  const PRESET_COLORS = ['#6C4CF1', '#FF5A3C', '#FFC53D', '#A8D92C', '#2FB9DD', '#E93D82', '#10B981'];

  const loadCategories = async () => {
    setIsLoading(true);
    try {
      const res = await categoriesApi.list();
      setCategories(res);
    } catch (err) {
      notify(errorMessage(err, 'Failed to load categories'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setFormData({ name: '', color: '#6C4CF1' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (category: CategoryItem) => {
    setEditingCategory(category);
    setFormData({ name: category.name, color: category.color });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    setIsSaving(true);
    try {
      if (editingCategory) {
        await categoriesApi.update(editingCategory.id, formData);
        notify('Category updated', 'success');
      } else {
        await categoriesApi.create(formData);
        notify('Category created', 'success');
      }
      setIsModalOpen(false);
      loadCategories();
    } catch (err) {
      notify(errorMessage(err, 'Failed to save category'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await categoriesApi.remove(deleteTarget.id);
      notify('Category deleted', 'success');
      setDeleteTarget(null);
      loadCategories();
    } catch (err) {
      notify(errorMessage(err, 'Failed to delete category'), 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold uppercase tracking-tight text-ink flex items-center gap-2">
            <Tag className="text-grape" /> Content Categories
          </h1>
          <p className="text-sm font-medium text-inksoft">
            Manage article categories, color badges, and taxonomy
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 rounded-xl border-2 border-ink bg-coral px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider text-white shadow-sticker hover:bg-coraldeep cursor-pointer"
        >
          <Plus size={16} /> Add Category
        </button>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full p-8 text-center text-inksoft">Loading categories...</div>
        ) : (
          categories.map(cat => (
            <div
              key={cat.id}
              className="rounded-2xl border-2 border-ink bg-cream p-5 shadow-sticker-sm flex items-center justify-between hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-8 w-8 rounded-xl border-2 border-ink shadow-sticker-sm flex items-center justify-center text-white font-extrabold text-xs"
                  style={{ backgroundColor: cat.color }}
                >
                  #
                </div>
                <div>
                  <h3 className="font-bold text-ink text-sm">{cat.name}</h3>
                  <p className="text-[10px] font-mono text-inksoft">/{cat.slug}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenEdit(cat)}
                  className="p-1.5 rounded-lg border border-ink/15 bg-paper hover:bg-grape hover:text-white transition-colors cursor-pointer"
                >
                  <Edit3 size={14} />
                </button>
                <button
                  onClick={() => setDeleteTarget(cat)}
                  className="p-1.5 rounded-lg border border-coral/30 bg-coral/10 text-coral hover:bg-coral hover:text-white transition-colors cursor-pointer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-[24px] border-2 border-ink bg-cream p-6 shadow-lift">
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-ink mb-4">
              {editingCategory ? 'Edit Category' : 'Create Category'}
            </h2>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-inksoft">Category Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Devlog"
                  className="w-full rounded-xl border-2 border-ink/15 bg-paper px-3 py-2 text-xs font-semibold text-ink"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase text-inksoft">Color Tag</label>
                <div className="flex items-center gap-2">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`h-7 w-7 rounded-lg border-2 border-ink cursor-pointer ${
                        formData.color === color ? 'scale-110 ring-2 ring-grape' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <input
                    type="color"
                    value={formData.color}
                    onChange={e => setFormData({ ...formData, color: e.target.value })}
                    className="h-7 w-8 rounded border border-ink/20 bg-paper cursor-pointer"
                  />
                </div>
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
                  {isSaving ? 'Saving...' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Category"
        message={`Are you sure you want to delete category "${deleteTarget?.name}"? Articles using this category will require re-assignment.`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
};
