import React, { useState, useEffect } from 'react';
import {
  Mail, Download, Search, Filter, Trash2, CheckCircle2, XCircle,
  MessageSquare, User, Building, DollarSign, Calendar, Eye, Edit3, X, Check, Loader2
} from 'lucide-react';
import { subscribersApi, contactsApi, ApiError } from '../utils/api';
import type { ContactMessage } from '../types';
import { notify } from '../utils/toast';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

interface SubscriberItem {
  id: string;
  email: string;
  name?: string;
  interests: string[];
  status: 'ACTIVE' | 'UNSUBSCRIBED' | 'BOUNCED';
  subscribedAt: string;
}

export const SubscribersPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'subscribers' | 'inquiries'>('subscribers');

  // Subscribers State
  const [subscribers, setSubscribers] = useState<SubscriberItem[]>([]);
  const [isLoadingSubscribers, setIsLoadingSubscribers] = useState(true);
  const [searchSubscribers, setSearchSubscribers] = useState('');
  const [statusFilterSubscribers, setStatusFilterSubscribers] = useState('ALL');
  const [deleteSubscriberTarget, setDeleteSubscriberTarget] = useState<SubscriberItem | null>(null);

  // Inquiries State
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [searchMessages, setSearchMessages] = useState('');
  const [statusFilterMessages, setStatusFilterMessages] = useState('ALL');
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [deleteMessageTarget, setDeleteMessageTarget] = useState<ContactMessage | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesText, setNotesText] = useState('');

  const loadSubscribers = async () => {
    setIsLoadingSubscribers(true);
    try {
      const res = await subscribersApi.list({
        search: searchSubscribers || undefined,
        status: statusFilterSubscribers !== 'ALL' ? statusFilterSubscribers : undefined
      });
      setSubscribers(res.items);
    } catch (err) {
      notify(errorMessage(err, 'Failed to load subscribers'), 'error');
    } finally {
      setIsLoadingSubscribers(false);
    }
  };

  const loadMessages = async () => {
    setIsLoadingMessages(true);
    try {
      const res = await contactsApi.list({
        search: searchMessages || undefined,
        status: statusFilterMessages !== 'ALL' ? statusFilterMessages : undefined
      });
      setMessages(res.items);
    } catch (err) {
      notify(errorMessage(err, 'Failed to load customer messages'), 'error');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'subscribers') {
      loadSubscribers();
    } else {
      loadMessages();
    }
  }, [activeTab, searchSubscribers, statusFilterSubscribers, searchMessages, statusFilterMessages]);

  const handleDeleteSubscriber = async () => {
    if (!deleteSubscriberTarget) return;
    try {
      await subscribersApi.remove(deleteSubscriberTarget.id);
      notify('Subscriber removed', 'success');
      setDeleteSubscriberTarget(null);
      loadSubscribers();
    } catch (err) {
      notify(errorMessage(err, 'Failed to remove subscriber'), 'error');
    }
  };

  const handleUpdateSubscriberStatus = async (id: string, newStatus: 'ACTIVE' | 'UNSUBSCRIBED' | 'BOUNCED') => {
    try {
      await subscribersApi.update(id, { status: newStatus });
      notify(`Subscriber status updated to ${newStatus}`, 'success');
      loadSubscribers();
    } catch (err) {
      notify(errorMessage(err, 'Failed to update status'), 'error');
    }
  };

  const handleDeleteMessage = async () => {
    if (!deleteMessageTarget) return;
    try {
      await contactsApi.remove(deleteMessageTarget.id);
      notify('Inquiry deleted', 'success');
      setDeleteMessageTarget(null);
      if (selectedMessage?.id === deleteMessageTarget.id) {
        setSelectedMessage(null);
      }
      loadMessages();
    } catch (err) {
      notify(errorMessage(err, 'Failed to remove message'), 'error');
    }
  };

  const handleUpdateMessageStatus = async (id: string, newStatus: string) => {
    try {
      const updated = await contactsApi.update(id, { status: newStatus });
      notify(`Inquiry marked as ${newStatus}`, 'success');
      if (selectedMessage?.id === id) {
        setSelectedMessage(updated);
      }
      loadMessages();
    } catch (err) {
      notify(errorMessage(err, 'Failed to update message status'), 'error');
    }
  };

  const handleSaveNotes = async (id: string) => {
    try {
      const updated = await contactsApi.update(id, { notes: notesText });
      notify('Internal notes saved', 'success');
      setEditingNotesId(null);
      if (selectedMessage?.id === id) {
        setSelectedMessage(updated);
      }
      loadMessages();
    } catch (err) {
      notify(errorMessage(err, 'Failed to save notes'), 'error');
    }
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Email', 'Name', 'Interests', 'Status', 'Subscribed At'];
    const rows = subscribers.map(s => [
      s.id,
      `"${s.email}"`,
      `"${s.name || ''}"`,
      `"${(s.interests || []).join('; ')}"`,
      s.status,
      new Date(s.subscribedAt).toISOString()
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `brainchild_subscribers_${Date.now()}.csv`;
    link.click();
    notify('Subscribers CSV exported', 'success');
  };

  const handleExportJSON = () => {
    const jsonStr = JSON.stringify(subscribers, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `brainchild_subscribers_${Date.now()}.json`;
    link.click();
    notify('Subscribers JSON exported', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight text-ink flex items-center gap-3">
            Customer Data & Inquiries
          </h1>
          <p className="mt-1 text-sm font-medium text-inksoft">
            Review and manage newsletter subscribers, fan interests, and incoming press/partnership inquiries
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex rounded-2xl border-2 border-ink bg-cream p-1 shadow-sticker-sm">
          <button
            onClick={() => setActiveTab('subscribers')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wide transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'subscribers'
                ? 'bg-grape text-white shadow-sticker-sm'
                : 'text-ink hover:text-grape'
            }`}
          >
            <Mail size={14} /> Newsletter Subscribers ({subscribers.length})
          </button>
          <button
            onClick={() => setActiveTab('inquiries')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wide transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'inquiries'
                ? 'bg-coral text-white shadow-sticker-sm'
                : 'text-ink hover:text-coral'
            }`}
          >
            <MessageSquare size={14} /> Contact Inquiries ({messages.length})
          </button>
        </div>
      </div>

      {/* SUBSCRIBERS TAB */}
      {activeTab === 'subscribers' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-inksoft" />
              <input
                type="text"
                value={searchSubscribers}
                onChange={e => setSearchSubscribers(e.target.value)}
                placeholder="Search subscribers by email or name..."
                className="w-full rounded-xl border-2 border-ink/15 bg-paper px-4 py-2 pl-9 text-xs font-semibold text-ink placeholder-inksoft focus:border-grape focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter size={16} className="text-inksoft" />
              <select
                value={statusFilterSubscribers}
                onChange={e => setStatusFilterSubscribers(e.target.value)}
                className="rounded-xl border-2 border-ink/15 bg-paper px-3 py-2 text-xs font-bold text-ink focus:border-grape focus:outline-none"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="UNSUBSCRIBED">Unsubscribed</option>
                <option value="BOUNCED">Bounced</option>
              </select>

              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 rounded-xl border-2 border-ink/15 bg-paper px-3 py-2 text-xs font-bold text-ink hover:bg-sand transition-colors cursor-pointer"
              >
                <Download size={14} /> CSV
              </button>
              <button
                onClick={handleExportJSON}
                className="inline-flex items-center gap-1.5 rounded-xl border-2 border-ink/15 bg-paper px-3 py-2 text-xs font-bold text-ink hover:bg-sand transition-colors cursor-pointer"
              >
                JSON
              </button>
            </div>
          </div>

          <div className="rounded-2xl border-2 border-ink bg-cream overflow-hidden shadow-sticker-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold">
                <thead className="border-b-2 border-ink bg-sand/50 text-[10px] uppercase tracking-wider text-inksoft">
                  <tr>
                    <th className="p-4">Subscriber</th>
                    <th className="p-4">Interests</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Subscribed Date</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-ink/10">
                  {isLoadingSubscribers ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-inksoft">Loading subscribers...</td>
                    </tr>
                  ) : subscribers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-inksoft">No subscribers found.</td>
                    </tr>
                  ) : (
                    subscribers.map(sub => (
                      <tr key={sub.id} className="hover:bg-sand/30 transition-colors">
                        <td className="p-4">
                          <div>
                            <p className="font-bold text-ink">{sub.name || 'Community Member'}</p>
                            <p className="text-[10px] text-inksoft">{sub.email}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1">
                            {(sub.interests || []).map((interest, idx) => (
                              <span key={idx} className="px-2 py-0.5 rounded-md bg-paper text-[10px] font-bold text-inksoft border border-ink/10">
                                {interest}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-4">
                          <select
                            value={sub.status}
                            onChange={e => handleUpdateSubscriberStatus(sub.id, e.target.value as any)}
                            className="text-[10px] font-extrabold uppercase rounded-lg border border-ink/20 bg-paper px-2 py-1 cursor-pointer focus:outline-none"
                          >
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="UNSUBSCRIBED">UNSUBSCRIBED</option>
                            <option value="BOUNCED">BOUNCED</option>
                          </select>
                        </td>
                        <td className="p-4 text-inksoft">
                          {new Date(sub.subscribedAt).toLocaleDateString()}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => setDeleteSubscriberTarget(sub)}
                            className="p-1.5 rounded-lg border border-coral/30 bg-coral/10 text-coral hover:bg-coral hover:text-white transition-colors cursor-pointer"
                            title="Remove Subscriber"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* INQUIRIES TAB */}
      {activeTab === 'inquiries' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-inksoft" />
              <input
                type="text"
                value={searchMessages}
                onChange={e => setSearchMessages(e.target.value)}
                placeholder="Search messages by name, email, subject, or company..."
                className="w-full rounded-xl border-2 border-ink/15 bg-paper px-4 py-2 pl-9 text-xs font-semibold text-ink placeholder-inksoft focus:border-grape focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter size={16} className="text-inksoft" />
              <select
                value={statusFilterMessages}
                onChange={e => setStatusFilterMessages(e.target.value)}
                className="rounded-xl border-2 border-ink/15 bg-paper px-3 py-2 text-xs font-bold text-ink focus:border-grape focus:outline-none"
              >
                <option value="ALL">All Status</option>
                <option value="UNREAD">Unread</option>
                <option value="REVIEWED">Reviewed</option>
                <option value="REPLIED">Replied</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
          </div>

          <div className="rounded-2xl border-2 border-ink bg-cream overflow-hidden shadow-sticker-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold">
                <thead className="border-b-2 border-ink bg-sand/50 text-[10px] uppercase tracking-wider text-inksoft">
                  <tr>
                    <th className="p-4">Sender & Company</th>
                    <th className="p-4">Subject & Project</th>
                    <th className="p-4">Budget</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Date</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-ink/10">
                  {isLoadingMessages ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-inksoft">Loading customer messages...</td>
                    </tr>
                  ) : messages.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-inksoft">No contact messages found.</td>
                    </tr>
                  ) : (
                    messages.map(msg => (
                      <tr key={msg.id} className="hover:bg-sand/30 transition-colors">
                        <td className="p-4">
                          <div>
                            <p className="font-bold text-ink flex items-center gap-1.5">
                              {msg.name}
                              {msg.company && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sand border border-ink/10 font-normal">
                                  {msg.company}
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] text-inksoft">{msg.email}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="max-w-xs">
                            <p className="font-bold text-ink truncate">{msg.subject}</p>
                            <p className="text-[10px] text-coral font-bold uppercase">{msg.projectType}</p>
                          </div>
                        </td>
                        <td className="p-4 font-mono text-[11px] text-ink">
                          {msg.budget || '—'}
                        </td>
                        <td className="p-4">
                          <select
                            value={msg.status}
                            onChange={e => handleUpdateMessageStatus(msg.id, e.target.value)}
                            className={`text-[10px] font-extrabold uppercase rounded-lg border px-2 py-1 cursor-pointer focus:outline-none ${
                              msg.status === 'UNREAD' ? 'bg-coral/20 text-coral border-coral/30' :
                              msg.status === 'REPLIED' ? 'bg-moss/20 text-moss border-moss/30' :
                              msg.status === 'REVIEWED' ? 'bg-sun/30 text-ink border-ink/20' :
                              'bg-paper text-inksoft border-ink/10'
                            }`}
                          >
                            <option value="UNREAD">UNREAD</option>
                            <option value="REVIEWED">REVIEWED</option>
                            <option value="REPLIED">REPLIED</option>
                            <option value="ARCHIVED">ARCHIVED</option>
                          </select>
                        </td>
                        <td className="p-4 text-inksoft whitespace-nowrap">
                          {new Date(msg.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedMessage(msg)}
                              className="p-1.5 rounded-lg border border-ink/15 bg-paper text-ink hover:bg-grape hover:text-white transition-colors cursor-pointer"
                              title="View Full Message"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteMessageTarget(msg)}
                              className="p-1.5 rounded-lg border border-coral/30 bg-coral/10 text-coral hover:bg-coral hover:text-white transition-colors cursor-pointer"
                              title="Delete Message"
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
        </div>
      )}

      {/* Message Inspection Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/70 backdrop-blur-sm">
          <div className="relative w-full max-w-xl bg-paper rounded-3xl border-2 border-ink shadow-lift overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b-2 border-ink/10 bg-cream">
              <div>
                <h3 className="font-display text-lg font-extrabold uppercase text-ink">{selectedMessage.subject}</h3>
                <p className="text-xs text-inksoft">From {selectedMessage.name} ({selectedMessage.email})</p>
              </div>
              <button
                onClick={() => setSelectedMessage(null)}
                className="grid h-8 w-8 place-items-center rounded-xl border-2 border-ink/15 bg-paper text-ink hover:bg-coral hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl border border-ink/10 bg-cream text-xs">
                <div>
                  <span className="font-extrabold uppercase text-[10px] text-inksoft block">Company / Org</span>
                  <span className="font-bold text-ink">{selectedMessage.company || 'Individual'}</span>
                </div>
                <div>
                  <span className="font-extrabold uppercase text-[10px] text-inksoft block">Project Type</span>
                  <span className="font-bold text-coral">{selectedMessage.projectType}</span>
                </div>
                <div>
                  <span className="font-extrabold uppercase text-[10px] text-inksoft block">Budget</span>
                  <span className="font-bold text-ink">{selectedMessage.budget || 'Not specified'}</span>
                </div>
                <div>
                  <span className="font-extrabold uppercase text-[10px] text-inksoft block">Received On</span>
                  <span className="font-bold text-ink">{new Date(selectedMessage.createdAt).toLocaleString()}</span>
                </div>
              </div>

              <div>
                <span className="font-extrabold uppercase text-[10px] text-inksoft block mb-1">Message Content</span>
                <div className="p-4 rounded-2xl border-2 border-ink/10 bg-cream text-sm leading-relaxed text-ink whitespace-pre-wrap">
                  {selectedMessage.message}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-extrabold uppercase text-[10px] text-inksoft">Internal Studio Notes</span>
                  {editingNotesId !== selectedMessage.id && (
                    <button
                      onClick={() => { setEditingNotesId(selectedMessage.id); setNotesText(selectedMessage.notes || ''); }}
                      className="text-[10px] font-bold text-grape hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 size={12} /> Edit Notes
                    </button>
                  )}
                </div>

                {editingNotesId === selectedMessage.id ? (
                  <div className="space-y-2">
                    <textarea
                      rows={3}
                      value={notesText}
                      onChange={e => setNotesText(e.target.value)}
                      placeholder="Add follow-up notes, assigned team member, or conversation logs..."
                      className="w-full p-3 text-xs rounded-xl border-2 border-ink/20 bg-cream focus:border-grape focus:outline-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingNotesId(null)}
                        className="px-3 py-1 rounded-lg border border-ink/20 text-xs font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveNotes(selectedMessage.id)}
                        className="px-3 py-1 rounded-lg border border-ink bg-grape text-white text-xs font-bold"
                      >
                        Save Notes
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="p-3 rounded-xl border border-ink/10 bg-sand/30 text-xs text-inksoft italic">
                    {selectedMessage.notes || 'No internal notes added yet.'}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-ink/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-ink">Status:</span>
                  <select
                    value={selectedMessage.status}
                    onChange={e => handleUpdateMessageStatus(selectedMessage.id, e.target.value)}
                    className="text-xs font-extrabold uppercase rounded-lg border border-ink/20 bg-paper px-2.5 py-1 cursor-pointer"
                  >
                    <option value="UNREAD">UNREAD</option>
                    <option value="REVIEWED">REVIEWED</option>
                    <option value="REPLIED">REPLIED</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>

                <a
                  href={`mailto:${selectedMessage.email}?subject=Re: ${encodeURIComponent(selectedMessage.subject)}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-ink bg-coral text-xs font-extrabold uppercase text-white shadow-sticker-sm hover:-translate-y-0.5 cursor-pointer"
                >
                  <Mail size={14} /> Reply via Email
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modals */}
      <DeleteConfirmModal
        isOpen={!!deleteSubscriberTarget}
        title="Remove Subscriber"
        message={`Are you sure you want to remove "${deleteSubscriberTarget?.email}" from the newsletter list?`}
        onConfirm={handleDeleteSubscriber}
        onClose={() => setDeleteSubscriberTarget(null)}
      />

      <DeleteConfirmModal
        isOpen={!!deleteMessageTarget}
        title="Delete Inquiry Message"
        message={`Are you sure you want to delete inquiry from "${deleteMessageTarget?.name}" (${deleteMessageTarget?.subject})?`}
        onConfirm={handleDeleteMessage}
        onClose={() => setDeleteMessageTarget(null)}
      />
    </div>
  );
};
