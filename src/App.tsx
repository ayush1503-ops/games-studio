import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StudioProvider, useStudio } from './context/StudioContext';
import { SupabaseAuthProvider, PasswordRecoveryRedirect } from './context/SupabaseAuthContext';

// Public site components
import { Navbar } from './components/navigation/Navbar';
import { HeroSection } from './components/home/HeroSection';
import { GameDiscoverySection } from './components/home/GameDiscoverySection';
import { FeaturedGameSection } from './components/home/FeaturedGameSection';
import { AboutBand } from './components/home/AboutBand';
import { NewsSection } from './components/home/NewsSection';
import { CareersTeaserSection } from './components/home/CareersTeaserSection';
import { ContactBand } from './components/home/ContactBand';
import { NewsletterDropSection } from './components/home/NewsletterDropSection';
import { SignatureFooter } from './components/footer/SignatureFooter';
import { GamesPage as PublicGamesPage } from './components/games/GamesPage';
import { NewsPage as PublicNewsPage } from './components/news/NewsPage';
import { AboutPage as PublicAboutPage } from './components/about/AboutPage';
import { CareersPage as PublicCareersPage } from './components/careers/CareersPage';
import { ContactPage as PublicContactPage } from './components/contact/ContactPage';
import { GameDetailModal } from './components/games/GameDetailModal';
import { ArticleDetailModal } from './components/news/ArticleDetailModal';
import { JobDetailModal } from './components/careers/JobDetailModal';
import { Toast } from './components/ui/Toast';

/**
 * The admin console is its own codebase (auth, API client, tables, modals).
 * Lazy-loading it keeps the public site's initial payload small — visitors
 * only ever download the chunks the public site needs.
 */
const AuthProvider = lazy(() => import('./admin/context/AuthContext').then((m) => ({ default: m.AuthProvider })));
const ProtectedRoute = lazy(() => import('./admin/components/ProtectedRoute').then((m) => ({ default: m.ProtectedRoute })));
const AdminLayout = lazy(() => import('./admin/components/AdminLayout').then((m) => ({ default: m.AdminLayout })));
const LoginPage = lazy(() => import('./admin/pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const ForgotPasswordPage = lazy(() => import('./admin/pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('./admin/pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));
const DashboardPage = lazy(() => import('./admin/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const AdminGamesPage = lazy(() => import('./admin/pages/GamesPage').then((m) => ({ default: m.GamesPage })));
const NewsAdminPage = lazy(() => import('./admin/pages/NewsAdminPage').then((m) => ({ default: m.NewsAdminPage })));
const UsersPage = lazy(() => import('./admin/pages/UsersPage').then((m) => ({ default: m.UsersPage })));
const SubscribersPage = lazy(() => import('./admin/pages/SubscribersPage').then((m) => ({ default: m.SubscribersPage })));
const CategoriesPage = lazy(() => import('./admin/pages/CategoriesPage').then((m) => ({ default: m.CategoriesPage })));
const SettingsPage = lazy(() => import('./admin/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

/** Shown while an admin chunk is streaming in. */
const AdminLoading: React.FC = () => (
  <div className="flex h-64 items-center justify-center">
    <div className="grid h-12 w-12 animate-spin place-items-center rounded-2xl border-2 border-ink bg-cream">
      <span className="font-display text-xs font-extrabold text-ink">BC</span>
    </div>
  </div>
);

const PublicApp: React.FC = () => {
  const { currentRoute, selectedGame, setSelectedGame, selectedArticle, setSelectedArticle, selectedJob, setSelectedJob } =
    useStudio();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentRoute]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-paper font-body text-ink antialiased selection:bg-coral selection:text-white">
      <Navbar />

      <main id="main-content" className="w-full">
        {currentRoute === 'home' && (
          <>
            <HeroSection />
            <GameDiscoverySection />
            <FeaturedGameSection />
            <AboutBand />
            <NewsSection />
            <CareersTeaserSection />
            <ContactBand />
            <NewsletterDropSection />
          </>
        )}

        {currentRoute === 'games' && <PublicGamesPage />}
        {currentRoute === 'news' && <PublicNewsPage mode="news" />}
        {currentRoute === 'blog' && <PublicNewsPage mode="blog" />}
        {currentRoute === 'about' && <PublicAboutPage />}
        {currentRoute === 'careers' && <PublicCareersPage />}
        {currentRoute === 'contact' && <PublicContactPage />}
      </main>

      <SignatureFooter />

      {/* Global overlays */}
      {selectedGame && <GameDetailModal game={selectedGame} onClose={() => setSelectedGame(null)} />}
      {selectedArticle && <ArticleDetailModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />}
      {selectedJob && <JobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} />}
      <Toast />
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <SupabaseAuthProvider>
        {/* A password-reset email link that lands anywhere on the site is carried to the reset screen. */}
        <PasswordRecoveryRedirect />
        <Suspense fallback={<AdminLoading />}>
        <Routes>
          {/* Admin Authentication Routes */}
          <Route
            path="/admin/login"
            element={
              <AuthProvider>
                <LoginPage />
              </AuthProvider>
            }
          />
          <Route
            path="/admin/forgot-password"
            element={
              <AuthProvider>
                <ForgotPasswordPage />
              </AuthProvider>
            }
          />
          <Route
            path="/admin/reset-password"
            element={
              <AuthProvider>
                <ResetPasswordPage />
              </AuthProvider>
            }
          />

          {/* Protected Admin Console Routes */}
          <Route
            path="/admin"
            element={
              <AuthProvider>
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              </AuthProvider>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="games" element={<AdminGamesPage />} />
            <Route path="news" element={<NewsAdminPage />} />
            <Route path="subscribers" element={<SubscribersPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>

          {/* Public Studio Website (Preserves original design 100%) */}
          <Route
            path="/*"
            element={
              <StudioProvider>
                <PublicApp />
              </StudioProvider>
            }
          />
        </Routes>
        </Suspense>
      </SupabaseAuthProvider>
    </BrowserRouter>
  );
}
