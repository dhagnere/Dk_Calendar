import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { Alert, Button, Select, Slider, Space, Typography } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import type { Evenement } from '../types';
import { estValide } from '../types';
import { COULEUR_NON_VALIDE, COULEUR_VALIDE } from '../lib/validationColors';
import { formatDate } from '../lib/formatDate';
import { regrouperParEvenement } from '../lib/regrouperEvenements';

const { Text, Title } = Typography;

// Correctif standard react-leaflet/Vite : les icônes par défaut ne se chargent pas sans ceci,
// leur chemin étant résolu de façon incorrecte par les bundlers.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

/** Centre par défaut de la carte : Dunkerque. */
const CENTRE_DUNKERQUE: [number, number] = [51.0347, 2.3772];

interface LieuGeolocalise {
  lieu: string;
  latitude: number;
  longitude: number;
  evenements: Evenement[];
}

/** Regroupe les événements géocodés par lieu (adresse) exact : un marqueur par lieu distinct. */
function regrouperParLieu(evenements: Evenement[]): LieuGeolocalise[] {
  const parLieu = new Map<string, LieuGeolocalise>();
  for (const e of evenements) {
    if (e.statutGeocodage !== 'ok' || e.latitude === null || e.longitude === null) continue;
    const cle = e.lieu.trim();
    const existant = parLieu.get(cle);
    if (existant) {
      existant.evenements.push(e);
    } else {
      parLieu.set(cle, { lieu: cle, latitude: e.latitude, longitude: e.longitude, evenements: [e] });
    }
  }
  return [...parLieu.values()];
}

/** Recentre/cadre la carte selon le nombre de lieux affichés après filtrage. */
function RecentrageCarte({ lieux }: { lieux: LieuGeolocalise[] }) {
  const map = useMap();
  useEffect(() => {
    if (lieux.length === 0) {
      map.flyTo(CENTRE_DUNKERQUE, 12);
    } else if (lieux.length === 1) {
      map.flyTo([lieux[0].latitude, lieux[0].longitude], 16);
    } else {
      const limites = L.latLngBounds(lieux.map((l) => [l.latitude, l.longitude] as [number, number]));
      map.flyToBounds(limites, { padding: [40, 40], maxZoom: 15 });
    }
  }, [lieux, map]);
  return null;
}

type PasSlider = 'JOUR' | 'SEMAINE' | 'MOIS' | 'TRIMESTRE' | 'ANNEE' | 'TOUTES';

const ETAPES_SLIDER: { valeur: PasSlider; label: string; labelCourt: string }[] = [
  { valeur: 'JOUR', label: 'Jour', labelCourt: 'Jour' },
  { valeur: 'SEMAINE', label: 'Semaine', labelCourt: 'Semaine' },
  { valeur: 'MOIS', label: 'Mois', labelCourt: 'Mois' },
  { valeur: 'TRIMESTRE', label: 'Trimestre', labelCourt: 'Trimestre' },
  { valeur: 'ANNEE', label: 'Année', labelCourt: 'Année' },
  { valeur: 'TOUTES', label: 'Toutes les dates', labelCourt: 'Toutes' },
];

/** Borne de fin de la fenêtre d'affichage, `null` pour « Toutes les dates » (pas de filtrage). */
function finFenetre(pas: PasSlider, depuis: Date): Date | null {
  const fin = new Date(depuis);
  switch (pas) {
    case 'JOUR':
      fin.setDate(fin.getDate() + 1);
      return fin;
    case 'SEMAINE':
      fin.setDate(fin.getDate() + 7);
      return fin;
    case 'MOIS':
      fin.setMonth(fin.getMonth() + 1);
      return fin;
    case 'TRIMESTRE':
      fin.setMonth(fin.getMonth() + 3);
      return fin;
    case 'ANNEE':
      fin.setFullYear(fin.getFullYear() + 1);
      return fin;
    case 'TOUTES':
      return null;
  }
}

function dateReference(e: Evenement): Date | null {
  const brute = e.dateDeDebut ?? e.dateClef ?? e.dateDeFin;
  return brute ? new Date(brute) : null;
}

/** Ne garde que les événements dont la date se situe entre aujourd'hui et la fin de la fenêtre choisie. */
function filtrerParFenetre(evenements: Evenement[], pas: PasSlider): Evenement[] {
  if (pas === 'TOUTES') return evenements;
  const debut = new Date();
  debut.setHours(0, 0, 0, 0);
  const fin = finFenetre(pas, debut)!;
  return evenements.filter((e) => {
    const d = dateReference(e);
    return d !== null && d >= debut && d < fin;
  });
}

export default function Carte() {
  const { estAdministrateur } = useAuth();
  const [evenements, setEvenements] = useState<Evenement[]>([]);
  const [chargement, setChargement] = useState(true);
  const [quartier, setQuartier] = useState('ALL');
  const [quartiers, setQuartiers] = useState<{ label: string }[]>([]);
  const [pasIndex, setPasIndex] = useState(5); // 5 = « Toutes les dates » par défaut
  const [geocodageEnCours, setGeocodageEnCours] = useState(false);
  const [messageGeocodage, setMessageGeocodage] = useState<string | null>(null);

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

  useEffect(() => {
    api.get<{ quartiers: { label: string }[] }>('/evenements/options-filtres').then((res) => setQuartiers(res.quartiers));
  }, []);

  const pasSlider = ETAPES_SLIDER[pasIndex].valeur;

  // Les brouillons ne doivent jamais apparaître sur la carte, et un événement sur plusieurs jours ne
  // doit produire qu'une seule fiche (pas une par jour occupé).
  const evenementsUtiles = useMemo(
    () => regrouperParEvenement(evenements.filter((e) => e.statut !== 'Brouillon')),
    [evenements]
  );

  const evenementsFiltres = useMemo(() => {
    let liste = evenementsUtiles;
    if (quartier !== 'ALL') liste = liste.filter((e) => e.quartier === quartier);
    liste = filtrerParFenetre(liste, pasSlider);
    return liste;
  }, [evenementsUtiles, quartier, pasSlider]);

  const lieux = useMemo(() => regrouperParLieu(evenementsFiltres), [evenementsFiltres]);
  const nonGeolocalises = evenements.filter((e) => e.statutGeocodage !== 'ok').length;

  const lancerGeocodage = async () => {
    setGeocodageEnCours(true);
    setMessageGeocodage(null);
    try {
      let restants = 1;
      let totalGeocodes = 0;
      let totalEchecs = 0;
      while (restants > 0) {
        const res = await api.post<{ ok: boolean; geocodes: number; echecs: number; restants: number }>(
          '/evenements/geocoder',
          {}
        );
        totalGeocodes += res.geocodes;
        totalEchecs += res.echecs;
        restants = res.restants;
        setMessageGeocodage(`${totalGeocodes} adresse(s) géocodée(s), ${totalEchecs} échec(s), ${restants} restant(s)…`);
        if (res.geocodes === 0 && res.echecs === 0) break; // sécurité anti-boucle infinie
      }
      setMessageGeocodage(`Terminé : ${totalGeocodes} adresse(s) géocodée(s), ${totalEchecs} échec(s).`);
      await charger();
    } catch (err) {
      setMessageGeocodage(err instanceof Error ? `Échec du géocodage : ${err.message}` : 'Échec du géocodage.');
    } finally {
      setGeocodageEnCours(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ minWidth: 220 }}>
          <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>Quartier</div>
          <Select
            value={quartier}
            onChange={setQuartier}
            style={{ width: '100%' }}
            options={[{ value: 'ALL', label: 'Tous les quartiers' }, ...quartiers.map((q) => ({ value: q.label, label: q.label }))]}
          />
        </div>
        <div style={{ minWidth: 320, flex: 1, paddingRight: 40 }}>
          <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>Période affichée</div>
          <Slider
            min={0}
            max={ETAPES_SLIDER.length - 1}
            step={1}
            value={pasIndex}
            onChange={setPasIndex}
            marks={Object.fromEntries(ETAPES_SLIDER.map((e, i) => [i, e.labelCourt]))}
            tooltip={{ formatter: (i) => (i !== undefined ? ETAPES_SLIDER[i].label : '') }}
          />
        </div>
        {estAdministrateur && (
          <Space direction="vertical" size={4}>
            <Button icon={<EnvironmentOutlined />} loading={geocodageEnCours} onClick={lancerGeocodage}>
              Géocoder les événements
            </Button>
            {nonGeolocalises > 0 && !geocodageEnCours && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {nonGeolocalises} événement(s) non géolocalisé(s)
              </Text>
            )}
          </Space>
        )}
      </div>

      {messageGeocodage && (
        <Alert type="info" showIcon message={messageGeocodage} style={{ marginBottom: 16 }} />
      )}

      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
        {lieux.length} lieu(x) géolocalisé(s) — {lieux.reduce((n, l) => n + l.evenements.length, 0)} événement(s) affiché(s) sur la
        carte
        {nonGeolocalises > 0 && !estAdministrateur && ` (${nonGeolocalises} événement(s) non géolocalisé(s) non affiché(s))`}
      </Text>

      <div style={{ border: '1px solid #d9d9d9', borderRadius: 8, overflow: 'hidden' }}>
        <MapContainer center={CENTRE_DUNKERQUE} zoom={12} style={{ height: 600, width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <RecentrageCarte lieux={lieux} />
          {lieux.map((l) => (
            <Marker key={l.lieu} position={[l.latitude, l.longitude]}>
              <Popup>
                <div style={{ maxWidth: 260 }}>
                  <Title level={5} style={{ marginTop: 0, marginBottom: 4 }}>
                    {l.lieu}
                  </Title>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {l.evenements.map((e) => (
                      <div key={e._id} style={{ fontSize: 12 }}>
                        <span
                          style={{
                            display: 'inline-block',
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            marginRight: 6,
                            background: estValide(e) ? COULEUR_VALIDE : COULEUR_NON_VALIDE,
                          }}
                        />
                        <strong>{e.nom}</strong> — {formatDate(e.dateDeDebut)}
                      </div>
                    ))}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {!chargement && lieux.length === 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 16 }}
          message="Aucun événement géolocalisé pour le moment."
          description={
            estAdministrateur
              ? 'Cliquez sur « Géocoder les événements » ci-dessus pour localiser les événements à partir de leur lieu.'
              : "Revenez plus tard, une fois que les lieux des événements auront été géolocalisés."
          }
        />
      )}
    </div>
  );
}
