import { useEffect, useState } from 'react';
import { Box, Button, Card, HStack, NativeSelect, Text } from '@chakra-ui/react';
import { api } from '../api';
import type { DemandeAcces } from '../types';
import { genererMotDePasse } from '../lib/generatePassword';

export default function Demandes() {
  const [demandes, setDemandes] = useState<DemandeAcces[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [roleParDemande, setRoleParDemande] = useState<Record<string, 'Administrateur' | 'Consultant'>>({});

  const charger = async () => {
    const data = await api.get<{ demandes: DemandeAcces[] }>('/demandes-acces');
    setDemandes(data.demandes);
  };

  useEffect(() => {
    charger();
  }, []);

  const roleDe = (id: string) => roleParDemande[id] ?? 'Consultant';

  const approuver = async (demande: DemandeAcces) => {
    const motDePasseTemporaire = genererMotDePasse();
    const res = await api.post<{ ok: boolean; message: string }>(`/demandes-acces/${demande._id}/approuver`, {
      role: roleDe(demande._id),
      motDePasseTemporaire,
    });
    if (res.ok) {
      setMessage(`Compte créé pour ${demande.email} (${roleDe(demande._id)}). Mot de passe temporaire : ${motDePasseTemporaire}`);
    } else {
      setMessage(res.message);
    }
    charger();
  };

  const rejeter = async (demande: DemandeAcces) => {
    await api.post(`/demandes-acces/${demande._id}/rejeter`, {});
    setMessage(`Demande de ${demande.email} rejetée`);
    charger();
  };

  return (
    <Box>
      <Card.Root>
        <Card.Header>
          <Card.Title>Demandes d'accès en attente</Card.Title>
        </Card.Header>
        <Card.Body>
          {message && (
            <Text mb="3" fontSize="sm" bg="blue.50" color="blue.800" px="3" py="2" rounded="md">
              {message}
            </Text>
          )}

          {demandes.length === 0 && (
            <Text fontSize="sm" color="gray.400">
              Aucune demande en attente.
            </Text>
          )}

          <Box display="flex" flexDirection="column" gap="3">
            {demandes.map((d) => (
              <Box key={d._id} borderWidth="1px" borderColor="gray.200" rounded="md" p="3">
                <HStack align="start" justify="space-between" wrap="wrap" gap="3">
                  <Box>
                    <Text fontWeight="medium" color="gray.700">
                      {d.nom} <Text as="span" fontWeight="normal" color="gray.400">— {d.email}</Text>
                    </Text>
                    {d.organisation && (
                      <Text fontSize="xs" color="gray.500">
                        Organisation : {d.organisation}
                      </Text>
                    )}
                    {d.motif && (
                      <Text mt="1" fontSize="sm" color="gray.600">
                        « {d.motif} »
                      </Text>
                    )}
                    <Text mt="1" fontSize="xs" color="gray.400">
                      Demandé le {new Date(d.createdAt).toLocaleDateString('fr-FR')}
                    </Text>
                  </Box>
                  <HStack gap="2">
                    <NativeSelect.Root w="40">
                      <NativeSelect.Field
                        value={roleDe(d._id)}
                        onChange={(e) =>
                          setRoleParDemande((r) => ({ ...r, [d._id]: e.target.value as 'Administrateur' | 'Consultant' }))
                        }
                      >
                        <option value="Consultant">Consultant</option>
                        <option value="Administrateur">Administrateur</option>
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                    <Button size="xs" colorPalette="blue" onClick={() => approuver(d)}>
                      Approuver
                    </Button>
                    <Button size="xs" colorPalette="red" onClick={() => rejeter(d)}>
                      Rejeter
                    </Button>
                  </HStack>
                </HStack>
              </Box>
            ))}
          </Box>
        </Card.Body>
      </Card.Root>
    </Box>
  );
}
