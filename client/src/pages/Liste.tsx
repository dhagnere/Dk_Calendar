import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import type { Evenement } from '../types';
import { ValidationBadge } from '../components/ValidationBadge';
import { ImportExportEvenements } from '../components/ImportExportEvenements';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { Checkbox } from '../components/ui/Checkbox';
import { formatDate } from '../lib/formatDate';

export default function Liste() {
  const { estAdministrateur } = useAuth();
  const [evenements, setEvenements] = useState<Evenement[]>([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState('');
  const [quartier, setQuartier] = useState('ALL');
  const [statut, setStatut] = useState('ALL');
  const [options, setOptions] = useState<{ quartiers: { label: string }[]; statuts: { label: string }[] }>({
    quartiers: [],
    statuts: [],
  });

  const charger = async () => {
    setChargement(true);
    try {
      const params = new URLSearchParams();
      if (recherche) params.set('searchTerm', recherche);
      if (quartier !== 'ALL') params.set('quartier', quartier);
      if (statut !== 'ALL') params.set('statut', statut);
      const data = await api.get<{ items: Evenement[] }>(`/evenements?${params.toString()}`);
      setEvenements(data.items);
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    api
      .get<{ quartiers: { label: string }[]; natures: { label: string }[]; statuts: { label: string }[] }>(
        '/evenements/options-filtres'
      )
      .then(setOptions);
  }, []);

  useEffect(() => {
    const t = setTimeout(charger, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recherche, quartier, statut]);

  const toggleValidation = async (id: string, champ: 'validationTechnique' | 'validationPolitique', valeur: boolean) => {
    await api.post(`/evenements/${id}/validations`, { [champ]: valeur });
    charger();
  };

  const validerUnClic = async (id: string) => {
    await api.post(`/evenements/${id}/valider`, {});
    charger();
  };

  const total = evenements.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-500">Recherche</label>
          <Input placeholder="Nom de l'événement…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Quartier</label>
          <Select value={quartier} onChange={(e) => setQuartier(e.target.value)}>
            <option value="ALL">Tous</option>
            {options.quartiers.map((q) => (
              <option key={q.label} value={q.label}>
                {q.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Statut</label>
          <Select value={statut} onChange={(e) => setStatut(e.target.value)}>
            <option value="ALL">Tous</option>
            <option value="Validée">Validée</option>
            {options.statuts.map((s) => (
              <option key={s.label} value={s.label}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="ml-auto">
          <ImportExportEvenements onImported={charger} />
        </div>
      </div>

      <p className="text-sm text-slate-500">{total} événement(s)</p>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Nom</th>
              <th className="px-3 py-2">Jour</th>
              <th className="px-3 py-2">Début</th>
              <th className="px-3 py-2">Fin</th>
              <th className="px-3 py-2">Quartier</th>
              <th className="px-3 py-2">Nature</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2">Validation</th>
              {estAdministrateur && <th className="px-3 py-2">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {chargement && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-slate-400">
                  Chargement…
                </td>
              </tr>
            )}
            {!chargement && evenements.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-slate-400">
                  Aucun événement
                </td>
              </tr>
            )}
            {evenements.map((e) => (
              <tr key={e._id}>
                <td className="px-3 py-2 font-medium text-slate-700">{e.nom}</td>
                <td className="px-3 py-2">{formatDate(e.dateClef)}</td>
                <td className="px-3 py-2">{formatDate(e.dateDeDebut)}</td>
                <td className="px-3 py-2">{formatDate(e.dateDeFin)}</td>
                <td className="px-3 py-2">{e.quartier}</td>
                <td className="px-3 py-2">{e.nature}</td>
                <td className="px-3 py-2">{e.statut}</td>
                <td className="px-3 py-2">
                  <ValidationBadge evenement={e} />
                </td>
                {estAdministrateur && (
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 text-xs" title="Validation technique">
                        <Checkbox
                          checked={e.validationTechnique}
                          onChange={(ev) => toggleValidation(e._id, 'validationTechnique', ev.target.checked)}
                        />
                        Tech.
                      </label>
                      <label className="flex items-center gap-1 text-xs" title="Validation politique">
                        <Checkbox
                          checked={e.validationPolitique}
                          onChange={(ev) => toggleValidation(e._id, 'validationPolitique', ev.target.checked)}
                        />
                        Pol.
                      </label>
                      <Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => validerUnClic(e._id)}>
                        Valider
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
