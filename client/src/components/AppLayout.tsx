import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Button, Divider, Image, Layout, Space, Tag, Typography } from 'antd';
import {
  CalendarOutlined,
  TeamOutlined,
  UnorderedListOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { LOGO_CUD, LOGO_DUNKERQUE } from '../logos';

const { Header, Content } = Layout;
const { Text } = Typography;

function NavItem({
  actif,
  icone,
  label,
  onClick,
}: {
  actif: boolean;
  icone: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        border: 'none',
        cursor: 'pointer',
        borderRadius: 999,
        padding: '8px 16px',
        fontSize: 14,
        fontWeight: 600,
        background: actif ? '#e6f4ff' : 'transparent',
        color: actif ? '#1958d9' : '#4b5563',
      }}
    >
      {icone}
      {label}
    </button>
  );
}

export function AppLayout() {
  const { session, loading, estAdministrateur, deconnexion } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: '#8c8c8c' }}>
        Chargement…
      </div>
    );
  }
  if (!session) return <Navigate to="/connexion" replace />;

  const items = [
    { key: '/', label: 'Calendrier', icone: <CalendarOutlined /> },
    { key: '/liste', label: 'Liste', icone: <UnorderedListOutlined /> },
    ...(estAdministrateur
      ? [
          { key: '/comptes', label: 'Comptes', icone: <TeamOutlined /> },
          { key: '/demandes', label: "Demandes d'accès", icone: <UserAddOutlined /> },
        ]
      : []),
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          rowGap: 8,
          height: 'auto',
          lineHeight: 'normal',
          padding: '10px 24px',
        }}
      >
        <Space size="large" align="center" wrap>
          <Space size="middle" align="center">
            <Image src={LOGO_DUNKERQUE} alt="Ville de Dunkerque" height={36} preview={false} />
            <Divider orientation="vertical" style={{ height: 32, margin: 0 }} />
            <Image src={LOGO_CUD} alt="Communauté urbaine de Dunkerque" height={36} preview={false} />
          </Space>
          <Text strong style={{ fontSize: 18, whiteSpace: 'nowrap' }}>
            Calendrier Événements
          </Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {items.map((item) => (
              <NavItem
                key={item.key}
                actif={location.pathname === item.key}
                icone={item.icone}
                label={item.label}
                onClick={() => navigate(item.key)}
              />
            ))}
          </div>
        </Space>
        <Space style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
          {!estAdministrateur && <Tag color="blue">Consultation seule</Tag>}
          <Text type="secondary">{session.nom}</Text>
          <Button onClick={() => deconnexion()}>Déconnexion</Button>
        </Space>
      </Header>
      <Content style={{ width: '100%', padding: '24px 32px' }}>
        <Outlet />
      </Content>
    </Layout>
  );
}
