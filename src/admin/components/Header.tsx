import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Menu,
  Bell,
  Search,
  LogOut,
  ChevronDown,
  Settings,
  ExternalLink,
  Mail,
  ShieldCheck,
  Gamepad2,
  CheckCheck,
  X,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../../lib/supabase';

export interface AdminNotification {
  id: string;
  title: string;
  description: string;
  time: string;
  unread: boolean;
  type: 'mail' | 'system' | 'game';
  link: string;
}

const INITIAL_NOTIFICATIONS: AdminNotification[] = [
  {
    id: 'sys-auth',
    title: 'Supabase Auth Ready',
    description: 'Cloud authentication is active and securing your studio dashboard.',
    time: 'Active',
    unread: true,
    type: 'system',
    link: '/admin/settings',
  },
  {
    id: 'sys-catalog',
    title: 'Games Catalog Synchronized',
    description: 'Games and media assets are connected to cloud storage.',
    time: '2h ago',
    unread: true,
    type: 'game',
    link: '/admin/games',
  },
  {
    id: 'sys-inquiries',
    title: 'Customer Inquiries Center',
    description: 'Review new contact messages and community newsletter signups.',
    time: 'Today',
    unread: true,
    type: 'mail',
    link: '/admin/subscribers',
  },
];

export const Header: React.FC<{
  onToggleMobileSidebar: () => void;
  isMobileSidebarOpen?: boolean;
}> = ({ onToggleMobileSidebar, isMobileSidebarOpen = false }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>(INITIAL_NOTIFICATIONS);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Attempt to fetch latest unread messages to populate notifications dynamically
  useEffect(() => {
    let isMounted = true;
    const fetchLatestInquiries = async () => {
      try {
        if (!supabase) return;
        const { data, error } = await supabase
          .from('contact_messages')
          .select('id, name, subject, message, created_at, status')
          .order('created_at', { ascending: false })
          .limit(3);

        if (!error && data && data.length > 0 && isMounted) {
          const inquiryItems: AdminNotification[] = data.map((msg: any) => ({
            id: `msg-${msg.id}`,
            title: `Inquiry from ${msg.name || 'Visitor'}`,
            description: msg.subject ? `${msg.subject}: ${msg.message?.slice(0, 45) ?? ''}...` : msg.message?.slice(0, 50) ?? 'New message',
            time: 'Recent',
            unread: msg.status === 'UNREAD',
            type: 'mail',
            link: '/admin/subscribers',
          }));

          setNotifications((prev) => {
            const systemItems = prev.filter((item) => item.type !== 'mail');
            return [...inquiryItems, ...systemItems];
          });
        }
      } catch {
        // Silently fall back to initial notifications
      }
    };

    fetchLatestInquiries();
    return () => {
      isMounted = false;
    };
  }, []);

  // Handle outside clicks and Escape key to close menus
  useEffect(() => {
    if (!isUserMenuOpen && !isNotificationsOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setIsUserMenuOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(target)) {
        setIsNotificationsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsUserMenuOpen(false);
        setIsNotificationsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isUserMenuOpen, isNotificationsOpen]);

  const unreadCount = notifications.filter((n) => n.unread).length;

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const handleNotificationClick = (item: AdminNotification) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, unread: false } : n))
    );
    setIsNotificationsOpen(false);
    navigate(item.link);
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-paper/90 backdrop-blur-xl border-b-2 border-ink/10">
      <div className="flex h-full items-center justify-between px-3 sm:px-6 lg:px-8">
        {/* Left Side: Mobile Menu Button & Search */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleMobileSidebar}
            className="lg:hidden grid h-10 w-10 place-items-center rounded-xl border-2 border-ink bg-cream text-ink shadow-sticker-sm hover:bg-sun transition-colors cursor-pointer"
            aria-label={isMobileSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {isMobileSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="hidden lg:flex items-center gap-2 rounded-full border-2 border-ink/15 bg-cream px-4 py-2">
            <Search size={16} className="text-inksoft" />
            <input
              type="text"
              placeholder="Search games, news, users..."
              className="bg-transparent w-64 text-sm font-semibold text-ink placeholder-inksoft/60 focus:outline-none"
              aria-label="Search"
            />
          </div>
        </div>

        {/* Right Side: Notifications & User Avatar */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Notifications Button & Dropdown */}
          <div className="relative" ref={notificationsRef}>
            <button
              type="button"
              onClick={() => {
                setIsNotificationsOpen((prev) => !prev);
                setIsUserMenuOpen(false);
              }}
              className={`relative grid h-10 w-10 place-items-center rounded-full border-2 transition-all cursor-pointer ${
                isNotificationsOpen
                  ? 'border-ink bg-sun text-ink shadow-sticker-sm'
                  : 'border-ink/15 bg-cream text-ink hover:border-ink hover:bg-sun'
              }`}
              aria-label="Notifications"
              aria-expanded={isNotificationsOpen}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 grid h-5 min-w-[20px] px-1 place-items-center rounded-full border-2 border-ink bg-coral text-[10px] font-extrabold text-white animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Panel */}
            {isNotificationsOpen && (
              <div className="absolute right-0 top-full mt-2.5 w-80 sm:w-96 overflow-hidden rounded-2xl border-2 border-ink bg-cream shadow-lift z-50">
                <div className="flex items-center justify-between border-b-2 border-ink/10 bg-sun/30 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-extrabold uppercase text-ink">
                      Notifications
                    </span>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-coral/20 px-2 py-0.5 text-[10px] font-extrabold text-coral border border-coral/30">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllAsRead}
                      className="text-[11px] font-bold text-grape hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCheck size={13} />
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y-2 divide-ink/5">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs font-semibold text-inksoft">
                      No notifications at this time.
                    </div>
                  ) : (
                    notifications.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNotificationClick(item)}
                        className={`w-full text-left p-3.5 flex items-start gap-3 hover:bg-sand/60 transition-colors cursor-pointer ${
                          item.unread ? 'bg-cream' : 'bg-paper/40 opacity-80'
                        }`}
                      >
                        <div
                          className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl border-2 border-ink/20 ${
                            item.type === 'mail'
                              ? 'bg-sun text-ink'
                              : item.type === 'game'
                              ? 'bg-grape text-white'
                              : 'bg-moss text-white'
                          }`}
                        >
                          {item.type === 'mail' && <Mail size={15} />}
                          {item.type === 'game' && <Gamepad2 size={15} />}
                          {item.type === 'system' && <ShieldCheck size={15} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-xs font-bold text-ink truncate">
                              {item.title}
                            </p>
                            <span className="text-[10px] font-medium text-inksoft shrink-0">
                              {item.time}
                            </span>
                          </div>
                          <p className="text-[11px] text-inksoft line-clamp-2 mt-0.5">
                            {item.description}
                          </p>
                        </div>
                        {item.unread && (
                          <div className="h-2 w-2 rounded-full bg-coral shrink-0 mt-2" />
                        )}
                      </button>
                    ))
                  )}
                </div>

                <div className="border-t-2 border-ink/10 bg-paper/80 p-2.5 text-center">
                  <Link
                    to="/admin/subscribers"
                    onClick={() => setIsNotificationsOpen(false)}
                    className="text-xs font-bold text-grape hover:underline inline-flex items-center gap-1"
                  >
                    View inquiries &amp; customers <ExternalLink size={12} />
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* User Menu Avatar & Dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => {
                setIsUserMenuOpen((prev) => !prev);
                setIsNotificationsOpen(false);
              }}
              className={`flex items-center gap-2 rounded-full border-2 px-2 sm:px-3 py-1 text-sm font-semibold transition-all cursor-pointer ${
                isUserMenuOpen
                  ? 'border-ink bg-grape text-white shadow-sticker-sm'
                  : 'border-ink/15 bg-cream text-ink hover:border-ink hover:bg-sun'
              }`}
              aria-label="User menu"
              aria-expanded={isUserMenuOpen}
            >
              <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-full border-2 border-ink bg-cream shrink-0">
                <img src="/images/mascot_pix.png" alt="Pix" className="h-full w-full object-cover" />
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-extrabold leading-none">{user?.name || 'Studio Admin'}</p>
                <p className={`text-[9px] font-bold uppercase tracking-wider leading-none mt-0.5 ${
                  isUserMenuOpen ? 'text-sun' : 'text-grape'
                }`}>
                  {user?.role || 'SUPER_ADMIN'}
                </p>
              </div>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${
                  isUserMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* User Dropdown Panel */}
            {isUserMenuOpen && (
              <div className="absolute right-0 top-full mt-2.5 w-56 overflow-hidden rounded-2xl border-2 border-ink bg-cream shadow-lift z-50">
                <div className="border-b-2 border-ink/10 bg-sun/30 px-4 py-3">
                  <p className="font-display text-sm font-extrabold uppercase text-ink truncate">
                    {user?.name || 'Studio Admin'}
                  </p>
                  <span className="inline-block mt-0.5 rounded-md border border-grape/30 bg-grape/10 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-grape">
                    {user?.role || 'SUPER_ADMIN'}
                  </span>
                  <p className="text-[11px] font-semibold text-inksoft truncate mt-1">
                    {user?.email || 'admin@brainchild.games'}
                  </p>
                </div>

                <div className="p-1.5 space-y-0.5">
                  <Link
                    to="/admin/settings"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-ink hover:bg-sand transition-colors cursor-pointer"
                  >
                    <Settings size={15} className="text-inksoft" />
                    <span>Settings &amp; Security</span>
                  </Link>

                  <a
                    href="/"
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-ink hover:bg-sand transition-colors cursor-pointer"
                  >
                    <ExternalLink size={15} className="text-inksoft" />
                    <span>View Public Site</span>
                  </a>

                  <div className="my-1 border-t-2 border-ink/5" />

                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      logout();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-coral hover:bg-coral/10 transition-colors cursor-pointer"
                  >
                    <LogOut size={15} />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
