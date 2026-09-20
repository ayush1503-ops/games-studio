import React, { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Article, Game, Job, ContactMessage, NewsletterSubscriber, PageRoute } from '../types';
import { INITIAL_GAMES, INITIAL_NEWS, INITIAL_JOBS } from '../data/initialData';
import { toggleAmbientSound, playUiClick } from '../utils/sound';
import { fetchSite, sendContactMessage, subscribeToNewsletter, SitePayload } from '../api/site';

/**
 * Studio context — the public website's window into the CMS.
 *
 * Content now comes from `GET /api/public/site`: whatever the studio publishes
 * in the admin console appears here on the next load, with no code changes.
 * Bundled sample data is only used until (or if) that request cannot be made,
 * so the site never renders an empty shell on a cold API.
 */
interface StudioContextType {
  currentRoute: PageRoute;
  setCurrentRoute: (route: PageRoute) => void;
  selectedGame: Game | null;
  setSelectedGame: (game: Game | null) => void;
  selectedArticle: Article | null;
  setSelectedArticle: (article: Article | null) => void;
  selectedJob: Job | null;
  setSelectedJob: (job: Job | null) => void;
  isApplyingJob: boolean;
  setIsApplyingJob: (applying: boolean) => void;
  isCmsOpen: boolean;
  setIsCmsOpen: (open: boolean) => void;
  isAudioActive: boolean;
  toggleAudio: () => void;

  // Wishlist & playful toasts
  wishlist: string[];
  toggleWishlist: (gameId: string) => void;
  isWishlisted: (gameId: string) => boolean;
  toast: { id: number; text: string } | null;
  notify: (text: string) => void;

  // Live content
  games: Game[];
  news: Article[];
  jobs: Job[];
  content: Record<string, any>;
  settings: Record<string, any>;
  /** Reads an editable content block with a safe fallback. */
  block: <T = any>(key: string, fallback: T) => T;
  /** Reads an editable site setting with a safe fallback. */
  setting: <T = any>(key: string, fallback: T) => T;
  isLoadingContent: boolean;

  // Forms
  subscribers: NewsletterSubscriber[];
  subscribeNewsletter: (name: string, email: string, interests: string[]) => Promise<{ success: boolean; message: string }>;
  exportSubscribersCSV: () => void;
  exportSubscribersJSON: () => void;
  contactMessages: ContactMessage[];
  submitContact: (data: Omit<ContactMessage, 'id' | 'createdAt' | 'status'>) => Promise<{ success: boolean; message: string }>;
  markContactStatus: (id: string, status: ContactMessage['status']) => void;
}

const StudioContext = createContext<StudioContextType | undefined>(undefined);

const FALLBACK_CONTENT: Record<string, any> = {
  'contact.details': {
    email: 'hello@brainchild.games',
    phone: '+1 (514) 555-0199',
    address: '4210 Saint-Laurent, Montreal',
    responseTime: 'Replies within 48h, Mon–Thu',
    discord: 'Discord · 18,000 players',
  },
  'footer.studio': {
    copyright: '© 2019–2026 Brainchild Games Inc.',
    location: 'Montreal, QC',
  },
  'careers.intro': { email: 'jobs@brainchild.games' },
  'site.audience': { discordMembers: 18000, newsletterReaders: 12400 },
};

export const StudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();

  const [currentRoute, setCurrentRouteState] = useState<PageRoute>('home');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isApplyingJob, setIsApplyingJob] = useState(false);
  const [isCmsOpen, setIsCmsOpen] = useState(false);
  const [isAudioActive, setIsAudioActive] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(true);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  // Content starts from bundled samples and is replaced by the live CMS payload.
  const [games, setGames] = useState<Game[]>(INITIAL_GAMES);
  const [news, setNews] = useState<Article[]>(INITIAL_NEWS);
  const [jobs, setJobs] = useState<Job[]>(INITIAL_JOBS);
  const [content, setContent] = useState<Record<string, any>>(FALLBACK_CONTENT);
  const [settings, setSettings] = useState<Record<string, any>>({});

  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('bc_wishlist');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem('bc_wishlist', JSON.stringify(wishlist));
    } catch {
      /* storage unavailable — wishlist stays in memory */
    }
  }, [wishlist]);

  const notify = useCallback((text: string) => {
    const id = Date.now();
    setToast({ id, text });
    window.setTimeout(() => {
      setToast((prev) => (prev && prev.id === id ? null : prev));
    }, 3200);
  }, []);

  /** Loads published content from the API. */
  const loadSite = useCallback(async () => {
    try {
      const payload: SitePayload = await fetchSite();
      if (Array.isArray(payload.games) && payload.games.length) setGames(payload.games);
      if (Array.isArray(payload.news) && payload.news.length) setNews(payload.news);
      if (Array.isArray(payload.jobs)) setJobs(payload.jobs);
      if (payload.content) setContent((prev) => ({ ...prev, ...payload.content }));
      if (payload.settings) setSettings(payload.settings);
    } catch {
      // Offline or API unavailable: the bundled content keeps the site usable.
    } finally {
      setIsLoadingContent(false);
    }
  }, []);

  useEffect(() => {
    void loadSite();
  }, [loadSite]);

  const block = useCallback(
    <T,>(key: string, fallback: T): T => {
      const value = content?.[key];
      if (value === undefined || value === null) return fallback;
      if (typeof value === 'object' && !Array.isArray(value) && typeof fallback === 'object' && fallback !== null) {
        return { ...(fallback as object), ...(value as object) } as T;
      }
      return value as T;
    },
    [content]
  );

  const setting = useCallback(
    <T,>(key: string, fallback: T): T => {
      const value = settings?.[key];
      if (value === undefined || value === null) return fallback;
      if (typeof value === 'object' && !Array.isArray(value) && typeof fallback === 'object' && fallback !== null) {
        return { ...(fallback as object), ...(value as object) } as T;
      }
      return value as T;
    },
    [settings]
  );

  const isWishlisted = (gameId: string) => wishlist.includes(gameId);

  const toggleWishlist = (gameId: string) => {
    const has = wishlist.includes(gameId);
    const game = games.find((g) => g.id === gameId);
    setWishlist(has ? wishlist.filter((id) => id !== gameId) : [...wishlist, gameId]);
    notify(has ? `${game?.title ?? 'Game'} removed from your wishlist` : `${game?.title ?? 'Game'} added to your wishlist ♥`);
  };

  const setCurrentRoute = (route: PageRoute) => {
    playUiClick(500);
    setCurrentRouteState(route);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleAudio = () => {
    const nextState = !isAudioActive;
    toggleAmbientSound(nextState);
    setIsAudioActive(nextState);
  };

  /** The old in-page CMS is gone: its buttons now open the real admin console. */
  const openConsole = useCallback(() => {
    setIsCmsOpen(true);
    navigate('/admin');
  }, [navigate]);

  const subscribeNewsletter = async (
    name: string,
    email: string,
    interests: string[]
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const data = await subscribeToNewsletter({ name: name || undefined, email, interests });
      const subscriber: NewsletterSubscriber = {
        id: `local-${Date.now()}`,
        email,
        name,
        interests,
        subscribedAt: new Date().toISOString().slice(0, 10),
      };
      setSubscribers((prev) => [subscriber, ...prev.filter((entry) => entry.email !== email)]);
      return { success: true, message: data.message };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Could not reach the studio. Please try again.',
      };
    }
  };

  const submitContact = async (
    data: Omit<ContactMessage, 'id' | 'createdAt' | 'status'>
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await sendContactMessage({
        name: data.name,
        email: data.email,
        company: data.company,
        subject: data.subject,
        projectType: data.projectType,
        budget: data.budget,
        message: data.message,
      });
      setContactMessages((prev) => [
        { ...data, id: `local-${Date.now()}`, createdAt: new Date().toISOString().slice(0, 10), status: 'unread' },
        ...prev,
      ]);
      return { success: true, message: response.message };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Message could not be sent. Please try again shortly.',
      };
    }
  };

  /** Subscriber exports live in the admin console; these keep older callers working. */
  const exportSubscribersCSV = () => notify('Subscriber exports live in Studio → Audience.');
  const exportSubscribersJSON = () => notify('Subscriber exports live in Studio → Audience.');
  const markContactStatus = (id: string, status: ContactMessage['status']) =>
    setContactMessages((prev) => prev.map((message) => (message.id === id ? { ...message, status } : message)));

  const value = useMemo<StudioContextType>(
    () => ({
      currentRoute,
      setCurrentRoute,
      selectedGame,
      setSelectedGame,
      selectedArticle,
      setSelectedArticle,
      selectedJob,
      setSelectedJob,
      isApplyingJob,
      setIsApplyingJob,
      isCmsOpen,
      setIsCmsOpen: (open: boolean) => (open ? openConsole() : setIsCmsOpen(false)),
      isAudioActive,
      toggleAudio,
      wishlist,
      toggleWishlist,
      isWishlisted,
      toast,
      notify,
      games,
      news,
      jobs,
      content,
      settings,
      block,
      setting,
      isLoadingContent,
      subscribers,
      subscribeNewsletter,
      exportSubscribersCSV,
      exportSubscribersJSON,
      contactMessages,
      submitContact,
      markContactStatus,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentRoute, selectedGame, selectedArticle, selectedJob, isApplyingJob, isCmsOpen, isAudioActive, wishlist, toast, games, news, jobs, content, settings, isLoadingContent, subscribers, contactMessages]
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
};

export const useStudio = () => {
  const context = useContext(StudioContext);
  if (!context) {
    throw new Error('useStudio must be used within a StudioProvider');
  }
  return context;
};
