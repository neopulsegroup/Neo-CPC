import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { useLayoutEffect } from "react";

// Pages
import Index from "./pages/Index";
import About from "./pages/About";
import HowItWorks from "./pages/HowItWorks";
import Contact from "./pages/Contact";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import Triage from "./pages/Triage";
import MigrantDashboard from "./pages/dashboard/MigrantDashboard";
import CPCDashboard from "./pages/dashboard/CPCDashboard";
import CompanyDashboard from "./pages/dashboard/CompanyDashboard";
import NotFound from "./pages/NotFound";
import CreateTestUsersDev from "./pages/dev/CreateTestUsers";
import Cookies from "./pages/Cookies";
import Privacy from "./pages/Privacy";
import HelpCenter from "./pages/HelpCenter";
import ComingSoon from "./pages/ComingSoon";

const queryClient = new QueryClient();

// Loading component
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

// Helper to get dashboard path by role
function getDashboardPath(role: string): string {
  if (role === 'migrant') return '/dashboard/migrante';
  if (role === 'company') return '/dashboard/empresa';
  // CPC roles
  if (['admin', 'mediator', 'lawyer', 'psychologist', 'manager', 'coordinator', 'trainer'].includes(role)) {
    return '/dashboard/cpc';
  }
  return '/';
}

// Protected Route Component
function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { isAuthenticated, profile, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/entrar" replace />;
  }

  if (allowedRoles && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-lg border bg-card p-6 text-card-foreground">
          <h1 className="text-lg font-semibold">Sem acesso aos dados</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Não foi possível carregar o seu perfil de permissões. Termine a sessão e entre novamente. Se persistir,
            contacte o administrador do sistema.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">Erro típico: Missing or insufficient permissions.</p>
        </div>
      </div>
    );
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    // Redirect to their appropriate dashboard instead of home
    const correctDashboard = getDashboardPath(profile.role);
    return <Navigate to={correctDashboard} replace />;
  }

  return <>{children}</>;
}

/** Garante que cada navegação abre a página no topo (ex.: links do footer). */
function ScrollToTop() {
  const { pathname, search } = useLocation();
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, search]);
  return null;
}

// Triage Guard
function TriageGuard({ children }: { children: React.ReactNode }) {
  const { profile, triage, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (profile?.role === 'migrant' && !triage?.completed) {
    return <Navigate to="/triagem" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Index />} />
      <Route path="/sobre" element={<About />} />
      <Route path="/como-funciona" element={<HowItWorks />} />
      <Route path="/contacto" element={<Contact />} />
      <Route path="/entrar" element={<Auth />} />
      <Route path="/registar" element={<Auth />} />
      <Route path="/recuperar-senha" element={<ForgotPassword />} />
      <Route path="/ajuda" element={<HelpCenter />} />
      <Route path="/em-breve" element={<ComingSoon />} />
      <Route path="/termos" element={<NotFound />} />
      <Route path="/privacidade" element={<Privacy />} />
      <Route path="/cookies" element={<Cookies />} />
      <Route path="/trails" element={<NotFound />} />
      <Route path="/precos" element={<NotFound />} />
      {import.meta.env.DEV && (
        <Route path="/dev/criar-usuarios" element={<CreateTestUsersDev />} />
      )}

      {/* Triage */}
      <Route
        path="/triagem"
        element={
          <ProtectedRoute allowedRoles={['migrant']}>
            <Triage />
          </ProtectedRoute>
        }
      />

      {/* Migrant Dashboard */}
      <Route
        path="/dashboard/migrante/*"
        element={
          <ProtectedRoute allowedRoles={['migrant']}>
            <TriageGuard>
              <MigrantDashboard />
            </TriageGuard>
          </ProtectedRoute>
        }
      />

      {/* CPC Dashboard */}
      <Route
        path="/dashboard/cpc/*"
        element={
          <ProtectedRoute allowedRoles={['mediator', 'lawyer', 'psychologist', 'manager', 'coordinator', 'admin', 'trainer']}>
            <CPCDashboard />
          </ProtectedRoute>
        }
      />

      {/* Company Dashboard */}
      <Route
        path="/dashboard/empresa/*"
        element={
          <ProtectedRoute allowedRoles={['company']}>
            <CompanyDashboard />
          </ProtectedRoute>
        }
      />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
