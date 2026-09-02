import { useRef, useState } from 'react';
import { Button, Space, Typography } from 'antd';
import { UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

/** Boutons d'export CSV (tout le monde) et d'import CSV (admin uniquement), avec message de résultat. */
export function ImportExportEvenements({ onImported }: { onImported: () => void }) {
  const { estAdministrateur } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <Space>
        <Button icon={<DownloadOutlined />} onClick={exporterCsv}>
          Exporter CSV
        </Button>
        {estAdministrateur && (
          <>
            <Button type="primary" icon={<UploadOutlined />} loading={enCours} onClick={() => inputRef.current?.click()}>
              Importer CSV
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              hidden
              onChange={(e) => e.target.files?.[0] && importerCsv(e.target.files[0])}
            />
          </>
        )}
      </Space>
      {message && (
        <Typography.Paragraph style={{ marginTop: 8, marginBottom: 0, background: '#e6f4ff', color: '#0958d9', padding: '6px 12px', borderRadius: 6 }}>
          {message}
        </Typography.Paragraph>
      )}
    </div>
  );
}
