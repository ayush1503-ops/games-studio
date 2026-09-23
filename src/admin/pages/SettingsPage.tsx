import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Shield, Download, AlertOctagon, Activity, Server, Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { contentApi, backupApi, activityApi, authApi, downloadJson, ApiError } from '../utils/api';
import type { ActivityEntry, SystemSnapshot } from '../types';
import { useAuth } from '../context/AuthContext';
import { notify } from '../utils/toast';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

interface SettingsForm {
  siteName: string;
  tagline: string;
  contactEmail: string;
  registrationOpen: boolean;
}

export const SettingsPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isPrimaryAdmin = isSuperAdmin;

  const [settings, setSettings] = useState<SettingsForm>({
    siteName: 'Brainchild Games',
    tagline: 'Play. Discover. Repeat.',
    contactEmail: 'hello@brainchild.games',
    registrationOpen: false,
  });

  const [snapshot, setSnapshot] = useState<SystemSnapshot | null>(null);
  const [logs, setLogs] = useState<ActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Password change state — available to ALL admins, not just SUPER_ADMIN
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Full stored values for each block we edit — saves merge the form fields
  // into these so untouched fields (e.g. contact FAQ, logoUrl) are preserved.
  const [brandValue, setBrandValue] = useState<Record<string, unknown>>({});
  const [contactValue, setContactValue] = useState<Record<string, unknown>>({});
  const [registrationValue, setRegistrationValue] = useState<Record<string, unknown>>({});

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      // Always load activity for password change history, even for non-super-admins
      const activity = await activityApi.list({ limit: 10 });
      setLogs(activity.items);

      if (!isSuperAdmin) {
        setIsLoading(false);
        return;
      }

      const [blocks, system] = await Promise.all([
        contentApi.blocks(),
        backupApi.system(),
      ]);

      const setting = (key: string): Record<string, unknown> | null => {
        const value = blocks.settings.find((entry) => entry.key === key)?.value;
        return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
      };
      const block = (key: string): Record<string, unknown> | null => {
        const value = blocks.blocks.find((entry) => entry.key === key)?.value;
        return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
      };

      const brand = setting('site.brand') ?? {};
      const contact = block('contact.details') ?? {};
      const registration = setting('players.registration') ?? {};

      setBrandValue(brand);
      setContactValue(contact);
      setRegistrationValue(registration);
      setSettings({
        siteName: (brand.name as string) ?? 'Brainchild Games',
        tagline: (brand.tagline as string) ?? 'Play. Discover. Repeat.',
        contactEmail: (contact.email as string) ?? 'hello@brainchild.games',
        registrationOpen: (registration.registrationOpen as boolean) ?? false,
      });
      setSnapshot(system);
    } catch (err) {
      notify(errorMessage(err, 'Failed to load settings'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await Promise.all([
        contentApi.updateSetting('site.brand', {
          ...brandValue,
          name: settings.siteName,
          shortName: settings.siteName.split(' ')[0] || 'Brainchild',
          tagline: settings.tagline,
        }),
        contentApi.updateBlock('contact.details', {
          ...contactValue,
          email: settings.contactEmail,
        }),
        contentApi.updateSetting('players.registration', {
          ...registrationValue,
          registrationOpen: settings.registrationOpen,
        }),
      ]);
      notify('Studio settings updated successfully', 'success');
      loadSettings();
    } catch (err) {
      notify(errorMessage(err, 'Failed to update settings'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordForm.currentPassword) {
      notify('Enter your current password', 'error');
      return;
    }
    if (passwordForm.newPassword.length < 12) {
      notify('New password must be at least 12 characters', 'error');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      notify('New passwords do not match', 'error');
      return;
    }
    if (passwordForm.currentPassword === passwordForm.newPassword) {
      notify('New password must be different from current', 'error');
      return;
    }

    setIsChangingPassword(true);
    try {
      await authApi.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      notify('Password changed successfully! Other devices have been signed out.', 'success');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      notify(errorMessage(err, 'Failed to change password'), 'error');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDownloadBackup = async () => {
    setIsExporting(true);
    try {
      const bundle = await backupApi.exportBundle();
      downloadJson(bundle, `brainchild_database_backup_${Date.now()}.json`);
      notify('Database backup downloaded', 'success');
    } catch (err) {
      notify(errorMessage(err, 'Failed to download backup'), 'error');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-grape border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold uppercase tracking-tight text-ink flex items-center gap-2">
          <Settings className="text-grape" /> Studio & Security Settings
        </h1>
        <p className="text-sm font-medium text-inksoft">
          Configure site metadata, security parameters, database backups, and view administrative audit logs
        </p>
      </div>

      {/* Password Change */}
      <div className="rounded-2xl border-2 border-ink bg-cream p-6 shadow-sticker-sm space-y-5">
        <h2 className="font-display text-lg font-bold uppercase tracking-tight text-ink border-b-2 border-ink/10 pb-3 flex items-center gap-2">
          <Lock className="text-grape" size={18} /> Change Your Password
        </h2>

        <div className="rounded-xl border-2 border-grape/20 bg-grape/5 p-4 text-xs">
          <p className="font-bold text-ink">Signed in as: <span className="text-grape">{currentUser?.name || 'Studio Admin'}</span> ({currentUser?.role})</p>
          {isPrimaryAdmin && (
            <p className="mt-1 font-medium text-inksoft">
              Your password is managed by Supabase Auth and is never displayed or stored by the editor. Use the password recovery link if you no longer remember it.
            </p>
          )}
          {!isPrimaryAdmin && (
            <p className="mt-1 font-medium text-inksoft">
              Use this form to update your password. Minimum 12 characters, must include a letter and a number. Other devices will be signed out after change.
            </p>
          )}
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase text-inksoft">Current Password *</label>
            <div className="relative">
              <input
                type={showPasswords.current ? 'text' : 'password'}
                value={passwordForm.currentPassword}
                onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                className="w-full rounded-xl border-2 border-ink/15 bg-paper px-3 py-2.5 pr-10 text-sm font-semibold text-ink"
                placeholder="••••••••••••"
                required
              />
              <button type="button" onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })} className="absolute right-3 top-1/2 -translate-y-1/2 text-inksoft hover:text-ink">
                {showPasswords.current ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase text-inksoft">New Password * (min 12 chars)</label>
            <div className="relative">
              <input
                type={showPasswords.new ? 'text' : 'password'}
                value={passwordForm.newPassword}
                onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                className="w-full rounded-xl border-2 border-ink/15 bg-paper px-3 py-2.5 pr-10 text-sm font-semibold text-ink"
                placeholder="New strong password"
                required
              />
              <button type="button" onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })} className="absolute right-3 top-1/2 -translate-y-1/2 text-inksoft hover:text-ink">
                {showPasswords.new ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase text-inksoft">Confirm New Password *</label>
            <div className="relative">
              <input
                type={showPasswords.confirm ? 'text' : 'password'}
                value={passwordForm.confirmPassword}
                onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                className="w-full rounded-xl border-2 border-ink/15 bg-paper px-3 py-2.5 pr-10 text-sm font-semibold text-ink"
                placeholder="Confirm new password"
                required
              />
              <button type="button" onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })} className="absolute right-3 top-1/2 -translate-y-1/2 text-inksoft hover:text-ink">
                {showPasswords.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isChangingPassword}
            className="flex items-center gap-2 rounded-xl border-2 border-ink bg-coral px-6 py-2.5 text-xs font-extrabold uppercase text-white shadow-sticker hover:bg-coraldeep disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle2 size={16} />
            {isChangingPassword ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>

      {!isSuperAdmin ? (
        <div className="p-8 max-w-2xl mx-auto my-12 text-center rounded-[28px] border-2 border-coral bg-coral/10 shadow-lift space-y-4">
          <div className="grid h-16 w-16 place-items-center rounded-2xl border-2 border-coral bg-cream mx-auto text-coral">
            <AlertOctagon size={32} />
          </div>
          <h2 className="font-display text-2xl font-extrabold uppercase text-ink">Access Restricted</h2>
          <p className="text-sm font-semibold text-inksoft leading-relaxed">
            System Security Settings and Data Backup tools are restricted to <strong className="text-coral">Super Admin</strong> accounts only. Your current role is <strong className="text-grape uppercase">{currentUser?.role}</strong>. You can still change your own password above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Settings Form */}
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSaveSettings} className="rounded-2xl border-2 border-ink bg-cream p-6 shadow-sticker-sm space-y-5">
              <h2 className="font-display text-lg font-bold uppercase tracking-tight text-ink border-b-2 border-ink/10 pb-3 flex items-center gap-2">
                <Shield className="text-grape" size={18} /> General & Security Preferences
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-inksoft">Site Name</label>
                  <input
                    type="text"
                    value={settings.siteName}
                    onChange={e => setSettings({ ...settings, siteName: e.target.value })}
                    className="w-full rounded-xl border-2 border-ink/15 bg-paper px-3 py-2 text-xs font-semibold text-ink"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-inksoft">Tagline</label>
                  <input
                    type="text"
                    value={settings.tagline}
                    onChange={e => setSettings({ ...settings, tagline: e.target.value })}
                    className="w-full rounded-xl border-2 border-ink/15 bg-paper px-3 py-2 text-xs font-semibold text-ink"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-inksoft">Contact Email</label>
                <input
                  type="email"
                  value={settings.contactEmail}
                  onChange={e => setSettings({ ...settings, contactEmail: e.target.value })}
                  className="w-full rounded-xl border-2 border-ink/15 bg-paper px-3 py-2 text-xs font-semibold text-ink"
                />
              </div>

              <div className="space-y-3 pt-2 border-t-2 border-ink/10">
                <div className="flex items-center justify-between p-3 rounded-xl border border-ink/10 bg-paper">
                  <div>
                    <p className="text-xs font-bold text-ink">Player Self Registration</p>
                    <p className="text-[10px] text-inksoft">Allow visitors to create player accounts from the website</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.registrationOpen}
                    onChange={e => setSettings({ ...settings, registrationOpen: e.target.checked })}
                    className="h-5 w-5 rounded border-2 border-ink"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl border-2 border-ink bg-coral px-6 py-2.5 text-xs font-extrabold uppercase text-white shadow-sticker hover:bg-coraldeep cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>

            {/* Database Backup Section */}
            <div className="rounded-2xl border-2 border-ink bg-cream p-6 shadow-sticker-sm space-y-4">
              <h2 className="font-display text-lg font-bold uppercase tracking-tight text-ink border-b-2 border-ink/10 pb-3 flex items-center gap-2">
                <Download className="text-grape" size={18} /> Database Backup & Recovery
              </h2>
              <p className="text-xs font-semibold text-inksoft leading-relaxed">
                Export a complete structured JSON snapshot of all published games, articles, categories, subscribers, website content, and admin accounts for disaster recovery and offline backup.
              </p>

              <button
                onClick={handleDownloadBackup}
                disabled={isExporting}
                className="flex items-center gap-2 rounded-xl border-2 border-ink bg-grape px-5 py-3 text-xs font-extrabold uppercase tracking-wider text-white shadow-sticker hover:bg-grapedeep cursor-pointer disabled:opacity-50"
              >
                <Download size={16} />
                {isExporting ? 'Preparing Backup...' : 'Download Full Database Backup (JSON)'}
              </button>
            </div>
          </div>

          {/* System Overview & Audit Logs */}
          <div className="space-y-6">
            <div className="rounded-2xl border-2 border-ink bg-cream p-5 shadow-sticker-sm space-y-4">
              <h3 className="font-display text-base font-bold uppercase text-ink flex items-center gap-2 border-b-2 border-ink/10 pb-2">
                <Server size={16} className="text-coral" /> Security Overview
              </h3>

              <div className="space-y-2 text-xs font-semibold">
                <div className="flex justify-between py-1 border-b border-ink/10">
                  <span className="text-inksoft">Database Protocol:</span>
                  <span className="font-bold text-ink">PostgreSQL (Drizzle ORM)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-ink/10">
                  <span className="text-inksoft">Session Auth:</span>
                  <span className="font-bold text-moss">HttpOnly Cookies (JWT)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-ink/10">
                  <span className="text-inksoft">Password Encryption:</span>
                  <span className="font-bold text-moss">Bcrypt (12 rounds)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-ink/10">
                  <span className="text-inksoft">SQLi / XSS Defenses:</span>
                  <span className="font-bold text-moss">ACTIVE</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-inksoft">Rate Limiters:</span>
                  <span className="font-bold text-moss">ACTIVE (Auth & API)</span>
                </div>
                <div className="flex justify-between py-1 border-t border-ink/10 mt-2 pt-2">
                  <span className="text-inksoft">Primary Admin Role:</span>
                  <span className="font-bold text-grape">SUPER_ADMIN (Protected)</span>
                </div>
              </div>
            </div>

            {/* Audit Activity Logs */}
            <div className="rounded-2xl border-2 border-ink bg-cream p-5 shadow-sticker-sm space-y-3">
              <h3 className="font-display text-base font-bold uppercase text-ink flex items-center gap-2 border-b-2 border-ink/10 pb-2">
                <Activity size={16} className="text-grape" /> Recent Audit Activity
              </h3>

              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {logs.length === 0 ? (
                  <p className="text-xs text-inksoft text-center py-4">No recent activity recorded.</p>
                ) : (
                  logs.map(log => (
                    <div key={log.id} className="p-2.5 rounded-xl bg-paper border border-ink/10 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-[10px] uppercase text-grape">{log.action}</span>
                        <span className="text-[9px] text-inksoft">{new Date(log.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-[11px] font-medium text-ink">
                        {log.actorEmail || log.admin?.name || log.admin?.email || 'Admin'} · <span className="text-inksoft">{log.entityType ?? 'system'}</span>
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
