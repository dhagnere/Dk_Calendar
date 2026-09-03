import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { RequireAdmin } from './components/RequireAdmin';
import Login from './pages/Login';
import Calendrier from './pages/Calendrier';
import Liste from './pages/Liste';
import Carte from './pages/Carte';
import Comptes from './pages/Comptes';
import Demandes from './pages/Demandes';

export default function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<Login />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<Calendrier />} />
        <Route path="/liste" element={<Liste />} />
        <Route path="/carte" element={<Carte />} />
        <Route element={<RequireAdmin />}>
          <Route path="/comptes" element={<Comptes />} />
          <Route path="/demandes" element={<Demandes />} />
        </Route>
      </Route>
    </Routes>
  );
}
