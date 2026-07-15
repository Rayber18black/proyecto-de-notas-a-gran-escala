import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "./pages/NotFound.tsx";
import Auth from "./pages/Auth.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Alumnos from "./pages/Alumnos.tsx";
import Notas from "./pages/Notas.tsx";
import Config from "./pages/Config.tsx";
import Usuarios from "./pages/Usuarios.tsx";
import Academico from "./pages/Academico.tsx";
import Auditoria from "./pages/Auditoria.tsx";
import Consulta from "./pages/Consulta.tsx";
import Comunicaciones from "./pages/Comunicaciones.tsx";
import Protected from "./components/Protected.tsx";
import { AuthProvider } from "./hooks/useAuth.tsx";
import { ThemeProvider } from "./components/theme-provider.tsx";

const queryClient = new QueryClient();

const App = () => {
  return (
    <ThemeProvider defaultTheme="system" storageKey="gestion-notas-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<Protected><Dashboard /></Protected>} />
              <Route path="/alumnos" element={<Protected requiredPerm="p_doc_1"><Alumnos /></Protected>} />
              <Route path="/notas" element={<Protected><Notas /></Protected>} />
              <Route path="/comunicaciones" element={<Protected requiredPerm="p_rot_5"><Comunicaciones /></Protected>} />
              <Route path="/usuarios" element={<Protected requiredPerm="can_manage_roles"><Usuarios /></Protected>} />
              <Route path="/academico" element={<Protected requiredPerm="p_rot_3"><Academico /></Protected>} />
              <Route path="/auditoria" element={<Protected><Auditoria /></Protected>} />
              <Route path="/config" element={<Protected requiredPerm="can_config_system"><Config /></Protected>} />
              <Route path="/consulta" element={<Consulta />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;

