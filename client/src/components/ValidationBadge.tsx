import { Badge } from '@chakra-ui/react';
import { estValide, type Evenement } from '../types';

export function ValidationBadge({ evenement }: { evenement: Evenement }) {
  return estValide(evenement) ? (
    <Badge colorPalette="green">Validée</Badge>
  ) : (
    <Badge colorPalette="red">Non validée</Badge>
  );
}
