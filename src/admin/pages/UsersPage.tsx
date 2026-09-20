import React, { useState, useEffect } from 'react';
import { Users, Shield, Plus, Lock, CheckCircle2, XCircle, Trash2, Edit3, AlertOctagon } from 'lucide-react';
import { teamApi, ApiError } from '../utils/api';
import type { TeamMember } from '../types';
import { useAuth } from '../context/AuthContext';
import { notify } from '../utils/toast';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

type AdminUserItem = TeamMember;

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'EDITOR' as 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR'
  });

  const [editForm, setEditForm] = useState({
    name: '',
    role: 'EDITOR' as 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR',
    isActive: true
  });

  const loadUsers = async () => {
    if (!isSuperAdmin) return;
    setIsLoading(true);
    try {
      const res = await teamApi.list();
      setUsers(res);
    } catch (err) {
      notify(errorMessage(err, 'Failed to load admin users'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [isSuperAdmin]);

  // The API mints a one-time password for newly created admins; surface it once.
  const [issuedCredential, setIssuedCredential] = useState<{ email: string; password: string } | null>(null);

  // Handle Create Admin
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.email) {
      notify('Email is required', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const result = await teamApi.create({
        email: createForm.email,
        name: createForm.name || createForm.email.split('@')[0],
        role: createForm.role,
      });
      notify('Admin user created successfully', 'success');
      if (result.oneTimePassword) {
        setIssuedCredential({ email: createForm.email, password: result.oneTimePassword });
      }
      setIsCreateOpen(false);
      setCreateForm({ name: '', email: '', password: '', role: 'EDITOR' });
      loadUsers();
    } catch (err) {
      notify(errorMessage(err, 'Failed to create user'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Edit Admin
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSaving(true);
    try {
      await teamApi.update(editingUser.id, editForm);
      notify('User updated successfully', 'success');
      setEditingUser(null);
      loadUsers();
    } catch (err) {
      notify(errorMessage(err, 'Failed to update user'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete Admin
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await teamApi.remove(deleteTarget.id, deleteTarget.email);
      notify('User deleted', 'success');
      setDeleteTarget(null);
      loadUsers();
    } catch (err) {
      notify(errorMessage(err, 'Failed to delete user'), 'error');
    }
  };

  // Role Access Guard for Content Admins / Editors
  if (!isSuperAdmin) {
    return (
      <div className="p-8 max-w-2xl mx-auto my-12 text-center rounded-[28px] border-2 border-coral bg-coral/10 shadow-lift space-y-4">
        <div className="grid h-16 w-16 place-items-center rounded-2xl border-2 border-coral bg-cream mx-auto text-coral">
          <AlertOctagon size={32} />
        </div>
        <h2 className="font-display text-2xl font-extrabold uppercase text-ink">Access Restricted</h2>
        <p className="text-sm font-semibold text-inksoft leading-relaxed">
          Admin User Management and security role assignments are restricted to <strong className="text-coral">Super Admin</strong> accounts only. Your current role is <strong className="text-grape uppercase">{currentUser?.role}</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold uppercase tracking-tight text-ink flex items-center gap-2">
            <Users className="text-grape" /> Admin User Management
          </h1>
          <p className="text-sm font-medium text-inksoft">
            Manage studio administrators, access permissions, and system roles
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 rounded-xl border-2 border-ink bg-coral px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider text-white shadow-sticker hover:bg-coraldeep cursor-pointer"
        >
          <Plus size={16} /> Create New Admin
        </button>
      </div>

      {/* One-time password for a freshly created admin */}
      {issuedCredential && (
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-moss bg-moss/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs font-semibold text-ink">
            <p className="font-extrabold uppercase tracking-wider text-moss">One-time password issued for {issuedCredential.email}</p>
            <p className="mt-1 text-inksoft">Share it securely — the admin must change it after first sign-in.</p>
          </div>
          <div className="flex items-center gap-2">
            <code className="rounded-lg border-2 border-moss/30 bg-paper px-3 py-2 font-mono text-sm font-bold text-ink">
              {issuedCredential.password}
            </code>
            <button
              onClick={() => setIssuedCredential(null)}
              className="rounded-lg border-2 border-ink/15 bg-cream px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider text-ink hover:bg-sand"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="rounded-2xl border-2 border-ink bg-cream overflow-hidden shadow-sticker-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-semibold">
            <thead className="border-b-2 border-ink bg-sand/50 text-[10px] uppercase tracking-wider text-inksoft">
              <tr>
                <th className="p-4">Administrator</th>
                <th className="p-4">Role</th>
                <th className="p-4">Status</th>
                <th className="p-4">Last Login</th>
                <th className="p-4">Created Date</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y border-ink/10">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-inksoft">Loading administrators...</td>
                </tr>
              ) : users.map(user => (
                <tr key={user.id} className="hover:bg-sand/30 transition-colors">
                  <td className="p-4">
                    <div>
                      <p className="font-bold text-ink">{user.name || 'Unnamed Admin'}</p>
                      <p className="text-[10px] text-inksoft">{user.email}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                      user.role === 'SUPER_ADMIN' ? 'bg-coral/10 text-coral border-coral/30' :
                      user.role === 'ADMIN' ? 'bg-grape/10 text-grape border-grape/30' :
                      'bg-paper text-ink border-ink/20'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="p-4">
                    {user.isActive ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-moss uppercase">
                        <CheckCircle2 size={12} /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-coral uppercase">
                        <XCircle size={12} /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-inksoft">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="p-4 text-inksoft">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditingUser(user);
                          setEditForm({ name: user.name || '', role: user.role, isActive: user.isActive });
                        }}
                        className="p-1.5 rounded-lg border border-ink/15 bg-paper hover:bg-grape hover:text-white transition-colors cursor-pointer"
                        title="Edit Role & Status"
                      >
                        <Edit3 size={14} />
                      </button>

                      {user.id !== currentUser?.id && (
                        <button
                          onClick={() => setDeleteTarget(user)}
                          className="p-1.5 rounded-lg border border-coral/30 bg-coral/10 text-coral hover:bg-coral hover:text-white transition-colors cursor-pointer"
                          title="Delete Admin"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-[24px] border-2 border-ink bg-cream p-6 shadow-lift">
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-ink mb-4">
              Create Admin User
            </h2>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-inksoft">Name</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="Elena Vance"
                  className="w-full rounded-xl border-2 border-ink/15 bg-paper px-3 py-2 text-xs font-semibold text-ink"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-inksoft">Email *</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="elena@brainchild.games"
                  className="w-full rounded-xl border-2 border-ink/15 bg-paper px-3 py-2 text-xs font-semibold text-ink"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-inksoft">Starting Password</label>
                <div className="rounded-xl border-2 border-dashed border-ink/20 bg-sand/40 px-3 py-2 text-[11px] font-medium text-inksoft">
                  The studio generates a one-time password and shares it with you right after creation — the new admin is asked to change it on first sign-in.
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-inksoft">Role</label>
                <select
                  value={createForm.role}
                  onChange={e => setCreateForm({ ...createForm, role: e.target.value as any })}
                  className="w-full rounded-xl border-2 border-ink/15 bg-paper px-3 py-2 text-xs font-semibold text-ink"
                >
                  <option value="EDITOR">Content Admin (Editor)</option>
                  <option value="ADMIN">Studio Admin</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t-2 border-ink/10">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-xl border-2 border-ink/20 px-4 py-2 text-xs font-bold uppercase text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl border-2 border-ink bg-coral px-5 py-2 text-xs font-extrabold uppercase text-white shadow-sticker"
                >
                  {isSaving ? 'Creating...' : 'Create Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-[24px] border-2 border-ink bg-cream p-6 shadow-lift">
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-ink mb-4">
              Edit Admin User
            </h2>

            <form onSubmit={handleEdit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-inksoft">Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full rounded-xl border-2 border-ink/15 bg-paper px-3 py-2 text-xs font-semibold text-ink"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-inksoft">Role</label>
                <select
                  value={editForm.role}
                  onChange={e => setEditForm({ ...editForm, role: e.target.value as any })}
                  className="w-full rounded-xl border-2 border-ink/15 bg-paper px-3 py-2 text-xs font-semibold text-ink"
                >
                  <option value="EDITOR">Content Admin (Editor)</option>
                  <option value="ADMIN">Studio Admin</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={editForm.isActive}
                  onChange={e => setEditForm({ ...editForm, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-2 border-ink"
                />
                <label htmlFor="isActive" className="text-xs font-bold text-ink cursor-pointer">
                  Account is Active
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t-2 border-ink/10">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="rounded-xl border-2 border-ink/20 px-4 py-2 text-xs font-bold uppercase text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl border-2 border-ink bg-coral px-5 py-2 text-xs font-extrabold uppercase text-white shadow-sticker"
                >
                  {isSaving ? 'Saving...' : 'Update Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Administrator"
        message={`Are you sure you want to remove administrator "${deleteTarget?.email}"? They will immediately lose access to the studio CMS.`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
};
