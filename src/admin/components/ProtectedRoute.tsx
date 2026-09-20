import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoadingBlock, Panel } from '../ui';

/**
 * Route guard. The API rejects unauthorised calls regardless of what the client
 * does here; this exists so people never stare at an empty console.
 */
export const ProtectedRoute: React.FC<{ children: React.ReactNode; permission?: string }> = ({
  children,
  permission,
}) => {
  const { user, loading, can } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper p-6">
        <Panel className="w-full max-w-sm">
          <LoadingBlock label="Checking your studio pass…" />
        </Panel>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  if (permission && !can(permission)) {
    return (
      <div className="grid min-h-[60vh] place-items-center p-6">
        <Panel className="max-w-md p-8 text-center">
          <div className="mx-auto grid h-14 w-14 rotate-3 place-items-center rounded-2xl border-2 border-ink bg-coral text-2xl shadow-sticker-sm">
            🔒
          </div>
          <h2 className="mt-4 font-display text-xl font-extrabold uppercase text-ink">Not your wing</h2>
          <p className="mt-2 text-sm font-medium text-inksoft">
            Your role does not include access to this section. Ask an owner if that needs to change.
          </p>
        </Panel>
      </div>
    );
  }

  return <>{children}</>;
};
