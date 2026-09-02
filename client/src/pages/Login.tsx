import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';

export default function Login() {
  const { session, connexion } = useAuth();
  const [adminExiste, setAdminExiste] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  // Formulaire connexion
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');

  // Formulaire création admin initial
  const [nom, setNom] = useState('');
  const [emailAdmin, setEmailAdmin] = useState('');
  const [motDePasseAdmin, setMotDePasseAdmin] = useState('');

  useEffect(() => {
    api
      .get<{ existe: boolean; nombreComptes: number }>('/auth/existe-administrateur')
      .then((r) => setAdminExiste(r.existe))
      .catch(() => setMessage('Impossible de contacter le serveur. Réessayez dans un instant.'));
  }, []);

  if (session) return <Navigate to="/" replace />;

  const soumettreConnexion = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setMessage(null);
    try {
      const res = await connexion(email, motDePasse);
      if (!res.ok) setMessage(res.message);
    } finally {
      setEnvoi(false);
    }
  };

  const soumettreCreationAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setMessage(null);
    try {
      const res = await api.post<{ ok: boolean; message: string }>('/auth/initialiser-administrateur', {
        nom,
        email: emailAdmin,
        motDePasse: motDePasseAdmin,
      });
      if (res.ok) {
        setAdminExiste(true);
        setMessage('Compte créé, vous pouvez vous connecter.');
      } else {
        setMessage(res.message);
      }
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            {adminExiste === false ? "Créer le compte administrateur" : 'Connexion — Calendrier Dunkerque'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {message && <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{message}</p>}

          {adminExiste === null && <p className="text-sm text-slate-500">Chargement…</p>}

          {adminExiste === false && (
            <form className="space-y-3" onSubmit={soumettreCreationAdmin}>
              <Input placeholder="Nom complet" value={nom} onChange={(e) => setNom(e.target.value)} required />
              <Input
                type="email"
                placeholder="Email"
                value={emailAdmin}
                onChange={(e) => setEmailAdmin(e.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="Mot de passe (10 caractères min.)"
                value={motDePasseAdmin}
                onChange={(e) => setMotDePasseAdmin(e.target.value)}
                minLength={10}
                required
              />
              <Button type="submit" className="w-full" disabled={envoi}>
                Créer le compte administrateur
              </Button>
            </form>
          )}

          {adminExiste === true && (
            <form className="space-y-3" onSubmit={soumettreConnexion}>
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="Mot de passe"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                required
              />
              <Button type="submit" className="w-full" disabled={envoi}>
                Se connecter
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
