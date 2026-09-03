import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { Alert, Button, Select, Space, Typography } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import type { Evenement } from '../types';
import { estValide } from '../types';
import { COULEUR_NON_VALIDE, COULEUR_VALIDE } from '../lib/validationColors';
import { formatDate } from '../lib/formatDate';

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

/** Recentre la carte quand le lieu sélectionné change. */
function RecentrageCarte({ lieu }: { lieu: LieuGeolocalise | null }) {
  const map = useMap();
  useEffect(() => {
    if (lieu) map.flyTo([lieu.latitude, lieu.longitude], 16);
    else map.flyTo(CENTRE_DUNKERQUE, 12);
  }, [lieu, map]);
  return null;
}

export default function Carte() {
  const { estAdministrateur } = useAuth();
  const [evenements, setEvenements] = useState<Evenement[]>([]);
  const [chargement, setChargement] = useState(true);
  const [lieuSelectionne, setLieuSelectionne] = useState<string>('ALL');
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

  const lieux = useMemo(() => regrouperParLieu(evenements), [evenements]);
  const nonGeolocalises = evenements.filter((e) => e.statutGeocodage !== 'ok').length;

  const lieuActif = lieuSelectionne === 'ALL' ? null : (lieux.find((l) => l.lieu === lieuSelectionne) ?? null);
  const lieuxAffiches = lieuActif ? [lieuActif] : lieux;

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
        <div style={{ minWidth: 280 }}>
          <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>Lieu</div>
          <Select
            value={lieuSelectionne}
            onChange={setLieuSelectionne}
            style={{ width: '100%' }}
            showSearch
            optionFilterProp="label"
            options={[
              { value: 'ALL', label: `Tous les lieux (${lieux.length})` },
              ...lieux
                .slice()
                .sort((a, b) => a.lieu.localeCompare(b.lieu))
                .map((l) => ({ value: l.lieu, label: `${l.lieu} (${l.evenements.length})` })),
            ]}
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
          <RecentrageCarte lieu={lieuActif} />
          {lieuxAffiches.map((l) => (
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
