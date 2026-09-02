import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import App from './App';
import { AuthProvider } from './context/AuthContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ChakraProvider value={defaultSystem}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ChakraProvider>
  </React.StrictMode>
);
