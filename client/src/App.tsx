import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import Login from './pages/Login';
import Calendrier from './pages/Calendrier';
import Liste from './pages/Liste';
import Comptes from './pages/Comptes';

export default function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<Login />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<Calendrier />} />
        <Route path="/liste" element={<Liste />} />
        <Route path="/comptes" element={<Comptes />} />
      </Route>
    </Routes>
  );
}
