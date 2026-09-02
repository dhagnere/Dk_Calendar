import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Compte } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { genererMotDePasse } from '../lib/generatePassword';

export default function Comptes() {
  const [comptes, setComptes] = useState<Compte[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'Administrateur' | 'Consultant'>('Consultant');
  const [envoi, setEnvoi] = useState(false);

  const charger = async () => {
    const data = await api.get<{ comptes: Compte[] }>('/comptes');
    setComptes(data.comptes);
  };

  useEffect(() => {
    charger();
  }, []);

  const creerCompte = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setMessage(null);
    try {
      const motDePasseTemporaire = genererMotDePasse();
      const res = await api.post<{ ok: boolean; message: string }>('/comptes', {
        nom,
        email,
        role,
        motDePasseTemporaire,
      });
      if (res.ok) {
        setMessage(`Compte créé pour ${email}. Mot de passe temporaire : ${motDePasseTemporaire}`);
        setNom('');
        setEmail('');
        setRole('Consultant');
        charger();
      } else {
        setMessage(res.message);
      }
    } finally {
      setEnvoi(false);
    }
  };

  const toggleStatut = async (compte: Compte) => {
    const nouveauStatut = compte.statut === 'Suspendu' ? 'Actif' : 'Suspendu';
    await api.post(`/comptes/${compte._id}/statut`, { statut: nouveauStatut });
    charger();
  };

  const reinitialiser = async (compte: Compte) => {
    const motDePasseTemporaire = genererMotDePasse();
    await api.post(`/comptes/${compte._id}/reinitialiser-mot-de-passe`, {
      nouveauMotDePasseTemporaire: motDePasseTemporaire,
    });
    setMessage(`Mot de passe réinitialisé pour ${compte.email} : ${motDePasseTemporaire}`);
    charger();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Créer un compte</CardTitle>
        </CardHeader>
        <CardContent>
          {message && <p className="mb-3 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">{message}</p>}
          <form className="flex flex-wrap items-end gap-3" onSubmit={creerCompte}>
            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-500">Nom</label>
              <Input value={nom} onChange={(e) => setNom(e.target.value)} required />
            </div>
            <div className="min-w-[220px] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-500">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Rôle</label>
              <Select value={role} onChange={(e) => setRole(e.target.value as 'Administrateur' | 'Consultant')}>
                <option value="Consultant">Consultant</option>
                <option value="Administrateur">Administrateur</option>
              </Select>
            </div>
            <Button type="submit" disabled={envoi}>
              Créer
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Nom</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Rôle</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2">Dernière connexion</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {comptes.map((c) => (
              <tr key={c._id}>
                <td className="px-3 py-2 font-medium text-slate-700">{c.nom}</td>
                <td className="px-3 py-2">{c.email}</td>
                <td className="px-3 py-2">{c.role}</td>
                <td className="px-3 py-2">
                  <Badge tone={c.statut === 'Suspendu' ? 'red' : c.statut === 'Actif' ? 'green' : 'orange'}>
                    {c.statut}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  {c.derniereConnexion ? new Date(c.derniereConnexion).toLocaleDateString('fr-FR') : '—'}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => toggleStatut(c)}>
                      {c.statut === 'Suspendu' ? 'Activer' : 'Suspendre'}
                    </Button>
                    <Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => reinitialiser(c)}>
                      Réinitialiser mot de passe
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
