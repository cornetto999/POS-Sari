import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
import Transactions from "./pages/Transactions";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen bg-background"><p className="text-muted-foreground">Loading...</p></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AuthRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen bg-background"><p className="text-muted-foreground">Loading...</p></div>;
  if (user) return <Navigate to="/" replace />;
  return <Auth />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="/" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
            <Route path="/pos" element={<ProtectedRoute><AppLayout><POS /></AppLayout></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute><AppLayout><Products /></AppLayout></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute><AppLayout><Customers /></AppLayout></ProtectedRoute>} />
            <Route path="/utang-payments" element={<Navigate to="/customers" replace />} />
            <Route path="/transactions" element={<ProtectedRoute><AppLayout><Transactions /></AppLayout></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
