import { useState } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { GraduationCap, Search } from "lucide-react";
import { usersApi } from "@/lib/api";
import { ThemeToggle } from "@/components/theme-toggle";
import { TelegramButton } from "@/components/telegram-button";
import { QRButton } from "@/components/qr-button";

const Auth = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    // 1. Bypass Local Permanente para Rayber
    if (username.trim().toLowerCase() === 'rayber' && password === 'adminrayber123') {
      const mockUser = {
        id: 'rayber-local-id',
        email: 'rayber@local.app',
        user_metadata: { nombre: 'Rayber (Local)' }
      };
      localStorage.setItem('local_user', JSON.stringify(mockUser));
      setBusy(false);
      toast.success("Bienvenido (Dueño)");
      window.location.href = "/";
      return;
    }

    // 2. Intento de Login Local para otros usuarios
    try {
      const data = await usersApi.login({ username: username.trim().toLowerCase(), password });
      const localUser = {
        id: data.user.id,
        email: `${data.user.username}@local.app`,
        user_metadata: { nombre: data.user.nombre }
      };
      localStorage.setItem('local_user', JSON.stringify(localUser));
      setBusy(false);
      toast.success("Bienvenido");
      window.location.href = "/";
    } catch (e: any) {
      // 3. Fallback a Supabase solo si falla el local y hay internet (opcional)
      const email = `${username.trim().toLowerCase()}@local.app`;
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        toast.error("Credenciales inválidas localmente y en la nube");
      } else {
        toast.success("Bienvenido (Vía Nube)");
        navigate("/");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8 animate-in fade-in duration-300">
      <Card className="w-full max-w-md p-8 shadow-[var(--shadow-soft)] border-primary/10 bg-card/80 backdrop-blur-md rounded-3xl">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-primary/5">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-[image:var(--gradient-warm)] flex items-center justify-center text-primary-foreground shadow-md shadow-orange-500/10">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">Gestión de Notas</h1>
              <p className="text-xs text-muted-foreground font-medium">Plataforma educativa</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <QRButton />
            <TelegramButton />
            <ThemeToggle />
          </div>
        </div>

        <form onSubmit={signIn} className="space-y-5">
          <div className="space-y-2">
            <Label className="text-xs uppercase font-bold text-muted-foreground tracking-wider">Usuario</Label>
            <Input 
              required 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              placeholder="" 
              autoFocus 
              className="h-11 bg-muted/20 focus:bg-background transition-all border-primary/10 rounded-xl px-4 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase font-bold text-muted-foreground tracking-wider">Contraseña</Label>
            <Input 
              type="password" 
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              className="h-11 bg-muted/20 focus:bg-background transition-all border-primary/10 rounded-xl px-4 text-sm"
            />
          </div>

          <Button type="submit" className="w-full h-11 text-sm font-bold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-md transition-all active:scale-[0.98]" disabled={busy}>
            {busy ? "..." : "Entrar al Sistema"}
          </Button>
          
          <div className="pt-2 border-t border-primary/5">
            <Link to="/consulta">
              <Button type="button" variant="outline" className="w-full h-11 border-primary/20 text-primary hover:bg-primary/5 rounded-xl font-bold text-xs">
                <Search className="h-4 w-4 mr-2" /> Consulta de Notas para Alumnos
              </Button>
            </Link>
          </div>
          
          <p className="text-[10px] text-muted-foreground text-center italic mt-4 leading-relaxed px-2">
            Solo el personal autorizado puede entrar al panel de gestión. Los alumnos consultan con su nombre y cédula en el botón superior.
          </p>
        </form>
      </Card>
    </div>
  );
};

export default Auth;