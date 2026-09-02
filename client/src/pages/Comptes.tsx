import { useEffect, useState } from 'react';
import { Badge, Box, Button, Card, Field, HStack, Input, NativeSelect, Table, Text } from '@chakra-ui/react';
import { api } from '../api';
import type { Compte } from '../types';
import { genererMotDePasse } from '../lib/generatePassword';
import { formatDate } from '../lib/formatDate';

export default function Comptes() {
  const [comptes, setComptes] = useState<Compte[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'Administrateur' | 'Consultant'>('Consultant');
  const [envoi, setEnvoi] = useState(false);

  const charger = async () => {
    const data = await api.get<{ comptes: Compte[] }>('/comptes');
    setComptes(data.comptes);
  };

  useEffect(() => {
    charger();
  }, []);

  const creerCompte = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setMessage(null);
    try {
      const motDePasseTemporaire = genererMotDePasse();
      const res = await api.post<{ ok: boolean; message: string }>('/comptes', {
        nom,
        email,
        role,
        motDePasseTemporaire,
      });
      if (res.ok) {
        setMessage(`Compte créé pour ${email}. Mot de passe temporaire : ${motDePasseTemporaire}`);
        setNom('');
        setEmail('');
        setRole('Consultant');
        charger();
      } else {
        setMessage(res.message);
      }
    } finally {
      setEnvoi(false);
    }
  };

  const toggleStatut = async (compte: Compte) => {
    const nouveauStatut = compte.statut === 'Suspendu' ? 'Actif' : 'Suspendu';
    await api.post(`/comptes/${compte._id}/statut`, { statut: nouveauStatut });
    charger();
  };

  const reinitialiser = async (compte: Compte) => {
    const motDePasseTemporaire = genererMotDePasse();
    await api.post(`/comptes/${compte._id}/reinitialiser-mot-de-passe`, {
      nouveauMotDePasseTemporaire: motDePasseTemporaire,
    });
    setMessage(`Mot de passe réinitialisé pour ${compte.email} : ${motDePasseTemporaire}`);
    charger();
  };

  const badgeColor = (statut: string) => (statut === 'Suspendu' ? 'red' : statut === 'Actif' ? 'green' : 'orange');

  return (
    <Box display="flex" flexDirection="column" gap="6">
      <Card.Root>
        <Card.Header>
          <Card.Title>Créer un compte</Card.Title>
        </Card.Header>
        <Card.Body>
          {message && (
            <Text mb="3" fontSize="sm" bg="blue.50" color="blue.800" px="3" py="2" rounded="md">
              {message}
            </Text>
          )}
          <HStack as="form" align="end" gap="3" wrap="wrap" onSubmit={creerCompte}>
            <Field.Root minW="180px" flex="1">
              <Field.Label fontSize="xs" color="gray.500">
                Nom
              </Field.Label>
              <Input value={nom} onChange={(e) => setNom(e.target.value)} required />
            </Field.Root>
            <Field.Root minW="220px" flex="1">
              <Field.Label fontSize="xs" color="gray.500">
                Email
              </Field.Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field.Root>
            <Field.Root maxW="200px">
              <Field.Label fontSize="xs" color="gray.500">
                Rôle
              </Field.Label>
              <NativeSelect.Root>
                <NativeSelect.Field value={role} onChange={(e) => setRole(e.target.value as 'Administrateur' | 'Consultant')}>
                  <option value="Consultant">Consultant</option>
                  <option value="Administrateur">Administrateur</option>
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>
            <Button type="submit" colorPalette="blue" loading={envoi}>
              Créer
            </Button>
          </HStack>
        </Card.Body>
      </Card.Root>

      <Box overflowX="auto" borderWidth="1px" borderColor="gray.200" rounded="lg" bg="white">
        <Table.Root size="sm">
          <Table.Header bg="gray.100">
            <Table.Row>
              <Table.ColumnHeader fontSize="xs" textTransform="uppercase" color="gray.500">
                Nom
              </Table.ColumnHeader>
              <Table.ColumnHeader fontSize="xs" textTransform="uppercase" color="gray.500">
                Email
              </Table.ColumnHeader>
              <Table.ColumnHeader fontSize="xs" textTransform="uppercase" color="gray.500">
                Rôle
              </Table.ColumnHeader>
              <Table.ColumnHeader fontSize="xs" textTransform="uppercase" color="gray.500">
                Statut
              </Table.ColumnHeader>
              <Table.ColumnHeader fontSize="xs" textTransform="uppercase" color="gray.500">
                Dernière connexion
              </Table.ColumnHeader>
              <Table.ColumnHeader fontSize="xs" textTransform="uppercase" color="gray.500">
                Actions
              </Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {comptes.map((c) => (
              <Table.Row key={c._id}>
                <Table.Cell fontWeight="medium" color="gray.700">
                  {c.nom}
                </Table.Cell>
                <Table.Cell>{c.email}</Table.Cell>
                <Table.Cell>{c.role}</Table.Cell>
                <Table.Cell>
                  <Badge colorPalette={badgeColor(c.statut)}>{c.statut}</Badge>
                </Table.Cell>
                <Table.Cell>{formatDate(c.derniereConnexion)}</Table.Cell>
                <Table.Cell>
                  <HStack gap="2">
                    <Button size="xs" variant="subtle" colorPalette="gray" onClick={() => toggleStatut(c)}>
                      {c.statut === 'Suspendu' ? 'Activer' : 'Suspendre'}
                    </Button>
                    <Button size="xs" variant="subtle" colorPalette="gray" onClick={() => reinitialiser(c)}>
                      Réinitialiser mot de passe
                    </Button>
                  </HStack>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Box>
    </Box>
  );
}
