import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Gamepad2,
  Newspaper,
  Users,
  Mail,
  TrendingUp,
  BarChart2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal
} from 'lucide-react';
import { motion } from 'motion/react';
import { dashboardApi } from '../utils/api';
import type { ActivityEntry, DashboardStats as DashboardStatsResponse } from '../types';
import { notify } from '../utils/toast';

const STAT_CARDS = [
  { key: 'totalGames', label: 'Total Games', icon: Gamepad2, color: 'bg-grape', trend: 'in the catalogue' },
  { key: 'publishedGames', label: 'Published', icon: Gamepad2, color: 'bg-lime', trend: 'live on the site' },
  { key: 'draftGames', label: 'Drafts', icon: Gamepad2, color: 'bg-sun', trend: 'in progress' },
  { key: 'totalNews', label: 'News Posts', icon: Newspaper, color: 'bg-coral', trend: 'in the newsroom' },
  { key: 'players', label: 'Players', icon: Users, color: 'bg-sky', trend: 'registered accounts' },
  { key: 'subscribers', label: 'Subscribers', icon: Mail, color: 'bg-grape', trend: 'on the newsletter' }
] as const;

interface DashboardStats {
  totalGames: number;
  publishedGames: number;
  draftGames: number;
  totalNews: number;
  players: number;
  subscribers: number;
}

interface RecentGame {
  id: string;
  title: string;
  slug: string;
  status: string;
  published: boolean;
  updatedAt: string;
  heroImage?: string | null;
}

interface RecentPost {
  id: string;
  title: string;
  slug: string;
  status: string;
  updatedAt: string;
  publishedAt?: string | null;
  coverImage: string;
  category?: { name?: string } | null;
}

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [recentNews, setRecentNews] = useState<RecentPost[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // One round-trip: the dashboard endpoint bundles stats + recent lists.
        const data: DashboardStatsResponse = await dashboardApi.overview();
        const s = data.stats;
        setStats({
          totalGames: s.games.total,
          publishedGames: s.games.published,
          draftGames: Math.max(s.games.total - s.games.published, 0),
          totalNews: s.posts.total,
          players: s.players.total,
          subscribers: s.subscribers.total,
        });
        setRecentGames(data.recentGames);
        setRecentNews(data.recentPosts);
        setRecentActivity(data.recentActivity);
      } catch (error) {
        console.error('Failed to load dashboard:', error);
        notify('Failed to load dashboard data', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      PUBLISHED: 'bg-lime text-ink',
      DRAFT: 'bg-sun text-ink',
      IN_DEVELOPMENT: 'bg-grape text-white',
      EARLY_ACCESS: 'bg-sun text-ink',
      WISHLIST_NOW: 'bg-coral text-white',
      AVAILABLE_NOW: 'bg-lime text-ink'
    };
    return badges[status] || 'bg-ink text-paper';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-ink bg-cream animate-spin">
            <img src="/images/mascot_pix.png" alt="" className="h-8 w-8 object-cover" />
          </div>
          <p className="text-sm font-semibold text-inksoft">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight text-ink">Dashboard</h1>
          <p className="mt-1 text-sm font-medium text-inksoft">Overview of your studio content and activity</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-lime bg-lime/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-lime">
            Live
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {STAT_CARDS.map((card, i) => {
          const Icon = card.icon;
          const value = stats?.[card.key as keyof DashboardStats] ?? 0;
          return (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="rounded-2xl border-2 border-ink/10 bg-cream p-5 shadow-soft hover:border-ink/20 hover:shadow-lift transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-inksoft">{card.label}</p>
                  <p className="mt-2 font-display text-3xl font-extrabold text-ink">{value.toLocaleString()}</p>
                  <p className="mt-1 text-xs font-medium text-inksoft">{card.trend}</p>
                </div>
                <div className={`grid h-12 w-12 place-items-center rounded-xl border-2 border-ink ${card.color} shrink-0`}>
                  <Icon size={20} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border-2 border-ink/10 bg-cream shadow-soft">
          <div className="flex items-center justify-between border-b-2 border-ink/10 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl border-2 border-ink bg-grape">
                <Gamepad2 size={18} className="text-white" />
              </div>
              <div>
                <h2 className="font-display text-lg font-extrabold uppercase text-ink">Recent Games</h2>
                <p className="text-[10px] font-bold uppercase tracking-wider text-inksoft">Latest additions to your shelf</p>
              </div>
            </div>
            <Link to="/admin/games" className="text-sm font-semibold text-grape hover:text-grapedeep">
              View all <ArrowUpRight size={14} className="inline" />
            </Link>
          </div>
          <div className="divide-y divide-ink/10">
            {recentGames.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm font-medium text-inksoft">No games yet</p>
                <Link to="/admin/games/new" className="mt-2 inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-coral px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-white shadow-sticker-sm hover:-translate-y-0.5">
                  Add your first game
                </Link>
              </div>
            ) : (
              recentGames.map(game => (
                <Link key={game.id} to={`/admin/games/${game.id}`} className="flex items-center gap-4 px-6 py-4 hover:bg-sand transition-colors">
                  {game.heroImage && (
                    <img src={game.heroImage} alt="" className="h-12 w-16 rounded-xl border-2 border-ink/10 object-cover shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink truncate">{game.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`rounded-full border-2 border-ink px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${getStatusBadge(game.status)}`}>
                        {game.status.replace('_', ' ')}
                      </span>
                      {game.published ? (
                        <span className="rounded-full border-2 border-ink bg-lime/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-lime">
                          Published
                        </span>
                      ) : (
                        <span className="rounded-full border-2 border-ink bg-sun/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-sun">
                          Draft
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-inksoft">{formatDate(game.updatedAt)}</span>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border-2 border-ink/10 bg-cream shadow-soft">
          <div className="flex items-center justify-between border-b-2 border-ink/10 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl border-2 border-ink bg-coral">
                <Newspaper size={18} className="text-white" />
              </div>
              <div>
                <h2 className="font-display text-lg font-extrabold uppercase text-ink">Recent News</h2>
                <p className="text-[10px] font-bold uppercase tracking-wider text-inksoft">Latest stories and devlogs</p>
              </div>
            </div>
            <Link to="/admin/news" className="text-sm font-semibold text-grape hover:text-grapedeep">
              View all <ArrowUpRight size={14} className="inline" />
            </Link>
          </div>
          <div className="divide-y divide-ink/10">
            {recentNews.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm font-medium text-inksoft">No news posts yet</p>
                <Link to="/admin/news/new" className="mt-2 inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-coral px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-white shadow-sticker-sm hover:-translate-y-0.5">
                  Write your first post
                </Link>
              </div>
            ) : (
              recentNews.map(post => (
                <Link key={post.id} to={`/admin/news/${post.id}`} className="flex items-center gap-4 px-6 py-4 hover:bg-sand transition-colors">
                  {post.coverImage && (
                    <img src={post.coverImage} alt="" className="h-12 w-16 rounded-xl border-2 border-ink/10 object-cover shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink truncate">{post.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {post.category?.name && (
                        <span className="rounded-full border-2 border-ink bg-grape/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-grape">
                          {post.category.name}
                        </span>
                      )}
                      {post.status === 'PUBLISHED' ? (
                        <span className="rounded-full border-2 border-ink bg-lime/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-lime">
                          Published
                        </span>
                      ) : (
                        <span className="rounded-full border-2 border-ink bg-sun/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-sun">
                          Draft
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-inksoft">{formatDate(post.updatedAt)}</span>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border-2 border-ink/10 bg-cream shadow-soft">
        <div className="flex items-center justify-between border-b-2 border-ink/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border-2 border-ink bg-sky">
              <Clock size={18} className="text-white" />
            </div>
            <div>
              <h2 className="font-display text-lg font-extrabold uppercase text-ink">Recent Activity</h2>
              <p className="text-[10px] font-bold uppercase tracking-wider text-inksoft">Latest admin actions</p>
            </div>
          </div>
          <Link to="/admin/activity" className="text-sm font-semibold text-grape hover:text-grapedeep">
            View all <ArrowUpRight size={14} className="inline" />
          </Link>
        </div>
        <div className="divide-y divide-ink/10 px-6">
          {recentActivity.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-medium text-inksoft">No recent activity</p>
            </div>
          ) : (
            recentActivity.slice(0, 10).map(activity => (
              <div key={activity.id} className="flex items-center gap-4 py-4 hover:bg-sand transition-colors rounded-xl -mx-4 px-4">
                <div className="grid h-9 w-9 place-items-center rounded-xl border-2 border-ink bg-grape/10">
                  <MoreHorizontal size={16} className="text-grape" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink truncate">
                    <span className="text-grape">{activity.actorEmail || activity.admin?.name || activity.admin?.email || 'Admin'}</span>{' '}
                    {activity.summary || activity.action.toLowerCase().replace('_', ' ')}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-inksoft">{formatDate(activity.createdAt)}</p>
                </div>
                {activity.metadata && (
                  <button className="text-[10px] font-bold uppercase tracking-wider text-grape hover:underline" disabled>
                    View details
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};