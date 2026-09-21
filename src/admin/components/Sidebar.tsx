import React from 'react';
import { Link, useLocation, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Gamepad2,
  Newspaper,
  Users,
  Mail,
  Settings,
  BarChart2,
  LogOut,
  ChevronLeft,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/games', label: 'Games', icon: Gamepad2 },
  { path: '/admin/news', label: 'News & Devlog', icon: Newspaper },
  { path: '/admin/subscribers', label: 'Customers & Inquiries', icon: Mail },
  { path: '/admin/categories', label: 'Categories', icon: BarChart2 },
  { path: '/admin/users', label: 'Admin Users', icon: Users },
  { path: '/admin/settings', label: 'Settings & Security', icon: Settings },
] as const;

export interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed = false,
  onToggle,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const location = useLocation();
  const { user, logout } = useAuth();

  return (
    <>
      {/* Mobile Dark Backdrop Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/50 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed left-0 top-0 h-full z-50 bg-paper border-r-2 border-ink/10 flex flex-col transition-transform duration-300 ease-in-out lg:transition-all ${
          isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'lg:w-16' : 'lg:w-64'} w-72 max-w-[85vw] lg:max-w-none`}
        aria-label="Admin navigation"
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between h-16 px-4 border-b-2 border-ink/10 shrink-0">
            {/* Logo & Title */}
            <Link
              to="/admin"
              onClick={onCloseMobile}
              className="flex items-center gap-2.5"
              aria-label="Brainchild Admin"
            >
              <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-xl border-2 border-ink bg-cream shadow-sticker-sm shrink-0">
                <img src="/images/mascot_pix.png" alt="Pix Mascot" className="h-full w-full object-cover" />
              </div>
              {(!isCollapsed || isMobileOpen) && (
                <div className="flex flex-col">
                  <span className="font-display text-base font-extrabold uppercase tracking-tight text-ink leading-tight">
                    Brainchild
                  </span>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-grape leading-none">
                    Studio Admin
                  </span>
                </div>
              )}
            </Link>

            {/* Desktop Collapse Toggle */}
            {!isCollapsed && onToggle && (
              <button
                type="button"
                onClick={onToggle}
                className="hidden lg:grid h-8 w-8 place-items-center rounded-lg border-2 border-ink/15 bg-cream text-ink transition-all hover:border-ink hover:bg-sun cursor-pointer"
                aria-label="Collapse sidebar"
              >
                <ChevronLeft size={16} className="transition-transform duration-200" />
              </button>
            )}

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={onCloseMobile}
              className="lg:hidden grid h-8 w-8 place-items-center rounded-lg border-2 border-ink/20 bg-cream text-ink hover:bg-coral/10 hover:text-coral transition-colors cursor-pointer"
              aria-label="Close sidebar navigation"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.path === '/admin'
                  ? location.pathname === '/admin' || location.pathname === '/admin/'
                  : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onCloseMobile}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-grape text-white shadow-sticker-sm border-2 border-ink'
                      : 'text-inksoft hover:bg-sand hover:text-ink border-2 border-transparent'
                  } ${isCollapsed && !isMobileOpen ? 'lg:justify-center' : ''}`}
                  title={isCollapsed && !isMobileOpen ? item.label : undefined}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={18} className="shrink-0" aria-hidden="true" />
                  {(!isCollapsed || isMobileOpen) && <span>{item.label}</span>}
                </NavLink>
              );
            })}
          </nav>

          {/* User Profile & Logout in Footer */}
          <div className="p-3 border-t-2 border-ink/10 shrink-0 bg-paper/60">
            {!isCollapsed || isMobileOpen ? (
              <div className="space-y-2">
                <div className="px-2 py-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-xl border-2 border-ink bg-cream shrink-0">
                      <img src="/images/mascot_pix.png" alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink text-xs truncate">
                        {user?.name || 'Studio Admin'}
                      </p>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-grape truncate">
                        {user?.role || 'SUPER_ADMIN'}
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onCloseMobile?.();
                    logout();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-coral hover:bg-coral/10 transition-colors cursor-pointer border-2 border-transparent hover:border-coral/20"
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => logout()}
                className="flex w-full items-center justify-center rounded-xl p-2 text-coral hover:bg-sand transition-colors cursor-pointer"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
