import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from 'react-oidc-context';
import { BrowserRouter } from 'react-router';
import { App } from './app';
import './estilos.css';

// Authorization Code + PKCE with the public client `facoffee-web` (ADR 0003, ADR 0019).
const oidc = {
  authority: import.meta.env.VITE_OIDC_AUTHORITY ?? 'http://localhost:8080/realms/facoffee',
  client_id: import.meta.env.VITE_OIDC_CLIENT_ID ?? 'facoffee-web',
  redirect_uri: `${location.origin}/`,
  post_logout_redirect_uri: `${location.origin}/`,
  // Drops `code` and `state` from the URL after the login.
  onSigninCallback: () => history.replaceState(null, '', location.pathname),
};

createRoot(document.getElementById('raiz') as HTMLElement).render(
  <StrictMode>
    <AuthProvider {...oidc}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
