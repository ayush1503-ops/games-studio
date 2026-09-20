import React from 'react';
import { ExternalLink, Settings2 } from 'lucide-react';

/**
 * Shown on auth screens (login / forgot / reset) when the Supabase browser
 * credentials are missing, instead of a bare "not configured" error.
 *
 * Supabase is the only backend, so without VITE_SUPABASE_URL and
 * VITE_SUPABASE_ANON_KEY no auth call can work — neither locally nor on
 * Vercel. This card tells the operator exactly where to get the values and
 * where to put them.
 */
export const SupabaseSetupNotice: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  return (
    <div
      role="alert"
      className="mb-4 rounded-xl border-2 border-grape bg-grape/10 px-4 py-3 text-left"
    >
      <div className="flex items-start gap-2">
        <Settings2 size={16} className="mt-0.5 shrink-0 text-grape" />
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-ink">Supabase is not configured</p>
          <p className="mt-0.5 text-xs font-semibold text-inksoft">
            Add the project URL and publishable key, then reload this page.
          </p>
        </div>
      </div>

      {!compact && (
        <ol className="mt-3 list-decimal space-y-1.5 pl-9 text-[11px] font-semibold leading-relaxed text-ink">
          <li>
            Open your{' '}
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-grape hover:underline"
            >
              Supabase dashboard <ExternalLink size={11} />
            </a>{' '}
            → Project Settings → API, and copy the <span className="text-ink">Project URL</span> plus the{' '}
            <span className="text-ink">anon / publishable</span> key.
          </li>
          <li>
            Local dev: copy <code className="rounded bg-ink/10 px-1 py-0.5 font-mono text-[10px]">.env.example</code>{' '}
            to <code className="rounded bg-ink/10 px-1 py-0.5 font-mono text-[10px]">.env.local</code>, fill in{' '}
            <code className="rounded bg-ink/10 px-1 py-0.5 font-mono text-[10px]">VITE_SUPABASE_URL</code> and{' '}
            <code className="rounded bg-ink/10 px-1 py-0.5 font-mono text-[10px]">VITE_SUPABASE_ANON_KEY</code>, then
            restart <code className="rounded bg-ink/10 px-1 py-0.5 font-mono text-[10px]">npm run dev</code>.
          </li>
          <li>
            Vercel: Project → Settings → Environment Variables → add the same two variables → Redeploy. Never put a{' '}
            <code className="rounded bg-ink/10 px-1 py-0.5 font-mono text-[10px]">service_role</code> key in a{' '}
            <code className="rounded bg-ink/10 px-1 py-0.5 font-mono text-[10px]">VITE_</code> variable or in Git.
          </li>
        </ol>
      )}
    </div>
  );
};
