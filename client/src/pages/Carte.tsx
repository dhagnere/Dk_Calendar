import { EnvironmentOutlined } from '@ant-design/icons';
import { Card, Typography } from 'antd';

const { Title, Paragraph } = Typography;

/** Page à venir : carte des événements géolocalisés. Pour l'instant, un simple espace réservé. */
export default function Carte() {
  return (
    <Card style={{ textAlign: 'center', padding: '48px 24px' }}>
      <EnvironmentOutlined style={{ fontSize: 48, color: '#1d4ed8', marginBottom: 16 }} />
      <Title level={3} style={{ marginTop: 0 }}>
        Carte des événements
      </Title>
      <Paragraph type="secondary">
        Cette page est en préparation : elle affichera prochainement les événements géolocalisés sur une carte.
      </Paragraph>
    </Card>
  );
}
