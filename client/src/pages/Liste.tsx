import { useEffect, useState } from 'react';
import { Box, Button, Checkbox, Field, HStack, Input, NativeSelect, Table, Text } from '@chakra-ui/react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import type { Evenement } from '../types';
import { ValidationBadge } from '../components/ValidationBadge';
import { ImportExportEvenements } from '../components/ImportExportEvenements';
import { formatDate } from '../lib/formatDate';

export default function Liste() {
  const { estAdministrateur } = useAuth();
  const [evenements, setEvenements] = useState<Evenement[]>([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState('');
  const [quartier, setQuartier] = useState('ALL');
  const [statut, setStatut] = useState('ALL');
  const [options, setOptions] = useState<{ quartiers: { label: string }[]; statuts: { label: string }[] }>({
    quartiers: [],
    statuts: [],
  });

  const charger = async () => {
    setChargement(true);
    try {
      const params = new URLSearchParams();
      if (recherche) params.set('searchTerm', recherche);
      if (quartier !== 'ALL') params.set('quartier', quartier);
      if (statut !== 'ALL') params.set('statut', statut);
      const data = await api.get<{ items: Evenement[] }>(`/evenements?${params.toString()}`);
      setEvenements(data.items);
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    api
      .get<{ quartiers: { label: string }[]; natures: { label: string }[]; statuts: { label: string }[] }>(
        '/evenements/options-filtres'
      )
      .then(setOptions);
  }, []);

  useEffect(() => {
    const t = setTimeout(charger, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recherche, quartier, statut]);

  const toggleValidation = async (id: string, champ: 'validationTechnique' | 'validationPolitique', valeur: boolean) => {
    await api.post(`/evenements/${id}/validations`, { [champ]: valeur });
    charger();
  };

  const validerUnClic = async (id: string) => {
    await api.post(`/evenements/${id}/valider`, {});
    charger();
  };

  const total = evenements.length;

  return (
    <Box>
      <HStack align="end" gap="3" wrap="wrap" mb="4">
        <Field.Root minW="220px" flex="1">
          <Field.Label fontSize="xs" color="gray.500">
            Recherche
          </Field.Label>
          <Input placeholder="Nom de l'événement…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </Field.Root>
        <Field.Root maxW="220px">
          <Field.Label fontSize="xs" color="gray.500">
            Quartier
          </Field.Label>
          <NativeSelect.Root>
            <NativeSelect.Field value={quartier} onChange={(e) => setQuartier(e.target.value)}>
              <option value="ALL">Tous</option>
              {options.quartiers.map((q) => (
                <option key={q.label} value={q.label}>
                  {q.label}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Field.Root>
        <Field.Root maxW="220px">
          <Field.Label fontSize="xs" color="gray.500">
            Statut
          </Field.Label>
          <NativeSelect.Root>
            <NativeSelect.Field value={statut} onChange={(e) => setStatut(e.target.value)}>
              <option value="ALL">Tous</option>
              <option value="Validée">Validée</option>
              {options.statuts.map((s) => (
                <option key={s.label} value={s.label}>
                  {s.label}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Field.Root>
        <Box ml="auto">
          <ImportExportEvenements onImported={charger} />
        </Box>
      </HStack>

      <Text fontSize="sm" color="gray.500" mb="2">
        {total} événement(s)
      </Text>

      <Box overflowX="auto" borderWidth="1px" borderColor="gray.200" rounded="lg" bg="white">
        <Table.Root size="sm">
          <Table.Header bg="gray.100">
            <Table.Row>
              <Table.ColumnHeader fontSize="xs" textTransform="uppercase" color="gray.500">
                Nom
              </Table.ColumnHeader>
              <Table.ColumnHeader fontSize="xs" textTransform="uppercase" color="gray.500">
                Jour
              </Table.ColumnHeader>
              <Table.ColumnHeader fontSize="xs" textTransform="uppercase" color="gray.500">
                Début
              </Table.ColumnHeader>
              <Table.ColumnHeader fontSize="xs" textTransform="uppercase" color="gray.500">
                Fin
              </Table.ColumnHeader>
              <Table.ColumnHeader fontSize="xs" textTransform="uppercase" color="gray.500">
                Quartier
              </Table.ColumnHeader>
              <Table.ColumnHeader fontSize="xs" textTransform="uppercase" color="gray.500">
                Nature
              </Table.ColumnHeader>
              <Table.ColumnHeader fontSize="xs" textTransform="uppercase" color="gray.500">
                Statut
              </Table.ColumnHeader>
              <Table.ColumnHeader fontSize="xs" textTransform="uppercase" color="gray.500">
                Validation
              </Table.ColumnHeader>
              {estAdministrateur && (
                <Table.ColumnHeader fontSize="xs" textTransform="uppercase" color="gray.500">
                  Actions
                </Table.ColumnHeader>
              )}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {chargement && (
              <Table.Row>
                <Table.Cell colSpan={9} textAlign="center" color="gray.400" py="6">
                  Chargement…
                </Table.Cell>
              </Table.Row>
            )}
            {!chargement && evenements.length === 0 && (
              <Table.Row>
                <Table.Cell colSpan={9} textAlign="center" color="gray.400" py="6">
                  Aucun événement
                </Table.Cell>
              </Table.Row>
            )}
            {evenements.map((e) => (
              <Table.Row key={e._id}>
                <Table.Cell fontWeight="medium" color="gray.700">
                  {e.nom}
                </Table.Cell>
                <Table.Cell>{formatDate(e.dateClef)}</Table.Cell>
                <Table.Cell>{formatDate(e.dateDeDebut)}</Table.Cell>
                <Table.Cell>{formatDate(e.dateDeFin)}</Table.Cell>
                <Table.Cell>{e.quartier}</Table.Cell>
                <Table.Cell>{e.nature}</Table.Cell>
                <Table.Cell>{e.statut}</Table.Cell>
                <Table.Cell>
                  <ValidationBadge evenement={e} />
                </Table.Cell>
                {estAdministrateur && (
                  <Table.Cell>
                    <HStack gap="2">
                      <Checkbox.Root
                        size="sm"
                        checked={e.validationTechnique}
                        onCheckedChange={(d) => toggleValidation(e._id, 'validationTechnique', d.checked === true)}
                      >
                        <Checkbox.HiddenInput />
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        <Checkbox.Label fontSize="xs">Tech.</Checkbox.Label>
                      </Checkbox.Root>
                      <Checkbox.Root
                        size="sm"
                        checked={e.validationPolitique}
                        onCheckedChange={(d) => toggleValidation(e._id, 'validationPolitique', d.checked === true)}
                      >
                        <Checkbox.HiddenInput />
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        <Checkbox.Label fontSize="xs">Pol.</Checkbox.Label>
                      </Checkbox.Root>
                      <Button size="xs" variant="subtle" colorPalette="gray" onClick={() => validerUnClic(e._id)}>
                        Valider
                      </Button>
                    </HStack>
                  </Table.Cell>
                )}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Box>
    </Box>
  );
}
