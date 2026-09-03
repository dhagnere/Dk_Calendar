import { Button, Card, Checkbox, Descriptions, Typography } from 'antd';
import { estValide, type Evenement } from '../types';
import { formatDate } from '../lib/formatDate';
import { COULEUR_NON_VALIDE, COULEUR_VALIDE } from '../lib/validationColors';
import { ValidationBadge } from './ValidationBadge';

interface Props {
  evenement: Evenement;
  estAdministrateur: boolean;
  onToggleValidation: (id: string, champ: 'validationTechnique' | 'validationPolitique', valeur: boolean) => void;
  onValider: (id: string) => void;
}

/** Fiche détaillée d'un événement, utilisée dans la pop-up du jour sélectionné (vue Calendrier). */
export function FicheEvenement({ evenement, estAdministrateur, onToggleValidation, onValider }: Props) {
  const items = [
    { key: 'lieu', label: 'Lieu', children: evenement.lieu || '—' },
    { key: 'statut', label: 'Statut', children: evenement.statut || '—' },
    { key: 'pilote', label: 'Pilote', children: evenement.pilote || '—' },
    { key: 'direction', label: 'Direction pilote', children: evenement.directionPilote || '—' },
    { key: 'organisateur', label: 'Organisateur', children: evenement.organisateur || '—' },
    { key: 'type', label: 'Type', children: evenement.type || '—' },
    {
      key: 'periode',
      label: 'Période',
      children: `${formatDate(evenement.dateDeDebut)} → ${formatDate(evenement.dateDeFin)}`,
    },
    {
      key: 'tardive',
      label: 'Tardive / Reprog.',
      children: `${evenement.tardive || 'Non'} / ${evenement.reprog || 'Non'}`,
    },
  ];

  const couleurBordure = estValide(evenement) ? COULEUR_VALIDE : COULEUR_NON_VALIDE;

  return (
    <Card
      size="small"
      style={{ borderWidth: 2, borderColor: couleurBordure }}
      title={
        <div>
          <Typography.Text strong>{evenement.nom}</Typography.Text>
          <div style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 'normal' }}>
            {[evenement.quartier, evenement.nature, evenement.niveau].filter(Boolean).join(' · ')}
          </div>
        </div>
      }
      extra={<ValidationBadge evenement={evenement} />}
    >
      <Descriptions column={{ xs: 1, sm: 2 }} size="small" items={items} />

      {estAdministrateur && (
        <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <Checkbox
            checked={evenement.validationTechnique}
            onChange={(e) => onToggleValidation(evenement._id, 'validationTechnique', e.target.checked)}
          >
            Validation technique
          </Checkbox>
          <Checkbox
            checked={evenement.validationPolitique}
            onChange={(e) => onToggleValidation(evenement._id, 'validationPolitique', e.target.checked)}
          >
            Validation politique
          </Checkbox>
          <Button size="small" style={{ marginLeft: 'auto' }} onClick={() => onValider(evenement._id)}>
            Valider en un clic
          </Button>
        </div>
      )}
    </Card>
  );
}
