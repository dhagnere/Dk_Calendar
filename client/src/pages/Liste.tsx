import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, Checkbox, Input, Popconfirm, Select, Switch, Table, Typography, type TableColumnsType } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import type { Evenement } from '../types';
import { ValidationBadge } from '../components/ValidationBadge';
import { ImportExportEvenements } from '../components/ImportExportEvenements';
import { formatDate } from '../lib/formatDate';

const { Text } = Typography;

const MOIS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** Texte de durée affiché sous le nom d'un événement, ex. "du 12/07/2026 au 15/07/2026". */
function formatDuree(e: Evenement): string | null {
  if (!e.dateDeDebut) return null;
  const debut = formatDate(e.dateDeDebut);
  const fin = e.dateDeFin ? formatDate(e.dateDeFin) : null;
  if (!fin || fin === debut) return debut;
  return `du ${debut} au ${fin}`;
}

/**
 * Un événement sur plusieurs jours a une ligne par jour occupé (dateClef), toutes partageant le
 * même nom/dateDeDebut/dateDeFin. Pour la liste, on ne veut plus qu'une seule ligne par événement :
 * on regroupe donc par (nom, dateDeDebut, dateDeFin) et on ne garde qu'une ligne représentative.
 */
function regrouperParEvenement(evenements: Evenement[]): Evenement[] {
  const parCle = new Map<string, Evenement>();
  for (const e of evenements) {
    const cle = `${e.nom}|${e.dateDeDebut ?? ''}|${e.dateDeFin ?? ''}`;
    if (!parCle.has(cle)) parCle.set(cle, e);
  }
  return [...parCle.values()];
}

/** Début (lundi) de la semaine contenant `date`. */
function debutSemaine(date: Date): Date {
  const jour = (date.getDay() + 6) % 7; // 0 = lundi
  const d = new Date(date);
  d.setDate(d.getDate() - jour);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Fin (dimanche) de la semaine dont `debut` est le lundi. */
function finSemaine(debut: Date): Date {
  const d = new Date(debut);
  d.setDate(d.getDate() + 6);
  return d;
}

/** Ex. "Semaine du 01 janvier au 07 janvier 2026 inclus". */
function formatSemaine(debut: Date, fin: Date): string {
  const jour = (d: Date) => String(d.getDate()).padStart(2, '0');
  const anneeDebut = debut.getFullYear() !== fin.getFullYear() ? ` ${debut.getFullYear()}` : '';
  return `Semaine du ${jour(debut)} ${MOIS_FR[debut.getMonth()]}${anneeDebut} au ${jour(fin)} ${MOIS_FR[fin.getMonth()]} ${fin.getFullYear()} inclus`;
}

type LigneListe =
  | { type: 'entete'; key: string; label: string }
  | { type: 'evenement'; key: string; evenement: Evenement };

/**
 * Regroupe les événements par semaine (lundi à dimanche) de leur dateDeDebut (dateClef en repli),
 * du plus ancien au plus récent, avec une ligne d'en-tête avant chaque semaine. Les événements sans
 * aucune date sont placés dans un dernier groupe « Sans date planifiée ».
 */
function regrouperParSemaine(evenements: Evenement[]): LigneListe[] {
  const avecDate = evenements.filter((e) => e.dateDeDebut || e.dateClef);
  const sansDate = evenements.filter((e) => !e.dateDeDebut && !e.dateClef);

  const trie = [...avecDate].sort((a, b) => {
    const da = new Date((a.dateDeDebut ?? a.dateClef)!).getTime();
    const db = new Date((b.dateDeDebut ?? b.dateClef)!).getTime();
    return da - db;
  });

  const lignes: LigneListe[] = [];
  let cleSemaineCourante: string | null = null;
  for (const e of trie) {
    const debut = debutSemaine(new Date((e.dateDeDebut ?? e.dateClef)!));
    const cle = debut.toISOString();
    if (cle !== cleSemaineCourante) {
      cleSemaineCourante = cle;
      lignes.push({ type: 'entete', key: `entete-${cle}`, label: formatSemaine(debut, finSemaine(debut)) });
    }
    lignes.push({ type: 'evenement', key: e._id, evenement: e });
  }

  if (sansDate.length > 0) {
    lignes.push({ type: 'entete', key: 'entete-sans-date', label: 'Sans date planifiée' });
    for (const e of sansDate) lignes.push({ type: 'evenement', key: e._id, evenement: e });
  }

  return lignes;
}

export default function Liste() {
  const { estAdministrateur } = useAuth();
  const [evenements, setEvenements] = useState<Evenement[]>([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState('');
  const [quartier, setQuartier] = useState('ALL');
  const [statut, setStatut] = useState('ALL');
  const [avecEvenementsPasses, setAvecEvenementsPasses] = useState(false);
  const [avecEvenementsArchives, setAvecEvenementsArchives] = useState(false);
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
      if (avecEvenementsPasses) params.set('avecEvenementsPasses', 'true');
      if (avecEvenementsArchives) params.set('avecEvenementsArchives', 'true');
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
  }, [recherche, quartier, statut, avecEvenementsPasses, avecEvenementsArchives]);

  const toggleValidation = async (id: string, champ: 'validationTechnique' | 'validationPolitique', valeur: boolean) => {
    await api.post(`/evenements/${id}/validations`, { [champ]: valeur });
    charger();
  };

  const validerUnClic = async (id: string) => {
    await api.post(`/evenements/${id}/valider`, {});
    charger();
  };

  const supprimer = async (id: string) => {
    await api.delete(`/evenements/${id}`);
    charger();
  };

  const evenementsGroupes = useMemo(() => regrouperParEvenement(evenements), [evenements]);
  const total = evenementsGroupes.length;
  const lignes = useMemo(() => regrouperParSemaine(evenementsGroupes), [evenementsGroupes]);

  /** Colonnes « normales », appliquées uniquement aux lignes de type événement. */
  const colonnesEvenement: { title: string; key: string; render: (e: Evenement) => ReactNode }[] = [
    {
      title: 'Nom',
      key: 'nom',
      render: (e) => (
        <div>
          <Text strong>{e.nom}</Text>
          {formatDuree(e) && <div style={{ fontSize: 12, color: '#8c8c8c' }}>{formatDuree(e)}</div>}
        </div>
      ),
    },
    { title: 'Quartier', key: 'quartier', render: (e) => e.quartier },
    { title: 'Nature', key: 'nature', render: (e) => e.nature },
    { title: 'Statut', key: 'statut', render: (e) => e.statut },
    { title: 'Validation', key: 'validation', render: (e) => <ValidationBadge evenement={e} /> },
    ...(estAdministrateur
      ? [
          {
            title: 'Actions',
            key: 'actions',
            render: (e: Evenement) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
                <Checkbox
                  checked={e.validationTechnique}
                  onChange={(ev) => toggleValidation(e._id, 'validationTechnique', ev.target.checked)}
                >
                  Tech.
                </Checkbox>
                <Checkbox
                  checked={e.validationPolitique}
                  onChange={(ev) => toggleValidation(e._id, 'validationPolitique', ev.target.checked)}
                >
                  Pol.
                </Checkbox>
                <Button size="small" onClick={() => validerUnClic(e._id)}>
                  Valider
                </Button>
                <Popconfirm
                  title="Supprimer cet événement ?"
                  description="Cette action est définitive."
                  okText="Supprimer"
                  okButtonProps={{ danger: true }}
                  cancelText="Annuler"
                  onConfirm={() => supprimer(e._id)}
                >
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </div>
            ),
          },
        ]
      : []),
  ];

  /**
   * Les colonnes réelles de la Table : sur une ligne d'en-tête de semaine, la première colonne
   * fusionne toute la largeur (colSpan) pour afficher le libellé de la semaine, les autres colonnes
   * sont fusionnées dedans (colSpan: 0), technique standard d'antd pour des lignes de séparation.
   */
  const columns: TableColumnsType<LigneListe> = colonnesEvenement.map((col, index) => ({
    title: col.title,
    key: col.key,
    onCell: (ligne: LigneListe) => {
      if (ligne.type !== 'entete') return {};
      return index === 0 ? { colSpan: colonnesEvenement.length, style: { background: '#e6f4ff' } } : { colSpan: 0 };
    },
    render: (_: unknown, ligne: LigneListe) => {
      if (ligne.type === 'entete') {
        return index === 0 ? (
          <Text strong style={{ fontSize: 13, color: '#1958d9' }}>
            {ligne.label}
          </Text>
        ) : null;
      }
      return col.render(ligne.evenement);
    },
  }));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ minWidth: 220, flex: 1 }}>
          <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>Recherche</div>
          <Input placeholder="Nom de l'événement…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </div>
        <div style={{ minWidth: 200 }}>
          <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>Quartier</div>
          <Select
            value={quartier}
            onChange={setQuartier}
            style={{ width: '100%' }}
            options={[{ value: 'ALL', label: 'Tous' }, ...options.quartiers.map((q) => ({ value: q.label, label: q.label }))]}
          />
        </div>
        <div style={{ minWidth: 200 }}>
          <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>Statut</div>
          <Select
            value={statut}
            onChange={setStatut}
            style={{ width: '100%' }}
            options={[
              { value: 'ALL', label: 'Tous' },
              { value: 'Validée', label: 'Validée' },
              ...options.statuts.map((s) => ({ value: s.label, label: s.label })),
            ]}
          />
        </div>
        <Button
          type={avecEvenementsPasses ? 'primary' : 'default'}
          onClick={() => setAvecEvenementsPasses((v) => !v)}
        >
          {avecEvenementsPasses ? 'Masquer les événements passés' : 'Afficher les événements passés'}
        </Button>
        <Switch
          checked={avecEvenementsArchives}
          onChange={setAvecEvenementsArchives}
          checkedChildren="Événements archivés visibles"
          unCheckedChildren="Événements archivés masqués"
        />
        <div style={{ marginLeft: 'auto' }}>
          <ImportExportEvenements onImported={charger} />
        </div>
      </div>

      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
        {total} événement(s)
      </Text>

      <Table
        rowKey="key"
        size="small"
        columns={columns}
        dataSource={lignes}
        loading={chargement}
        pagination={false}
        bordered
        locale={{ emptyText: 'Aucun événement' }}
      />
    </div>
  );
}
