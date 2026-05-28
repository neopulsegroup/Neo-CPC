import { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { CookieConsent } from '@/components/cookies/CookieConsent';

interface LayoutProps {
  children: ReactNode;
  hideFooter?: boolean;
}

export function Layout({ children, hideFooter = false }: LayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      {!hideFooter && <Footer />}
      <CookieConsent />
    </div>
  );
}
