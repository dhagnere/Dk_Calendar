/**
 * Extrait une valeur de `req.query` en tant que chaîne simple, ou `undefined` si elle est absente OU
 * n'est pas une chaîne (ex. paramètre répété devenu tableau, ou syntaxe crochet type
 * `?champ[$ne]=x` que le parseur de requête d'Express transforme en objet). Sans ce filtre, une
 * valeur ainsi façonnée par le client pourrait être affectée telle quelle à un filtre MongoDB et
 * injecter un opérateur ($ne, $gt, $regex…) au lieu d'une simple comparaison d'égalité.
 */
export function queryString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
