import { useEffect, useState } from 'react';
import { Button, Checkbox, Input, Popconfirm, Select, Table, Typography, type TableColumnsType } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import type { Evenement } from '../types';
import { ValidationBadge } from '../components/ValidationBadge';
import { ImportExportEvenements } from '../components/ImportExportEvenements';
import { formatDate } from '../lib/formatDate';

const { Text } = Typography;

export default function Liste() {
  const { estAdministrateur } = useAuth();
  const [evenements, setEvenements] = useState<Evenement[]>([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState('');
  const [quartier, setQuartier] = useState('ALL');
  const [statut, setStatut] = useState('ALL');
  const [avecEvenementsPasses, setAvecEvenementsPasses] = useState(false);
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
  }, [recherche, quartier, statut, avecEvenementsPasses]);

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

  const total = evenements.length;

  const columns: TableColumnsType<Evenement> = [
    { title: 'Nom', dataIndex: 'nom', key: 'nom', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Jour', key: 'jour', render: (_, e) => formatDate(e.dateClef) },
    { title: 'Début', key: 'debut', render: (_, e) => formatDate(e.dateDeDebut) },
    { title: 'Fin', key: 'fin', render: (_, e) => formatDate(e.dateDeFin) },
    { title: 'Quartier', dataIndex: 'quartier', key: 'quartier' },
    { title: 'Nature', dataIndex: 'nature', key: 'nature' },
    { title: 'Statut', dataIndex: 'statut', key: 'statut' },
    { title: 'Validation', key: 'validation', render: (_, e) => <ValidationBadge evenement={e} /> },
    ...(estAdministrateur
      ? [
          {
            title: 'Actions',
            key: 'actions',
            render: (_: unknown, e: Evenement) => (
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
        <div style={{ marginLeft: 'auto' }}>
          <ImportExportEvenements onImported={charger} />
        </div>
      </div>

      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
        {total} événement(s)
      </Text>

      <Table
        rowKey="_id"
        size="small"
        columns={columns}
        dataSource={evenements}
        loading={chargement}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        bordered
        locale={{ emptyText: 'Aucun événement' }}
      />
    </div>
  );
}
