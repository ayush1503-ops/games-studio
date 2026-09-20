import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const AdminLayout: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
          <div className="mb-4 rounded-2xl border-2 border-grape/20 bg-grape/5 px-4 py-3 text-xs font-semibold text-inksoft">
            Authentication and password recovery are managed securely by Supabase Auth.
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
