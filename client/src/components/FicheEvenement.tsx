import type { Evenement } from '../types';
import { formatDate } from '../lib/formatDate';
import { ValidationBadge } from './ValidationBadge';
import { Checkbox } from './ui/Checkbox';
import { Button } from './ui/Button';

interface Props {
  evenement: Evenement;
  estAdministrateur: boolean;
  onToggleValidation: (id: string, champ: 'validationTechnique' | 'validationPolitique', valeur: boolean) => void;
  onValider: (id: string) => void;
}

/** Fiche détaillée d'un événement, utilisée dans la pop-up du jour sélectionné (vue Calendrier). */
export function FicheEvenement({ evenement, estAdministrateur, onToggleValidation, onValider }: Props) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-800">{evenement.nom}</p>
          <p className="text-xs text-slate-500">
            {[evenement.quartier, evenement.nature, evenement.niveau].filter(Boolean).join(' · ')}
          </p>
        </div>
        <ValidationBadge evenement={evenement} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-600">
        <div>
          <dt className="font-medium text-slate-400">Lieu</dt>
          <dd>{evenement.lieu || '—'}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-400">Statut</dt>
          <dd>{evenement.statut || '—'}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-400">Pilote</dt>
          <dd>{evenement.pilote || '—'}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-400">Direction pilote</dt>
          <dd>{evenement.directionPilote || '—'}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-400">Organisateur</dt>
          <dd>{evenement.organisateur || '—'}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-400">Type</dt>
          <dd>{evenement.type || '—'}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-400">Période</dt>
          <dd>
            {formatDate(evenement.dateDeDebut)} → {formatDate(evenement.dateDeFin)}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-slate-400">Tardive / Reprog.</dt>
          <dd>
            {evenement.tardive || 'Non'} / {evenement.reprog || 'Non'}
          </dd>
        </div>
      </dl>

      {estAdministrateur && (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-2">
          <label className="flex items-center gap-1 text-xs text-slate-600">
            <Checkbox
              checked={evenement.validationTechnique}
              onChange={(ev) => onToggleValidation(evenement._id, 'validationTechnique', ev.target.checked)}
            />
            Validation technique
          </label>
          <label className="flex items-center gap-1 text-xs text-slate-600">
            <Checkbox
              checked={evenement.validationPolitique}
              onChange={(ev) => onToggleValidation(evenement._id, 'validationPolitique', ev.target.checked)}
            />
            Validation politique
          </label>
          <Button variant="secondary" className="ml-auto px-2 py-1 text-xs" onClick={() => onValider(evenement._id)}>
            Valider en un clic
          </Button>
        </div>
      )}
    </div>
  );
}
