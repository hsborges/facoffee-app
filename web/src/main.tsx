import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from 'react-oidc-context';
import { BrowserRouter, useNavigate } from 'react-router';
import { App } from './app';
import { destinoDoLogin } from './navegacao';
import './estilos.css';

// Authorization Code + PKCE with the public client `facoffee-web` (ADR 0003, ADR 0019).
const oidc = {
  authority: import.meta.env.VITE_OIDC_AUTHORITY ?? 'http://localhost:8080/realms/facoffee',
  client_id: import.meta.env.VITE_OIDC_CLIENT_ID ?? 'facoffee-web',
  redirect_uri: `${location.origin}/`,
  post_logout_redirect_uri: `${location.origin}/`,
};

// Inside the router: after the login, it navigates to the page kept in the `state`,
// which also drops `code` and `state` from the URL.
const Autenticacao = () => {
  const navigate = useNavigate();
  return (
    <AuthProvider
      {...oidc}
      onSigninCallback={(user) => navigate(destinoDoLogin(user?.state), { replace: true })}
    >
      <App />
    </AuthProvider>
  );
};

createRoot(document.getElementById('raiz') as HTMLElement).render(
  <StrictMode>
    <BrowserRouter>
      <Autenticacao />
    </BrowserRouter>
  </StrictMode>,
);
