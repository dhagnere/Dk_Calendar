import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/Button';

/** Boutons d'export CSV (tout le monde) et d'import CSV (admin uniquement), avec message de résultat. */
export function ImportExportEvenements({ onImported }: { onImported: () => void }) {
  const { estAdministrateur } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const exporterCsv = () => {
    window.open('/api/import/evenements/export', '_blank');
  };

  const importerCsv = async (fichier: File) => {
    setEnCours(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append('fichier', fichier);
      const res = await api.postForm<{ ok: boolean; created: number; updated: number; errors: string[] }>(
        '/import/evenements',
        form
      );
      setMessage(`${res.created} créé(s), ${res.updated} mis à jour, ${res.errors.length} ligne(s) ignorée(s)`);
      onImported();
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={exporterCsv}>
          Exporter CSV
        </Button>
        {estAdministrateur && (
          <label className={`cursor-pointer ${enCours ? 'pointer-events-none opacity-50' : ''}`}>
            <span className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-blue-700">
              {enCours ? 'Import en cours…' : 'Importer CSV'}
            </span>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              disabled={enCours}
              onChange={(e) => e.target.files && importerCsv(e.target.files[0])}
            />
          </label>
        )}
      </div>
      {message && <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">{message}</p>}
    </div>
  );
}
