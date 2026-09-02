import { Tag } from 'antd';
import { estValide, type Evenement } from '../types';

export function ValidationBadge({ evenement }: { evenement: Evenement }) {
  return estValide(evenement) ? <Tag color="green">Validée</Tag> : <Tag color="red">Non validée</Tag>;
}
