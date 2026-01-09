import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { AlertBreakthrough } from '@/components/alerts/AlertBreakthrough';

export function AppShell() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <Header />
      <AlertBreakthrough />
      <main className="flex-1 overflow-auto p-4">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
