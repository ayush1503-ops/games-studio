import React from 'react';
import { Link, useLocation, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Gamepad2,
  Newspaper,
  Users,
  Mail,
  Settings,
  Briefcase,
  BarChart2,
  LogOut,
  ChevronLeft,
  Menu
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/games', label: 'Games', icon: Gamepad2 },
  { path: '/admin/news', label: 'News & Devlog', icon: Newspaper },
  { path: '/admin/subscribers', label: 'Customers & Inquiries', icon: Mail },
  { path: '/admin/categories', label: 'Categories', icon: BarChart2 },
  { path: '/admin/users', label: 'Admin Users', icon: Users },
  { path: '/admin/settings', label: 'Settings & Security', icon: Settings }
] as const;

export const Sidebar: React.FC<{ isCollapsed?: boolean; onToggle?: () => void }> = ({
  isCollapsed = false,
  onToggle
}) => {
  const location = useLocation();
  const { user, logout } = useAuth();

  return (
    <aside
      className={`fixed left-0 top-0 h-full z-40 transition-all duration-300 bg-paper border-r-2 border-ink/10 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
      aria-label="Admin navigation"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between h-16 px-4 border-b-2 border-ink/10">
          {!isCollapsed && (
            <Link to="/admin" className="flex items-center gap-2" aria-label="Brainchild Admin">
              <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-xl border-2 border-ink bg-cream shadow-sticker-sm">
                <img src="/images/mascot_pix.png" alt="" className="h-full w-full object-cover" />
              </div>
              <span className="font-display text-lg font-extrabold uppercase tracking-tight text-ink">Admin</span>
            </Link>
          )}
          {isCollapsed && (
            <Link to="/admin" className="grid h-8 w-8 place-items-center rounded-xl border-2 border-ink bg-cream shadow-sticker-sm mx-auto" aria-label="Brainchild Admin">
              <img src="/images/mascot_pix.png" alt="" className="h-6 w-6 object-cover" />
            </Link>
          )}
          {!isCollapsed && onToggle && (
            <button onClick={onToggle} className="grid h-8 w-8 place-items-center rounded-lg border-2 border-ink/15 bg-cream text-ink transition-all hover:border-ink hover:bg-sun cursor-pointer" aria-label="Collapse sidebar">
              <ChevronLeft size={16} className="transition-transform duration-200" />
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Main navigation">
          {NAV_ITEMS.map(item => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive: active }) => `
                  flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 cursor-pointer ${
                    active
                      ? 'bg-grape text-white shadow-sticker-sm'
                      : 'text-inksoft hover:bg-sand hover:text-ink'
                  } ${isCollapsed ? 'justify-center' : ''}
                `}
                title={isCollapsed ? item.label : undefined}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={18} className="shrink-0" aria-hidden="true" />
                {!isCollapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t-2 border-ink/10">
          {!isCollapsed ? (
            <div className="space-y-2">
              <div className="px-3 py-2 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-xl border-2 border-ink bg-cream">
                    <img src="/images/mascot_pix.png" alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink truncate">{user?.name || 'Admin'}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-grape">{user?.role}</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => logout()}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-coral hover:bg-sand transition-colors cursor-pointer"
              >
                <LogOut size={18} />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => logout()}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-coral hover:bg-sand transition-colors cursor-pointer"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};