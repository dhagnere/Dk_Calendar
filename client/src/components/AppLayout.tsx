import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Button, Divider, Image, Layout, Menu, Space, Tag, Typography } from 'antd';
import { useAuth } from '../context/AuthContext';
import { LOGO_CUD, LOGO_DUNKERQUE } from '../logos';

const { Header, Content } = Layout;
const { Text } = Typography;

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
    { key: '/', label: 'Calendrier' },
    { key: '/liste', label: 'Liste' },
    ...(estAdministrateur
      ? [
          { key: '/comptes', label: 'Comptes' },
          { key: '/demandes', label: "Demandes d'accès" },
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
          height: 'auto',
          lineHeight: 'normal',
          padding: '10px 24px',
        }}
      >
        <Space size="large" align="center">
          <Space size="middle" align="center">
            <Image src={LOGO_DUNKERQUE} alt="Ville de Dunkerque" height={36} preview={false} />
            <Divider orientation="vertical" style={{ height: 32, margin: 0 }} />
            <Image src={LOGO_CUD} alt="Communauté urbaine de Dunkerque" height={36} preview={false} />
          </Space>
          <Text strong style={{ fontSize: 18 }}>
            Calendrier Événements
          </Text>
          <Menu
            mode="horizontal"
            selectedKeys={[location.pathname]}
            items={items}
            onClick={(e) => navigate(e.key)}
            style={{ borderBottom: 'none', minWidth: 340 }}
          />
        </Space>
        <Space>
          {!estAdministrateur && <Tag color="blue">Consultation seule</Tag>}
          <Text type="secondary">{session.nom}</Text>
          <Button onClick={() => deconnexion()}>Déconnexion</Button>
        </Space>
      </Header>
      <Content style={{ maxWidth: 1600, margin: '0 auto', width: '100%', padding: '24px' }}>
        <Outlet />
      </Content>
    </Layout>
  );
}
