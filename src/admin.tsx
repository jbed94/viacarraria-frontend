import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AdminAuthGuard } from './pages/admin/admin-auth-guard';
import { AdminPage } from './pages/admin/admin-page';
import './styles.css';

export function AdminApp() {
  const publicWebUrl =
    import.meta.env.VITE_PUBLIC_WEB_URL ||
    (typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:4173`
      : 'http://localhost:4173');

  const handleBackToCanvas = () => {
    window.location.href = publicWebUrl;
  };

  const handleOpenGraphOnCanvas = (graphId: string) => {
    window.location.href = `${publicWebUrl}?graphId=${encodeURIComponent(graphId)}`;
  };

  return (
    <AdminAuthGuard onBackToCanvas={handleBackToCanvas}>
      <AdminPage
        onBackToCanvas={handleBackToCanvas}
        onOpenGraphOnCanvas={handleOpenGraphOnCanvas}
      />
    </AdminAuthGuard>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <AdminApp />
    </StrictMode>,
  );
}
