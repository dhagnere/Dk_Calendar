import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import type { Evenement } from '../types';
import { Button } from '../components/ui/Button';
import { Dialog, DialogBody, DialogHeader } from '../components/ui/Dialog';
import { ImportExportEvenements } from '../components/ImportExportEvenements';
import { FicheEvenement } from '../components/FicheEvenement';

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const MAX_LIGNES_VISIBLES = 4;

function debutSemaine(date: Date): Date {
  const jour = (date.getDay() + 6) % 7; // 0 = lundi
  const d = new Date(date);
  d.setDate(d.getDate() - jour);
  d.setHours(0, 0, 0, 0);
  return d;
}

function memeJour(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function chipClasse(e: Evenement): string {
  if (e.validationTechnique && e.validationPolitique) return 'bg-purple-100 text-purple-800';
  if (e.validationTechnique) return 'bg-green-100 text-green-800';
  if (e.validationPolitique) return 'bg-blue-100 text-blue-800';
  return 'bg-red-100 text-red-800';
}

export default function Calendrier() {
  const { estAdministrateur } = useAuth();
  const [mois, setMois] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [evenements, setEvenements] = useState<Evenement[]>([]);
  const [jourSelectionne, setJourSelectionne] = useState<Date | null>(null);
  const [stats, setStats] = useState<{ total: number; validated: number; pending: number } | null>(null);

  const charger = async () => {
    const data = await api.get<{ items: Evenement[] }>('/evenements');
    setEvenements(data.items);
    const s = await api.get<{ total: number; validated: number; pending: number }>('/evenements/stats');
    setStats(s);
  };

  useEffect(() => {
    charger();
  }, []);

  const jours = useMemo(() => {
    const premier = new Date(mois.getFullYear(), mois.getMonth(), 1);
    const debut = debutSemaine(premier);
    const cases: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(debut);
      d.setDate(d.getDate() + i);
      cases.push(d);
    }
    return cases;
  }, [mois]);

  const evenementsDuJour = (jour: Date) =>
    evenements.filter((e) => {
      // Cas normal : la ligne représente précisément ce jour (dateClef).
      if (e.dateClef) return memeJour(new Date(e.dateClef), jour);
      // Repli pour un événement sans dateClef (ex: créé manuellement) : chevauchement de plage.
      if (!e.dateDeDebut) return false;
      const debut = new Date(e.dateDeDebut);
      const fin = e.dateDeFin ? new Date(e.dateDeFin) : debut;
      const j = new Date(jour);
      j.setHours(12, 0, 0, 0);
      return j >= new Date(debut.getFullYear(), debut.getMonth(), debut.getDate()) &&
        j <= new Date(fin.getFullYear(), fin.getMonth(), fin.getDate());
    });

  const archiverPasses = async () => {
    await api.post('/evenements/archiver-passes');
    charger();
  };

  const validerUnClic = async (id: string) => {
    await api.post(`/evenements/${id}/valider`, {});
    charger();
  };

  const toggleValidation = async (id: string, champ: 'validationTechnique' | 'validationPolitique', valeur: boolean) => {
    await api.post(`/evenements/${id}/validations`, { [champ]: valeur });
    charger();
  };

  const evenementsJourOuvert = jourSelectionne ? evenementsDuJour(jourSelectionne) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setMois(new Date(mois.getFullYear(), mois.getMonth() - 1, 1))}>
            ←
          </Button>
          <h2 className="w-48 text-center text-lg font-semibold text-slate-700">
            {MOIS[mois.getMonth()]} {mois.getFullYear()}
          </h2>
          <Button variant="secondary" onClick={() => setMois(new Date(mois.getFullYear(), mois.getMonth() + 1, 1))}>
            →
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {estAdministrateur && (
            <Button variant="secondary" onClick={archiverPasses}>
              Archiver les événements passés
            </Button>
          )}
          <ImportExportEvenements onImported={charger} />
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
            <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
            <p className="text-xs text-slate-500">Total affiché</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.validated}</p>
            <p className="text-xs text-slate-500">Validés</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
            <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
            <p className="text-xs text-slate-500">En attente</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200">
        {JOURS.map((j) => (
          <div key={j} className="bg-slate-100 py-2 text-center text-xs font-semibold text-slate-500">
            {j}
          </div>
        ))}
        {jours.map((jour) => {
          const evts = evenementsDuJour(jour);
          const horsMois = jour.getMonth() !== mois.getMonth();
          const surplus = evts.length - MAX_LIGNES_VISIBLES;
          return (
            <button
              key={jour.toISOString()}
              onClick={() => setJourSelectionne(jour)}
              className={`min-h-[132px] bg-white p-1.5 text-left align-top hover:bg-slate-50 ${horsMois ? 'text-slate-300' : 'text-slate-700'}`}
            >
              <span className={`text-xs ${memeJour(jour, new Date()) ? 'rounded-full bg-primary px-1.5 py-0.5 text-white' : ''}`}>
                {jour.getDate()}
              </span>
              <div className="mt-1 space-y-0.5">
                {evts.slice(0, MAX_LIGNES_VISIBLES).map((e) => (
                  <div
                    key={e._id}
                    className={`truncate rounded px-1 py-[1px] text-[10px] leading-tight ${chipClasse(e)}`}
                    title={e.nom}
                  >
                    {e.nom}
                  </div>
                ))}
                {surplus > 0 && (
                  <div className="truncate px-1 text-[10px] font-semibold text-slate-500">
                    +{surplus} événement{surplus > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <Dialog open={!!jourSelectionne} onClose={() => setJourSelectionne(null)}>
        {jourSelectionne && (
          <>
            <DialogHeader
              title={jourSelectionne.toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
              onClose={() => setJourSelectionne(null)}
            />
            <DialogBody>
              <div className="space-y-3">
                {evenementsJourOuvert.length === 0 && <p className="text-sm text-slate-400">Aucun événement ce jour.</p>}
                {evenementsJourOuvert.map((e) => (
                  <FicheEvenement
                    key={e._id}
                    evenement={e}
                    estAdministrateur={estAdministrateur}
                    onToggleValidation={toggleValidation}
                    onValider={validerUnClic}
                  />
                ))}
              </div>
            </DialogBody>
          </>
        )}
      </Dialog>
    </div>
  );
}
