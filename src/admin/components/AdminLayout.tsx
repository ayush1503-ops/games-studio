import React, { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '../context/AuthContext';

export const AdminLayout: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-paper font-body text-ink">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <div className={`transition-all duration-300 ${isSidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'}`}>
        <Header
          onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          isMobileMenuOpen={isMobileMenuOpen}
          onMobileMenuClose={() => setIsMobileMenuOpen(false)}
        />
        <main className="p-4 sm:p-6 lg:p-8" id="main-content">
          {/*
            Shown only while the account is still signed in with the shared
            TEMPORARY password. The API decides this by checking the stored
            hash on every /api/auth/me, so setting a private password in
            Settings makes the banner disappear on the next request.
          */}
          {user?.temporaryPasswordInUse && (
            <div
              role="status"
              className="mb-4 flex flex-col gap-3 rounded-2xl border-2 border-coral bg-coral/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="flex items-start gap-2 text-xs font-semibold text-ink sm:items-center">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-coral sm:mt-0" aria-hidden="true" />
                <span>
                  You are signed in with the <strong>temporary studio password</strong> — anyone who
                  knows it can reach this console. Set your own password to finish setup.
                </span>
              </p>
              <Link
                to="/admin/settings"
                className="shrink-0 rounded-xl border-2 border-ink bg-cream px-3 py-2 text-[11px] font-extrabold uppercase tracking-wider text-ink transition-transform hover:-translate-y-0.5"
              >
                Change password
              </Link>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
};
