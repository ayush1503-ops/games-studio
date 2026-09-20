import React from 'react';
import { Menu, Sun, Moon, Bell, Search, User, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Header: React.FC<{
  onMenuClick: () => void;
  isMobileMenuOpen: boolean;
  onMobileMenuClose: () => void;
}> = ({ onMenuClick, isMobileMenuOpen, onMobileMenuClose }) => {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 h-16 bg-paper/80 backdrop-blur-xl border-b-2 border-ink/10">
      <div className="flex h-full items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden grid h-10 w-10 place-items-center rounded-xl border-2 border-ink bg-cream text-ink cursor-pointer"
            aria-label="Toggle menu"
          >
            <Menu size={20} />
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

        <div className="flex items-center gap-2">
          <button className="relative grid h-10 w-10 place-items-center rounded-full border-2 border-ink/15 bg-cream text-ink transition-all hover:border-ink hover:bg-sun cursor-pointer" aria-label="Notifications">
            <Bell size={18} />
            <span className="absolute -top-1 -right-1 grid h-5 w-5 place-items-center rounded-full border-2 border-ink bg-coral text-[10px] font-extrabold text-white">3</span>
          </button>

          <div className="relative">
            <button className="flex items-center gap-2 rounded-full border-2 border-ink/15 bg-grape px-3 py-1.5 text-sm font-semibold text-white transition-all hover:border-ink cursor-pointer" aria-label="User menu">
              <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-full border-2 border-ink bg-cream">
                <img src="/images/mascot_pix.png" alt="" className="h-full w-full object-cover" />
              </div>
              <span className="hidden sm:block">{user?.name || 'Admin'}</span>
              <ChevronDown size={14} className="hidden sm:block" />
            </button>
            <div className="absolute right-0 top-full mt-2 w-48 overflow-hidden rounded-2xl border-2 border-ink bg-cream shadow-lift">
              <div className="border-b-2 border-ink/10 bg-sun/30 px-4 py-3">
                <p className="font-display text-sm font-extrabold uppercase text-ink">{user?.name || 'Admin'}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-grape">{user?.role}</p>
              </div>
              <button onClick={() => logout()} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-coral hover:bg-sand cursor-pointer">
                <LogOut size={15} /> Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="lg:hidden border-t-2 border-ink/10 bg-paper px-4 py-4 shadow-lift">
          <div className="flex flex-wrap gap-2">
            {[
              { path: '/admin', label: 'Dashboard', icon: '📊' },
              { path: '/admin/games', label: 'Games', icon: '🎮' },
              { path: '/admin/news', label: 'News & Blog', icon: '📰' },
              { path: '/admin/users', label: 'Admin Users', icon: '👥' },
              { path: '/admin/subscribers', label: 'Subscribers', icon: '📧' },
              { path: '/admin/jobs', label: 'Careers', icon: '💼' },
              { path: '/admin/content', label: 'Website Content', icon: '⚙️' }
            ].map(item => (
              <a
                key={item.path}
                href={item.path}
                onClick={onMobileMenuClose}
                className="flex items-center gap-2 rounded-xl border-2 border-ink/10 bg-cream px-4 py-2.5 text-sm font-semibold text-ink hover:bg-sun transition-colors cursor-pointer"
              >
                <span>{item.icon}</span> {item.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};