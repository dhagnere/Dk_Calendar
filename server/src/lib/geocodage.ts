/**
 * Géocodage d'adresses via Nominatim (OpenStreetMap), un service gratuit sans clé API.
 * Sa politique d'usage impose au maximum 1 requête par seconde et un User-Agent identifiant
 * l'application : https://operations.osmfoundation.org/policies/nominatim/
 */
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'CalendrierEvenementsDunkerque/1.0 (usage interne, non commercial)';
const DELAI_ENTRE_REQUETES_MS = 1100;

export interface Coordonnees {
  latitude: number;
  longitude: number;
}

function attendre(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Géocode une adresse. Renvoie les coordonnées, ou `null` si aucun résultat n'a été trouvé (adresse
 * imprécise ou trop libre, ex: simple nom de salle sans code postal). N'ajoute pas la commune par
 * défaut : les adresses de cette application incluent déjà la ville quand elle est connue.
 */
export async function geocoderAdresse(adresse: string): Promise<Coordonnees | null> {
  const requete = adresse.trim();
  if (!requete) return null;

  const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(requete)}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });

  if (!res.ok) {
    throw new Error(`Nominatim a répondu ${res.status}`);
  }

  const resultats = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (resultats.length === 0) return null;

  const { lat, lon } = resultats[0];
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;

  return { latitude, longitude };
}

/**
 * Géocode une liste d'adresses en respectant la limite de Nominatim (1 req/s) : les appels sont
 * séquentiels avec un délai entre chacun, jamais en parallèle.
 */
export async function geocoderPlusieursAdresses(
  adresses: string[]
): Promise<Map<string, Coordonnees | null>> {
  const resultats = new Map<string, Coordonnees | null>();
  for (const adresse of adresses) {
    try {
      resultats.set(adresse, await geocoderAdresse(adresse));
    } catch (err) {
      console.error(`[geocodage] Échec pour "${adresse}" :`, err);
      resultats.set(adresse, null);
    }
    await attendre(DELAI_ENTRE_REQUETES_MS);
  }
  return resultats;
}
