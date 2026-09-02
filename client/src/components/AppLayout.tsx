import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { Badge, Box, Button, Container, Flex, HStack, Image, Text } from '@chakra-ui/react';
import { useAuth } from '../context/AuthContext';
import { LOGO_CUD, LOGO_DUNKERQUE } from '../logos';

function NavItem({ to, end, children }: { to: string; end?: boolean; children: React.ReactNode }) {
  return (
    <NavLink to={to} end={end}>
      {({ isActive }) => (
        <Box
          px="3"
          py="2"
          rounded="md"
          fontSize="sm"
          fontWeight="medium"
          bg={isActive ? 'blue.600' : 'transparent'}
          color={isActive ? 'white' : 'gray.600'}
          _hover={{ bg: isActive ? 'blue.600' : 'gray.100' }}
        >
          {children}
        </Box>
      )}
    </NavLink>
  );
}

export function AppLayout() {
  const { session, loading, estAdministrateur, deconnexion } = useAuth();

  if (loading) {
    return (
      <Flex h="100vh" align="center" justify="center" color="gray.500">
        Chargement…
      </Flex>
    );
  }
  if (!session) return <Navigate to="/connexion" replace />;

  return (
    <Box minH="100vh">
      <Box borderBottomWidth="1px" borderColor="gray.200" bg="white">
        <Container maxW="6xl" py="3">
          <Flex align="center" justify="space-between">
            <HStack gap="6">
              <HStack gap="3">
                <Image src={LOGO_DUNKERQUE} alt="Ville de Dunkerque" h="9" />
                <Box h="8" w="1px" bg="gray.200" />
                <Image src={LOGO_CUD} alt="Communauté urbaine de Dunkerque" h="9" />
              </HStack>
              <Text fontSize="lg" fontWeight="bold" color="gray.800">
                Calendrier Événements
              </Text>
              <HStack gap="1">
                <NavItem to="/" end>
                  Calendrier
                </NavItem>
                <NavItem to="/liste">Liste</NavItem>
                {estAdministrateur && (
                  <>
                    <NavItem to="/comptes">Comptes</NavItem>
                    <NavItem to="/demandes">Demandes d'accès</NavItem>
                  </>
                )}
              </HStack>
            </HStack>
            <HStack gap="3">
              {!estAdministrateur && <Badge colorPalette="blue">Consultation seule</Badge>}
              <Text fontSize="sm" color="gray.600">
                {session.nom}
              </Text>
              <Button variant="subtle" colorPalette="gray" onClick={() => deconnexion()}>
                Déconnexion
              </Button>
            </HStack>
          </Flex>
        </Container>
      </Box>
      <Container maxW="6xl" py="6">
        <Outlet />
      </Container>
    </Box>
  );
}
