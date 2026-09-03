import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Button, Card, Col, DatePicker, Modal, Row, Select, Typography } from 'antd';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { estValide, type Evenement } from '../types';
import { COULEUR_NON_VALIDE, COULEUR_VALIDE } from '../lib/validationColors';
import { ImportExportEvenements } from '../components/ImportExportEvenements';
import { FicheEvenement } from '../components/FicheEvenement';

const { Title, Text } = Typography;

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const MAX_LIGNES_VISIBLES = 4;
const COULEUR_BORDURE = '#bfbfbf';

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

function couleurValidation(e: Evenement): string {
  return estValide(e) ? COULEUR_VALIDE : COULEUR_NON_VALIDE;
}

function majusculeInitiale(texte: string): string {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/** Petite pastille de couleur placée devant le texte pour indiquer la validation. */
function Pastille({ couleur }: { couleur: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        flexShrink: 0,
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: couleur,
      }}
    />
  );
}

/** Groupe de contrôles encadré (boîte), utilisé pour la navigation et les actions. */
function Boite({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        border: `1px solid ${COULEUR_BORDURE}`,
        borderRadius: 8,
        padding: '8px 12px',
        background: '#fff',
      }}
    >
      {children}
    </div>
  );
}

type OptionsFiltres = {
  quartiers: { label: string }[];
  statuts: { label: string }[];
  types: { label: string }[];
};

/** Menu déroulant de filtre avec une petite étiquette au-dessus, utilisé dans la barre du calendrier. */
function FiltreSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div style={{ minWidth: 170 }}>
      <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>{label}</div>
      <Select value={value} onChange={onChange} style={{ width: '100%' }} options={options} />
    </div>
  );
}

export default function Calendrier() {
  const { estAdministrateur } = useAuth();
  const [mois, setMois] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [evenements, setEvenements] = useState<Evenement[]>([]);
  const [jourSelectionne, setJourSelectionne] = useState<Date | null>(null);
  const [stats, setStats] = useState<{
    total: number;
    validated: number;
    pending: number;
    anneeActuelle: number;
    anneeEnCours: number;
    depuis2020: number;
  } | null>(null);
  const [quartier, setQuartier] = useState('ALL');
  const [statut, setStatut] = useState('ALL');
  const [type, setType] = useState('ALL');
  const [options, setOptions] = useState<OptionsFiltres>({ quartiers: [], statuts: [], types: [] });

  const charger = async () => {
    const params = new URLSearchParams();
    if (quartier !== 'ALL') params.set('quartier', quartier);
    if (statut !== 'ALL') params.set('statut', statut);
    if (type !== 'ALL') params.set('type', type);
    const data = await api.get<{ items: Evenement[] }>(`/evenements?${params.toString()}`);
    setEvenements(data.items);
    const s = await api.get<{
      total: number;
      validated: number;
      pending: number;
      anneeActuelle: number;
      anneeEnCours: number;
      depuis2020: number;
    }>('/evenements/stats');
    setStats(s);
  };

  useEffect(() => {
    api.get<OptionsFiltres>('/evenements/options-filtres').then(setOptions);
  }, []);

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quartier, statut, type]);

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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <Boite>
          <Button onClick={() => setMois(new Date(mois.getFullYear(), mois.getMonth() - 1, 1))}>←</Button>
          <Title level={4} style={{ width: 170, textAlign: 'center', margin: 0 }}>
            {MOIS[mois.getMonth()]} {mois.getFullYear()}
          </Title>
          <Button onClick={() => setMois(new Date(mois.getFullYear(), mois.getMonth() + 1, 1))}>→</Button>
          <DatePicker
            picker="month"
            value={dayjs(mois)}
            onChange={(date) => date && setMois(date.toDate())}
            allowClear={false}
            format="MMMM YYYY"
          />
        </Boite>
        <Boite>
          {estAdministrateur && <Button onClick={archiverPasses}>Archiver les événements passés</Button>}
          <ImportExportEvenements onImported={charger} />
        </Boite>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Boite>
          <FiltreSelect
            label="Type"
            value={type}
            onChange={setType}
            options={[{ value: 'ALL', label: 'Tous' }, ...options.types.map((t) => ({ value: t.label, label: t.label }))]}
          />
          <FiltreSelect
            label="Quartier"
            value={quartier}
            onChange={setQuartier}
            options={[{ value: 'ALL', label: 'Tous' }, ...options.quartiers.map((q) => ({ value: q.label, label: q.label }))]}
          />
          <FiltreSelect
            label="Statut"
            value={statut}
            onChange={setStatut}
            options={[
              { value: 'ALL', label: 'Tous' },
              { value: 'Validée', label: 'Validée' },
              ...options.statuts.map((s) => ({ value: s.label, label: s.label })),
            ]}
          />
        </Boite>
      </div>

      {stats && (
        <Row gutter={12} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Card size="small" style={{ textAlign: 'center', borderColor: COULEUR_BORDURE }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.total}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Total affiché
              </Text>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ textAlign: 'center', borderColor: COULEUR_BORDURE }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: COULEUR_VALIDE }}>{stats.validated}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Validés
              </Text>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ textAlign: 'center', borderColor: COULEUR_BORDURE }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#d46b08' }}>{stats.pending}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                En attente
              </Text>
            </Card>
          </Col>
        </Row>
      )}

      {stats && (
        <Row gutter={12} style={{ marginBottom: 16 }}>
          <Col span={12}>
            <Card size="small" style={{ textAlign: 'center', borderColor: COULEUR_BORDURE }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.anneeEnCours}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Manifestations en {stats.anneeActuelle}
              </Text>
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small" style={{ textAlign: 'center', borderColor: COULEUR_BORDURE }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.depuis2020}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Total des événements depuis 2020
              </Text>
            </Card>
          </Col>
        </Row>
      )}

      <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 12, color: '#595959', alignItems: 'center' }}>
        <Text strong style={{ fontSize: 12 }}>
          Légende :
        </Text>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Pastille couleur={COULEUR_VALIDE} />
          Validée
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Pastille couleur={COULEUR_NON_VALIDE} />
          Non validée
        </span>
      </div>

      <div style={{ border: `2px solid ${COULEUR_BORDURE}`, borderRadius: 8, overflow: 'hidden', width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#fafafa' }}>
          {JOURS.map((j) => (
            <div
              key={j}
              style={{
                textAlign: 'center',
                padding: '10px 0',
                fontSize: 13,
                fontWeight: 600,
                color: '#262626',
                borderBottom: `2px solid ${COULEUR_BORDURE}`,
              }}
            >
              {j}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {jours.map((jour, idx) => {
            const evts = evenementsDuJour(jour);
            const horsMois = jour.getMonth() !== mois.getMonth();
            const surplus = evts.length - MAX_LIGNES_VISIBLES;
            const estAujourdhui = memeJour(jour, new Date());
            return (
              <button
                key={jour.toISOString()}
                onClick={() => setJourSelectionne(jour)}
                style={{
                  minHeight: 140,
                  minWidth: 0,
                  width: '100%',
                  overflow: 'hidden',
                  background: horsMois ? '#fafafa' : '#fff',
                  border: 'none',
                  borderRight: idx % 7 !== 6 ? `1px solid ${COULEUR_BORDURE}` : 'none',
                  borderBottom: `1px solid ${COULEUR_BORDURE}`,
                  textAlign: 'left',
                  padding: 8,
                  cursor: 'pointer',
                  color: horsMois ? '#bfbfbf' : '#141414',
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: estAujourdhui ? 700 : 500,
                    borderRadius: 999,
                    padding: estAujourdhui ? '2px 8px' : undefined,
                    background: estAujourdhui ? '#1d4ed8' : undefined,
                    color: estAujourdhui ? '#fff' : undefined,
                  }}
                >
                  {jour.getDate()}
                </span>
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                  {evts.slice(0, MAX_LIGNES_VISIBLES).map((e) => (
                    <div
                      key={e._id}
                      title={e.nom}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden', minWidth: 0 }}
                    >
                      <Pastille couleur={couleurValidation(e)} />
                      <span
                        style={{
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          fontSize: 11,
                          lineHeight: 1.4,
                          color: '#262626',
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        {e.nom}
                      </span>
                    </div>
                  ))}
                  {surplus > 0 && (
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#595959' }}>
                      +{surplus} événement{surplus > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Modal
        open={!!jourSelectionne}
        onCancel={() => setJourSelectionne(null)}
        footer={null}
        width={720}
        title={
          jourSelectionne
            ? majusculeInitiale(
                jourSelectionne.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
              )
            : ''
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '65vh', overflowY: 'auto' }}>
          {evenementsJourOuvert.length === 0 && <Text type="secondary">Aucun événement ce jour.</Text>}
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
      </Modal>
    </div>
  );
}
