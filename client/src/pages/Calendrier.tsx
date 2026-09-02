import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Dialog, HStack, Heading, Portal, SimpleGrid, Text } from '@chakra-ui/react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { estValide, type Evenement } from '../types';
import { ImportExportEvenements } from '../components/ImportExportEvenements';
import { FicheEvenement } from '../components/FicheEvenement';

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const MAX_LIGNES_VISIBLES = 4;

function debutSemaine(date: Date): Date {
  const jour = (date.getDay() + 6) % 7; // 0 = lundi
  const d = new Date(date);
  d.setDate(d.getDate() - jour);
  d.setHours(0, 0, 0, 0);
  return d;
}

function memeJour(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function couleursChip(e: Evenement): { bg: string; color: string } {
  return estValide(e) ? { bg: 'green.100', color: 'green.800' } : { bg: 'red.100', color: 'red.800' };
}

export default function Calendrier() {
  const { estAdministrateur } = useAuth();
  const [mois, setMois] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [evenements, setEvenements] = useState<Evenement[]>([]);
  const [jourSelectionne, setJourSelectionne] = useState<Date | null>(null);
  const [stats, setStats] = useState<{ total: number; validated: number; pending: number } | null>(null);

  const charger = async () => {
    const data = await api.get<{ items: Evenement[] }>('/evenements');
    setEvenements(data.items);
    const s = await api.get<{ total: number; validated: number; pending: number }>('/evenements/stats');
    setStats(s);
  };

  useEffect(() => {
    charger();
  }, []);

  const jours = useMemo(() => {
    const premier = new Date(mois.getFullYear(), mois.getMonth(), 1);
    const debut = debutSemaine(premier);
    const cases: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(debut);
      d.setDate(d.getDate() + i);
      cases.push(d);
    }
    return cases;
  }, [mois]);

  const evenementsDuJour = (jour: Date) =>
    evenements.filter((e) => {
      // Cas normal : la ligne représente précisément ce jour (dateClef).
      if (e.dateClef) return memeJour(new Date(e.dateClef), jour);
      // Repli pour un événement sans dateClef (ex: créé manuellement) : chevauchement de plage.
      if (!e.dateDeDebut) return false;
      const debut = new Date(e.dateDeDebut);
      const fin = e.dateDeFin ? new Date(e.dateDeFin) : debut;
      const j = new Date(jour);
      j.setHours(12, 0, 0, 0);
      return j >= new Date(debut.getFullYear(), debut.getMonth(), debut.getDate()) &&
        j <= new Date(fin.getFullYear(), fin.getMonth(), fin.getDate());
    });

  const archiverPasses = async () => {
    await api.post('/evenements/archiver-passes');
    charger();
  };

  const validerUnClic = async (id: string) => {
    await api.post(`/evenements/${id}/valider`, {});
    charger();
  };

  const toggleValidation = async (id: string, champ: 'validationTechnique' | 'validationPolitique', valeur: boolean) => {
    await api.post(`/evenements/${id}/validations`, { [champ]: valeur });
    charger();
  };

  const evenementsJourOuvert = jourSelectionne ? evenementsDuJour(jourSelectionne) : [];

  return (
    <Box>
      <HStack justify="space-between" wrap="wrap" gap="3" mb="4">
        <HStack gap="2">
          <Button variant="subtle" colorPalette="gray" onClick={() => setMois(new Date(mois.getFullYear(), mois.getMonth() - 1, 1))}>
            ←
          </Button>
          <Heading size="md" w="48" textAlign="center" color="gray.700">
            {MOIS[mois.getMonth()]} {mois.getFullYear()}
          </Heading>
          <Button variant="subtle" colorPalette="gray" onClick={() => setMois(new Date(mois.getFullYear(), mois.getMonth() + 1, 1))}>
            →
          </Button>
        </HStack>
        <HStack gap="2" wrap="wrap">
          {estAdministrateur && (
            <Button variant="subtle" colorPalette="gray" onClick={archiverPasses}>
              Archiver les événements passés
            </Button>
          )}
          <ImportExportEvenements onImported={charger} />
        </HStack>
      </HStack>

      {stats && (
        <SimpleGrid columns={3} gap="3" mb="4">
          <Box borderWidth="1px" borderColor="gray.200" bg="white" rounded="lg" p="3" textAlign="center">
            <Text fontSize="2xl" fontWeight="bold" color="gray.800">
              {stats.total}
            </Text>
            <Text fontSize="xs" color="gray.500">
              Total affiché
            </Text>
          </Box>
          <Box borderWidth="1px" borderColor="gray.200" bg="white" rounded="lg" p="3" textAlign="center">
            <Text fontSize="2xl" fontWeight="bold" color="green.600">
              {stats.validated}
            </Text>
            <Text fontSize="xs" color="gray.500">
              Validés
            </Text>
          </Box>
          <Box borderWidth="1px" borderColor="gray.200" bg="white" rounded="lg" p="3" textAlign="center">
            <Text fontSize="2xl" fontWeight="bold" color="orange.600">
              {stats.pending}
            </Text>
            <Text fontSize="xs" color="gray.500">
              En attente
            </Text>
          </Box>
        </SimpleGrid>
      )}

      <HStack gap="4" mb="2" fontSize="xs" color="gray.500">
        <Text fontWeight="medium" color="gray.600">
          Légende :
        </Text>
        <HStack gap="1.5">
          <Box h="3" w="3" rounded="sm" bg="green.100" />
          Validée
        </HStack>
        <HStack gap="1.5">
          <Box h="3" w="3" rounded="sm" bg="red.100" />
          Non validée
        </HStack>
      </HStack>

      <SimpleGrid columns={7} gap="1px" bg="gray.200" borderWidth="1px" borderColor="gray.200" rounded="lg" overflow="hidden">
        {JOURS.map((j) => (
          <Box key={j} bg="gray.100" py="2" textAlign="center" fontSize="xs" fontWeight="semibold" color="gray.500">
            {j}
          </Box>
        ))}
        {jours.map((jour) => {
          const evts = evenementsDuJour(jour);
          const horsMois = jour.getMonth() !== mois.getMonth();
          const surplus = evts.length - MAX_LIGNES_VISIBLES;
          const estAujourdhui = memeJour(jour, new Date());
          return (
            <Box
              key={jour.toISOString()}
              as="button"
              onClick={() => setJourSelectionne(jour)}
              minH="132px"
              bg="white"
              p="1.5"
              textAlign="left"
              color={horsMois ? 'gray.300' : 'gray.700'}
              _hover={{ bg: 'gray.50' }}
            >
              <Text
                as="span"
                fontSize="xs"
                rounded="full"
                px={estAujourdhui ? '1.5' : undefined}
                py={estAujourdhui ? '0.5' : undefined}
                bg={estAujourdhui ? 'blue.600' : undefined}
                color={estAujourdhui ? 'white' : undefined}
              >
                {jour.getDate()}
              </Text>
              <Box mt="1" display="flex" flexDirection="column" gap="1">
                {evts.slice(0, MAX_LIGNES_VISIBLES).map((e) => {
                  const couleurs = couleursChip(e);
                  return (
                    <Box
                      key={e._id}
                      overflow="hidden"
                      whiteSpace="nowrap"
                      textOverflow="ellipsis"
                      rounded="sm"
                      px="1"
                      fontSize="10px"
                      lineHeight="1.2"
                      bg={couleurs.bg}
                      color={couleurs.color}
                      title={e.nom}
                    >
                      {e.nom}
                    </Box>
                  );
                })}
                {surplus > 0 && (
                  <Text fontSize="10px" fontWeight="semibold" color="gray.500">
                    +{surplus} événement{surplus > 1 ? 's' : ''}
                  </Text>
                )}
              </Box>
            </Box>
          );
        })}
      </SimpleGrid>

      <Dialog.Root open={!!jourSelectionne} onOpenChange={(d) => !d.open && setJourSelectionne(null)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content maxW="2xl" maxH="85vh" overflowY="auto">
              {jourSelectionne && (
                <>
                  <Dialog.Header>
                    <Dialog.Title textTransform="capitalize">
                      {jourSelectionne.toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </Dialog.Title>
                  </Dialog.Header>
                  <Dialog.CloseTrigger
                    position="absolute"
                    top="3"
                    right="3"
                    fontSize="xl"
                    color="gray.400"
                    _hover={{ color: 'gray.600' }}
                  >
                    ×
                  </Dialog.CloseTrigger>
                  <Dialog.Body>
                    <Box display="flex" flexDirection="column" gap="3">
                      {evenementsJourOuvert.length === 0 && (
                        <Text fontSize="sm" color="gray.400">
                          Aucun événement ce jour.
                        </Text>
                      )}
                      {evenementsJourOuvert.map((e) => (
                        <FicheEvenement
                          key={e._id}
                          evenement={e}
                          estAdministrateur={estAdministrateur}
                          onToggleValidation={toggleValidation}
                          onValider={validerUnClic}
                        />
                      ))}
                    </Box>
                  </Dialog.Body>
                </>
              )}
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Box>
  );
}
