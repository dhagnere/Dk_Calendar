import { useEffect, useMemo, useState } from 'react';
import { Modal, Typography } from 'antd';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { estValide, type Evenement } from '../types';
import { COULEUR_NON_VALIDE, COULEUR_VALIDE } from '../lib/validationColors';
import { formatTitreEvenement } from '../lib/formatTitre';
import { majusculeInitiale } from '../lib/formatDate';
import { FicheEvenement } from '../components/FicheEvenement';

const { Title, Text } = Typography;

/** Clé "AAAA-MM-JJ" (jour calendaire, sans l'heure) pour une date donnée. */
function cleJour(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Jour(s) occupé(s) par un événement : sa dateClef si présente (cas normal, une ligne par jour), sinon
 * chaque jour de la plage dateDeDebut→dateDeFin en repli (événement créé manuellement, sans dateClef).
 */
function joursDe(e: Evenement): string[] {
  if (e.dateClef) return [cleJour(new Date(e.dateClef))];
  if (!e.dateDeDebut) return [];
  const debut = new Date(e.dateDeDebut);
  const fin = e.dateDeFin ? new Date(e.dateDeFin) : debut;
  const jours: string[] = [];
  for (
    const d = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate());
    d <= fin;
    d.setDate(d.getDate() + 1)
  ) {
    jours.push(cleJour(d));
  }
  return jours;
}

/** Couleur de la pastille de sévérité selon le nombre d'événements non arbitrés du jour. */
function couleurConflit(nombre: number): string {
  if (nombre > 4) return '#a8071a'; // critique
  if (nombre > 2) return '#ad4e00'; // orange foncé
  return '#fa8c16'; // orange
}

interface JourConflit {
  cle: string;
  date: Date;
  evenements: Evenement[];
}

export default function Conflits() {
  const { estAdministrateur } = useAuth();
  const [evenements, setEvenements] = useState<Evenement[]>([]);
  const [chargement, setChargement] = useState(true);
  const [evenementOuvertId, setEvenementOuvertId] = useState<string | null>(null);

  const charger = async () => {
    setChargement(true);
    try {
      const data = await api.get<{ items: Evenement[] }>('/evenements');
      setEvenements(data.items);
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    charger();
  }, []);

  const toggleValidation = async (id: string, champ: 'validationTechnique' | 'validationPolitique', valeur: boolean) => {
    await api.post(`/evenements/${id}/validations`, { [champ]: valeur });
    charger();
  };

  const validerUnClic = async (id: string) => {
    await api.post(`/evenements/${id}/valider`, {});
    charger();
  };

  const joursEnConflit = useMemo<JourConflit[]>(() => {
    const aujourdhui = new Date();
    aujourdhui.setHours(0, 0, 0, 0);
    const cleAujourdhui = cleJour(aujourdhui);

    const parJour = new Map<string, Evenement[]>();
    for (const e of evenements) {
      if (e.statut === 'Brouillon') continue;
      for (const cle of joursDe(e)) {
        if (cle < cleAujourdhui) continue;
        const liste = parJour.get(cle);
        if (liste) liste.push(e);
        else parJour.set(cle, [e]);
      }
    }

    const resultat: JourConflit[] = [];
    for (const [cle, liste] of parJour) {
      const nonArbitres = liste.filter((e) => !estValide(e));
      if (nonArbitres.length > 1) {
        resultat.push({ cle, date: new Date(`${cle}T00:00:00`), evenements: nonArbitres });
      }
    }
    resultat.sort((a, b) => a.cle.localeCompare(b.cle));
    return resultat;
  }, [evenements]);

  const evenementOuvert = evenementOuvertId ? evenements.find((e) => e._id === evenementOuvertId) ?? null : null;

  return (
    <div>
      <Title level={3} style={{ marginTop: 0 }}>
        Conflits
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>
        Jours à venir où plusieurs événements ne sont pas encore arbitrés (validation technique et
        politique incomplètes) — {joursEnConflit.length} jour(s) concerné(s).
      </Text>

      {!chargement && joursEnConflit.length === 0 && (
        <Text type="secondary">Aucun conflit à venir : chaque jour compte au plus un événement non arbitré.</Text>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {joursEnConflit.map((jour) => (
          <div key={jour.cle} style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 16px',
                background: '#fafafa',
                borderBottom: '1px solid #f0f0f0',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 22,
                  height: 22,
                  padding: '0 6px',
                  borderRadius: 999,
                  background: couleurConflit(jour.evenements.length),
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {jour.evenements.length}
              </span>
              <Text strong style={{ fontSize: 15 }}>
                {majusculeInitiale(
                  jour.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                )}
              </Text>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {jour.evenements.map((e) => (
                <button
                  key={e._id}
                  onClick={() => setEvenementOuvertId(e._id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    border: 'none',
                    borderBottom: '1px solid #f5f5f5',
                    background: 'transparent',
                    padding: '10px 16px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      flexShrink: 0,
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: estValide(e) ? COULEUR_VALIDE : COULEUR_NON_VALIDE,
                    }}
                  />
                  <Text strong style={{ flex: 1, minWidth: 0 }}>
                    {formatTitreEvenement(e.nom)}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                    {[e.quartier, e.nature].filter(Boolean).join(' · ')}
                  </Text>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!evenementOuvert} onCancel={() => setEvenementOuvertId(null)} footer={null} width={720} title={null}>
        {evenementOuvert && (
          <FicheEvenement
            evenement={evenementOuvert}
            estAdministrateur={estAdministrateur}
            onToggleValidation={toggleValidation}
            onValider={validerUnClic}
          />
        )}
      </Modal>
    </div>
  );
}
