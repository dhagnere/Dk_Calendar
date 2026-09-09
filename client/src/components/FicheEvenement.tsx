import { useState } from 'react';
import { Button, Card, Checkbox, DatePicker, Descriptions, Popconfirm, Typography } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { estValide, type Evenement } from '../types';
import { formatDate } from '../lib/formatDate';
import { formatTitreEvenement } from '../lib/formatTitre';
import { COULEUR_DATE_CLEF, COULEUR_NON_VALIDE, COULEUR_VALIDE } from '../lib/validationColors';
import { ValidationBadge } from './ValidationBadge';

const { RangePicker } = DatePicker;

interface Props {
  evenement: Evenement;
  estAdministrateur: boolean;
  onToggleValidation: (id: string, champ: 'validationTechnique' | 'validationPolitique', valeur: boolean) => void;
  onValider: (id: string) => void;
  onSupprimer?: (id: string) => void;
  onChangerDates?: (id: string, dateDeDebut: string, dateDeFin: string | null) => void;
}

/** Fiche détaillée d'un événement, utilisée dans la pop-up du jour sélectionné (vue Calendrier). */
export function FicheEvenement({
  evenement,
  estAdministrateur,
  onToggleValidation,
  onValider,
  onSupprimer,
  onChangerDates,
}: Props) {
  const [plage, setPlage] = useState<[Dayjs, Dayjs] | null>([
    evenement.dateDeDebut ? dayjs(evenement.dateDeDebut) : dayjs(),
    evenement.dateDeFin ? dayjs(evenement.dateDeFin) : evenement.dateDeDebut ? dayjs(evenement.dateDeDebut) : dayjs(),
  ]);
  const items = [
    { key: 'lieu', label: 'Lieu', children: evenement.lieu || '—' },
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

  const couleurBordure = evenement.validParDateClef
    ? COULEUR_DATE_CLEF
    : estValide(evenement)
      ? COULEUR_VALIDE
      : COULEUR_NON_VALIDE;

  return (
    <Card
      size="small"
      style={{ borderWidth: 2, borderColor: couleurBordure }}
      title={
        <div>
          <Typography.Text strong>{formatTitreEvenement(evenement.nom)}</Typography.Text>
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

      {estAdministrateur && (onChangerDates || onSupprimer) && (
        <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {onChangerDates && (
            <>
              <RangePicker
                size="small"
                format="DD/MM/YYYY"
                value={plage}
                onChange={(valeurs) => valeurs && setPlage(valeurs as [Dayjs, Dayjs])}
                allowClear={false}
              />
              <Button
                size="small"
                onClick={() => plage && onChangerDates(evenement._id, plage[0].toISOString(), plage[1].isSame(plage[0], 'day') ? null : plage[1].toISOString())}
              >
                Reporter
              </Button>
            </>
          )}
          {onSupprimer && (
            <Popconfirm
              title="Supprimer cet événement ?"
              description="Cette action est définitive."
              okText="Supprimer"
              okButtonProps={{ danger: true }}
              cancelText="Annuler"
              onConfirm={() => onSupprimer(evenement._id)}
            >
              <Button size="small" danger icon={<DeleteOutlined />} style={{ marginLeft: 'auto' }}>
                Supprimer
              </Button>
            </Popconfirm>
          )}
        </div>
      )}
    </Card>
  );
}
