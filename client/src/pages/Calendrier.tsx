import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Modal, Row, Typography } from 'antd';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { estValide, type Evenement } from '../types';
import { ImportExportEvenements } from '../components/ImportExportEvenements';
import { FicheEvenement } from '../components/FicheEvenement';

const { Title, Text } = Typography;

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

function couleursChip(e: Evenement): { bg: string; color: string } {
  return estValide(e) ? { bg: '#f6ffed', color: '#389e0d' } : { bg: '#fff1f0', color: '#cf1322' };
}

function majusculeInitiale(texte: string): string {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button onClick={() => setMois(new Date(mois.getFullYear(), mois.getMonth() - 1, 1))}>←</Button>
          <Title level={4} style={{ width: 180, textAlign: 'center', margin: 0 }}>
            {MOIS[mois.getMonth()]} {mois.getFullYear()}
          </Title>
          <Button onClick={() => setMois(new Date(mois.getFullYear(), mois.getMonth() + 1, 1))}>→</Button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {estAdministrateur && <Button onClick={archiverPasses}>Archiver les événements passés</Button>}
          <ImportExportEvenements onImported={charger} />
        </div>
      </div>

      {stats && (
        <Row gutter={12} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.total}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Total affiché
              </Text>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#389e0d' }}>{stats.validated}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Validés
              </Text>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#d46b08' }}>{stats.pending}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                En attente
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
          <span style={{ width: 12, height: 12, borderRadius: 3, background: '#f6ffed', border: '1px solid #b7eb8f' }} />
          Validée
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: '#fff1f0', border: '1px solid #ffa39e' }} />
          Non validée
        </span>
      </div>

      <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#fafafa' }}>
          {JOURS.map((j) => (
            <div
              key={j}
              style={{ textAlign: 'center', padding: '8px 0', fontSize: 12, fontWeight: 600, color: '#595959', borderBottom: '1px solid #f0f0f0' }}
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
                  minHeight: 132,
                  background: '#fff',
                  border: 'none',
                  borderRight: idx % 7 !== 6 ? '1px solid #f0f0f0' : 'none',
                  borderBottom: '1px solid #f0f0f0',
                  textAlign: 'left',
                  padding: 6,
                  cursor: 'pointer',
                  color: horsMois ? '#bfbfbf' : '#141414',
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    borderRadius: 999,
                    padding: estAujourdhui ? '2px 7px' : undefined,
                    background: estAujourdhui ? '#1d4ed8' : undefined,
                    color: estAujourdhui ? '#fff' : undefined,
                  }}
                >
                  {jour.getDate()}
                </span>
                <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {evts.slice(0, MAX_LIGNES_VISIBLES).map((e) => {
                    const couleurs = couleursChip(e);
                    return (
                      <div
                        key={e._id}
                        title={e.nom}
                        style={{
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          borderRadius: 4,
                          padding: '0 4px',
                          fontSize: 10,
                          lineHeight: 1.4,
                          background: couleurs.bg,
                          color: couleurs.color,
                        }}
                      >
                        {e.nom}
                      </div>
                    );
                  })}
                  {surplus > 0 && (
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#595959' }}>
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
