import { useEffect, useState } from 'react';
import { api } from '../api';
import type { DemandeAcces } from '../types';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { genererMotDePasse } from '../lib/generatePassword';

export default function Demandes() {
  const [demandes, setDemandes] = useState<DemandeAcces[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [roleParDemande, setRoleParDemande] = useState<Record<string, 'Administrateur' | 'Consultant'>>({});

  const charger = async () => {
    const data = await api.get<{ demandes: DemandeAcces[] }>('/demandes-acces');
    setDemandes(data.demandes);
  };

  useEffect(() => {
    charger();
  }, []);

  const roleDe = (id: string) => roleParDemande[id] ?? 'Consultant';

  const approuver = async (demande: DemandeAcces) => {
    const motDePasseTemporaire = genererMotDePasse();
    const res = await api.post<{ ok: boolean; message: string }>(`/demandes-acces/${demande._id}/approuver`, {
      role: roleDe(demande._id),
      motDePasseTemporaire,
    });
    if (res.ok) {
      setMessage(`Compte créé pour ${demande.email} (${roleDe(demande._id)}). Mot de passe temporaire : ${motDePasseTemporaire}`);
    } else {
      setMessage(res.message);
    }
    charger();
  };

  const rejeter = async (demande: DemandeAcces) => {
    await api.post(`/demandes-acces/${demande._id}/rejeter`, {});
    setMessage(`Demande de ${demande.email} rejetée`);
    charger();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Demandes d'accès en attente</CardTitle>
        </CardHeader>
        <CardContent>
          {message && <p className="mb-3 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">{message}</p>}

          {demandes.length === 0 && <p className="text-sm text-slate-400">Aucune demande en attente.</p>}

          <div className="space-y-3">
            {demandes.map((d) => (
              <div key={d._id} className="rounded-md border border-slate-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-700">
                      {d.nom} <span className="font-normal text-slate-400">— {d.email}</span>
                    </p>
                    {d.organisation && <p className="text-xs text-slate-500">Organisation : {d.organisation}</p>}
                    {d.motif && <p className="mt-1 text-sm text-slate-600">« {d.motif} »</p>}
                    <p className="mt-1 text-xs text-slate-400">
                      Demandé le {new Date(d.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={roleDe(d._id)}
                      onChange={(e) =>
                        setRoleParDemande((r) => ({ ...r, [d._id]: e.target.value as 'Administrateur' | 'Consultant' }))
                      }
                      className="w-40"
                    >
                      <option value="Consultant">Consultant</option>
                      <option value="Administrateur">Administrateur</option>
                    </Select>
                    <Button className="px-3 py-1.5 text-xs" onClick={() => approuver(d)}>
                      Approuver
                    </Button>
                    <Button variant="danger" className="px-3 py-1.5 text-xs" onClick={() => rejeter(d)}>
                      Rejeter
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
