import { Badge } from './ui/Badge';
import { estValide, type Evenement } from '../types';

export function ValidationBadge({ evenement }: { evenement: Evenement }) {
  return estValide(evenement) ? (
    <Badge tone="green">Validée</Badge>
  ) : (
    <Badge tone="red">Non validée</Badge>
  );
}
