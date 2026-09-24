/** Vrai si `err` est une erreur MongoDB de clé unique dupliquée (ex. email déjà pris). */
export function estErreurCleDupliquee(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: unknown }).code === 11000;
}
