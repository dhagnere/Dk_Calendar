import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-primary text-primary-foreground' : 'text-slate-600 hover:bg-slate-100'}`;

export function AppLayout() {
  const { session, loading, estAdministrateur, deconnexion } = useAuth();

  if (loading) return <div className="flex h-screen items-center justify-center text-slate-500">Chargement…</div>;
  if (!session) return <Navigate to="/connexion" replace />;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-lg font-bold text-slate-800">📅 Calendrier Dunkerque</span>
            <nav className="flex gap-1">
              <NavLink to="/" end className={linkClass}>
                Calendrier
              </NavLink>
              <NavLink to="/liste" className={linkClass}>
                Liste
              </NavLink>
              {estAdministrateur && (
                <>
                  <NavLink to="/comptes" className={linkClass}>
                    Comptes
                  </NavLink>
                  <NavLink to="/demandes" className={linkClass}>
                    Demandes d'accès
                  </NavLink>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {!estAdministrateur && <Badge tone="blue">Consultation seule</Badge>}
            <span className="text-sm text-slate-600">{session.nom}</span>
            <Button variant="secondary" onClick={() => deconnexion()}>
              Déconnexion
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
