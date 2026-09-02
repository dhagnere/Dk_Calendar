import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Box, Button, Card, Center, HStack, Image, Input, Text, VStack } from '@chakra-ui/react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { LOGO_CUD, LOGO_DUNKERQUE } from '../logos';

export default function Login() {
  const { session, connexion } = useAuth();
  const [adminExiste, setAdminExiste] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [vue, setVue] = useState<'connexion' | 'demande'>('connexion');

  // Formulaire connexion
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');

  // Formulaire création admin initial
  const [nom, setNom] = useState('');
  const [emailAdmin, setEmailAdmin] = useState('');
  const [motDePasseAdmin, setMotDePasseAdmin] = useState('');

  // Formulaire de demande d'accès (utilisateur sans compte)
  const [nomDemande, setNomDemande] = useState('');
  const [emailDemande, setEmailDemande] = useState('');
  const [organisationDemande, setOrganisationDemande] = useState('');
  const [motifDemande, setMotifDemande] = useState('');

  useEffect(() => {
    api
      .get<{ existe: boolean; nombreComptes: number }>('/auth/existe-administrateur')
      .then((r) => setAdminExiste(r.existe))
      .catch(() => setMessage('Impossible de contacter le serveur. Réessayez dans un instant.'));
  }, []);

  if (session) return <Navigate to="/" replace />;

  const soumettreConnexion = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setMessage(null);
    try {
      const res = await connexion(email, motDePasse);
      if (!res.ok) setMessage(res.message);
    } finally {
      setEnvoi(false);
    }
  };

  const soumettreDemandeAcces = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setMessage(null);
    try {
      const res = await api.post<{ ok: boolean; message: string }>('/demandes-acces', {
        nom: nomDemande,
        email: emailDemande,
        organisation: organisationDemande || undefined,
        motif: motifDemande || undefined,
      });
      setMessage(res.message);
      if (res.ok) {
        setNomDemande('');
        setEmailDemande('');
        setOrganisationDemande('');
        setMotifDemande('');
        setVue('connexion');
      }
    } finally {
      setEnvoi(false);
    }
  };

  const soumettreCreationAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setMessage(null);
    try {
      const res = await api.post<{ ok: boolean; message: string }>('/auth/initialiser-administrateur', {
        nom,
        email: emailAdmin,
        motDePasse: motDePasseAdmin,
      });
      if (res.ok) {
        setAdminExiste(true);
        setMessage('Compte créé, vous pouvez vous connecter.');
      } else {
        setMessage(res.message);
      }
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Center minH="100vh" bg="gray.50" px="4">
      <VStack gap="6" w="full" maxW="sm">
        <HStack gap="4" justify="center">
          <Image src={LOGO_DUNKERQUE} alt="Ville de Dunkerque" h="10" />
          <Box h="9" w="1px" bg="gray.300" />
          <Image src={LOGO_CUD} alt="Communauté urbaine de Dunkerque" h="10" />
        </HStack>
        <Card.Root w="full">
        <Card.Header>
          <Card.Title>
            {adminExiste === false
              ? 'Créer le compte administrateur'
              : vue === 'demande'
                ? 'Demander un accès'
                : 'Connexion — Calendrier Dunkerque'}
          </Card.Title>
        </Card.Header>
        <Card.Body>
          {message && (
            <Text mb="3" fontSize="sm" bg="amber.50" color="amber.800" px="3" py="2" rounded="md">
              {message}
            </Text>
          )}

          {adminExiste === null && (
            <Text fontSize="sm" color="gray.500">
              Chargement…
            </Text>
          )}

          {adminExiste === false && (
            <Box as="form" display="flex" flexDirection="column" gap="3" onSubmit={soumettreCreationAdmin}>
              <Input placeholder="Nom complet" value={nom} onChange={(e) => setNom(e.target.value)} required />
              <Input
                type="email"
                placeholder="Email"
                value={emailAdmin}
                onChange={(e) => setEmailAdmin(e.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="Mot de passe (10 caractères min.)"
                value={motDePasseAdmin}
                onChange={(e) => setMotDePasseAdmin(e.target.value)}
                minLength={10}
                required
              />
              <Button type="submit" colorPalette="blue" w="full" loading={envoi}>
                Créer le compte administrateur
              </Button>
            </Box>
          )}

          {adminExiste === true && vue === 'connexion' && (
            <>
              <Box as="form" display="flex" flexDirection="column" gap="3" onSubmit={soumettreConnexion}>
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Input
                  type="password"
                  placeholder="Mot de passe"
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  required
                />
                <Button type="submit" colorPalette="blue" w="full" loading={envoi}>
                  Se connecter
                </Button>
              </Box>
              <Text
                as="button"
                mt="3"
                w="full"
                textAlign="center"
                fontSize="sm"
                color="blue.600"
                _hover={{ textDecoration: 'underline' }}
                onClick={() => {
                  setMessage(null);
                  setVue('demande');
                }}
              >
                Pas encore de compte ? Demander un accès
              </Text>
            </>
          )}

          {adminExiste === true && vue === 'demande' && (
            <>
              <Box as="form" display="flex" flexDirection="column" gap="3" onSubmit={soumettreDemandeAcces}>
                <Input
                  placeholder="Nom complet"
                  value={nomDemande}
                  onChange={(e) => setNomDemande(e.target.value)}
                  required
                />
                <Input
                  type="email"
                  placeholder="Email"
                  value={emailDemande}
                  onChange={(e) => setEmailDemande(e.target.value)}
                  required
                />
                <Input
                  placeholder="Organisation (optionnel)"
                  value={organisationDemande}
                  onChange={(e) => setOrganisationDemande(e.target.value)}
                />
                <Input
                  placeholder="Motif de la demande (optionnel)"
                  value={motifDemande}
                  onChange={(e) => setMotifDemande(e.target.value)}
                />
                <Button type="submit" colorPalette="blue" w="full" loading={envoi}>
                  Envoyer la demande
                </Button>
              </Box>
              <Text
                as="button"
                mt="3"
                w="full"
                textAlign="center"
                fontSize="sm"
                color="gray.500"
                _hover={{ textDecoration: 'underline' }}
                onClick={() => {
                  setMessage(null);
                  setVue('connexion');
                }}
              >
                ← Retour à la connexion
              </Text>
            </>
          )}
        </Card.Body>
        </Card.Root>
      </VStack>
    </Center>
  );
}
