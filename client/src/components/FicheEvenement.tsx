import { Box, Button, Card, Checkbox, HStack, SimpleGrid, Text } from '@chakra-ui/react';
import type { Evenement } from '../types';
import { formatDate } from '../lib/formatDate';
import { ValidationBadge } from './ValidationBadge';

interface Props {
  evenement: Evenement;
  estAdministrateur: boolean;
  onToggleValidation: (id: string, champ: 'validationTechnique' | 'validationPolitique', valeur: boolean) => void;
  onValider: (id: string) => void;
}

function Champ({ label, valeur }: { label: string; valeur: string }) {
  return (
    <Box>
      <Text fontSize="xs" fontWeight="medium" color="gray.400">
        {label}
      </Text>
      <Text fontSize="xs" color="gray.600">
        {valeur || '—'}
      </Text>
    </Box>
  );
}

/** Fiche détaillée d'un événement, utilisée dans la pop-up du jour sélectionné (vue Calendrier). */
export function FicheEvenement({ evenement, estAdministrateur, onToggleValidation, onValider }: Props) {
  return (
    <Card.Root variant="outline">
      <Card.Body>
        <HStack justify="space-between" align="start" mb="3">
          <Box>
            <Text fontWeight="semibold" color="gray.800">
              {evenement.nom}
            </Text>
            <Text fontSize="xs" color="gray.500">
              {[evenement.quartier, evenement.nature, evenement.niveau].filter(Boolean).join(' · ')}
            </Text>
          </Box>
          <ValidationBadge evenement={evenement} />
        </HStack>

        <SimpleGrid columns={2} gap="3">
          <Champ label="Lieu" valeur={evenement.lieu} />
          <Champ label="Statut" valeur={evenement.statut} />
          <Champ label="Pilote" valeur={evenement.pilote} />
          <Champ label="Direction pilote" valeur={evenement.directionPilote} />
          <Champ label="Organisateur" valeur={evenement.organisateur} />
          <Champ label="Type" valeur={evenement.type} />
          <Champ label="Période" valeur={`${formatDate(evenement.dateDeDebut)} → ${formatDate(evenement.dateDeFin)}`} />
          <Champ label="Tardive / Reprog." valeur={`${evenement.tardive || 'Non'} / ${evenement.reprog || 'Non'}`} />
        </SimpleGrid>

        {estAdministrateur && (
          <HStack mt="3" pt="2" borderTopWidth="1px" borderColor="gray.100" gap="4" wrap="wrap">
            <Checkbox.Root
              size="sm"
              checked={evenement.validationTechnique}
              onCheckedChange={(d) => onToggleValidation(evenement._id, 'validationTechnique', d.checked === true)}
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Label>Validation technique</Checkbox.Label>
            </Checkbox.Root>
            <Checkbox.Root
              size="sm"
              checked={evenement.validationPolitique}
              onCheckedChange={(d) => onToggleValidation(evenement._id, 'validationPolitique', d.checked === true)}
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Label>Validation politique</Checkbox.Label>
            </Checkbox.Root>
            <Button ml="auto" size="xs" variant="subtle" colorPalette="gray" onClick={() => onValider(evenement._id)}>
              Valider en un clic
            </Button>
          </HStack>
        )}
      </Card.Body>
    </Card.Root>
  );
}
