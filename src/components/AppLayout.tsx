import { ReactNode, useState, useEffect, useRef } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usersApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { GraduationCap, LayoutDashboard, Users, BookOpen, Settings, LogOut, Menu, X, UserCog, Shield, User, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ThemeToggle } from "./theme-toggle";
import { TelegramButton } from "./telegram-button";
import { QRButton } from "./qr-button";
import { OwnerPanelModal } from "./owner-panel-modal";

const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, staff: true, end: true },
  { to: "/alumnos", label: "Alumnos", icon: Users, staff: true },
  { to: "/notas", label: "Calificaciones", icon: BookOpen },
  { to: "/academico", label: "Académico", icon: BookOpen, root: true },
  { to: "/comunicaciones", label: "Comunicaciones", icon: MessageSquare, root: true },
  { to: "/usuarios", label: "Usuarios", icon: UserCog, root: true },
  { to: "/auditoria", label: "Auditoría / Backups", icon: Shield, root: true },
  { to: "/config", label: "Ajustes", icon: Settings },
];

const AppLayout = ({ children }: { children: ReactNode }) => {
  const { user, profile, roles, signOut, isStaff, isRoot, perms, isOwner } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const role = roles?.[0] || "invitado";
  const isRayber = isOwner || user?.email?.includes("rayber") || profile?.nombre?.toLowerCase().includes("rayber");
  const displayRole = isRayber ? "Owner" : (role === "root" ? "Administrador Principal" : role);
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [showOwnerPanel, setShowOwnerPanel] = useState(false);

  const [sidebarIndicator, setSidebarIndicator] = useState({ top: 0, height: 0, opacity: 0 });
  const [bottomIndicator, setBottomIndicator] = useState({ left: 0, width: 0, opacity: 0 });
  const sidebarNavRef = useRef<HTMLElement>(null);
  const bottomNavRef = useRef<HTMLElement>(null);

  const [showRoles, setShowRoles] = useState(false);
  const [roleCounts, setRoleCounts] = useState({ root: 0, admin: 0, docente: 0, student: 0 });

  const roleItems = [
    { key: "root", label: "Root", icon: Shield, count: roleCounts.root, desc: "Control total del sistema", color: "text-purple-500" },
    { key: "admin", label: "Admin", icon: UserCog, count: roleCounts.admin, desc: "Gestión de alumnos y notas", color: "text-blue-500" },
    { key: "docente", label: "Docente", icon: GraduationCap, count: roleCounts.docente, desc: "Registro de calificaciones", color: "text-green-500" },
    { key: "student", label: "Estudiante", icon: User, count: roleCounts.student, desc: "Consulta de notas propias", color: "text-orange-500" },
  ];

  useEffect(() => {
    // Redirigir a estudiantes del Dashboard a Notas
    if (role === "student" && location.pathname === "/") {
      navigate("/notas", { replace: true });
    }

    // Cargar conteo de roles
    const fetchRoles = async () => {
      try {
        const { roles: localRoles } = await usersApi.list();
        const counts = { root: 0, admin: 0, docente: 0, student: 0 } as any;
        (localRoles ?? []).forEach((r: any) => { 
          if (counts[r.role] !== undefined) counts[r.role]++; 
        });
        if (counts.root > 0) counts.root--; // Excluir owner
        setRoleCounts(counts);
      } catch (e) {
        console.warn("Error al cargar roles localmente:", e);
      }
    };
    fetchRoles();

    // Actualizar indicador de Sidebar
    const updateSidebar = () => {
      setTimeout(() => {
        const active = sidebarNavRef.current?.querySelector(".active") as HTMLElement;
        if (active) {
          setSidebarIndicator({
            top: active.offsetTop,
            height: active.offsetHeight,
            opacity: 1
          });
        }
      }, 50);
    };

    // Actualizar indicador de Bottom Nav
    const updateBottom = () => {
      setTimeout(() => {
        const active = bottomNavRef.current?.querySelector(".active") as HTMLElement;
        if (active) {
          setBottomIndicator({
            left: active.offsetLeft,
            width: active.offsetWidth,
            opacity: 1
          });
        }
      }, 50);
    };

    updateSidebar();
    updateBottom();
  }, [role, location.pathname, navigate]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_1fr] bg-background">
      <OwnerPanelModal open={showOwnerPanel} onOpenChange={setShowOwnerPanel} />
      
      <header className="lg:hidden flex items-center justify-between p-4 border-b border-border bg-card sticky top-0 z-30">
        <div 
          className={cn("flex items-center gap-2", isOwner && "cursor-pointer hover:opacity-80 transition-opacity")}
          onClick={() => isOwner && setShowOwnerPanel(true)}
        >
          <div className="h-9 w-9 rounded-lg bg-[image:var(--gradient-warm)] flex items-center justify-center text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="font-bold">Gestión de Notas</span>
        </div>
        <div className="flex items-center gap-2">
          <QRButton />
          <TelegramButton />
          <ThemeToggle />
          <Button size="icon" variant="ghost" onClick={() => setOpen(!open)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>
      {open && <div className="lg:hidden fixed inset-0 bg-black/40 z-30" onClick={() => setOpen(false)} />}
      <aside className={cn(
        "border-r border-border bg-card p-6 flex-col gap-6 z-40",
        "lg:flex lg:static lg:translate-x-0",
        open ? "fixed inset-y-0 left-0 w-72 flex" : "hidden lg:flex"
      )}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div 
              className={cn(
                "h-11 w-11 rounded-xl bg-[image:var(--gradient-warm)] flex items-center justify-center text-primary-foreground shadow-lg transition-all duration-500",
                isOwner ? "cursor-pointer hover:rotate-12 hover:scale-110 active:scale-95" : ""
              )}
              onClick={() => isOwner && setShowOwnerPanel(true)}
              title={isOwner ? "Panel Maestro de Owner" : ""}
            >
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight">Gestión de Notas</h1>
              <p className="text-xs text-muted-foreground">Plataforma educativa</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 pl-1">
            <QRButton />
            <TelegramButton />
            <ThemeToggle />
          </div>
        </div>
        
        <div className="space-y-3">
          <div 
            onClick={() => setShowRoles(true)}
            className="rounded-xl bg-muted p-3 cursor-pointer hover:bg-primary/5 transition-all duration-300 border border-transparent hover:border-primary/20 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <p className="text-xs text-muted-foreground relative z-10">Sesión</p>
            <p className="font-semibold text-sm truncate relative z-10">{profile?.nombre || "Usuario"}</p>
            <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-md bg-primary/15 text-primary uppercase tracking-wide relative z-10">
              {displayRole}
            </span>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 h-12 px-4 rounded-xl text-red-500 bg-red-500/5 border border-red-500/20 hover:bg-red-500 hover:text-white hover:shadow-[0_0_20px_rgba(239,68,68,0.3)] transition-all duration-300 group" 
            onClick={() => signOut().then(() => navigate("/auth"))}
          >
            <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
              <LogOut className="h-4 w-4" />
            </div>
            <span className="font-bold text-sm tracking-tight">Cerrar sesión</span>
          </Button>
        </div>

        <nav ref={sidebarNavRef} className="flex flex-col gap-1 mt-4 relative">
          <div 
            className="absolute left-0 w-full bg-primary/10 rounded-xl transition-all duration-300 ease-in-out pointer-events-none"
            style={{ 
              top: sidebarIndicator.top, 
              height: sidebarIndicator.height, 
              opacity: sidebarIndicator.opacity 
            }}
          />
          {items.map((it) => {
            if (it.to === "/alumnos" && !perms.p_doc_1) return null;
            if (it.to === "/academico" && !perms.p_rot_3) return null;
            if (it.to === "/comunicaciones" && !perms.p_rot_5) return null;
            if (it.to === "/usuarios" && !perms.can_manage_roles) return null;
            if (it.to === "/config" && !(perms.can_config_system || perms.p_rot_5 || perms.p_own_2)) return null;
            if (it.to === "/auditoria" && !(perms.p_rot_4 || perms.can_delete_audit || perms.can_export_backups)) return null;
            
            return (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 relative z-10",
                    isActive
                      ? "text-primary"
                      : "text-foreground/70 hover:bg-muted hover:text-foreground"
                  )
                }
              >
                <it.icon className={cn("h-4 w-4 transition-transform duration-300", location.pathname === it.to && "scale-110")} />
                {it.label}
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <main className="p-4 sm:p-6 lg:p-10 overflow-x-hidden overflow-y-auto pb-20 lg:pb-10">{children}</main>

      {/* Bottom Navigation for Mobile */}
      {isMobile && (
        <nav ref={bottomNavRef} className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-center justify-around px-2 z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
          <div 
            className="absolute h-1 bg-primary rounded-full transition-all duration-300 ease-in-out"
            style={{ 
              left: bottomIndicator.left + (bottomIndicator.width * 0.2), 
              width: bottomIndicator.width * 0.6,
              bottom: '4px',
              opacity: bottomIndicator.opacity 
            }}
          />
          {items.slice(0, 4).map((it) => {
            if ((it as any).root && !isRoot) return null;
            if (it.staff && !isStaff) return null;
            return (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.end}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-300 relative z-10",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )
                }
              >
                <it.icon className={cn("h-5 w-5 transition-transform duration-300", location.pathname === it.to && "scale-110")} />
                <span className="text-[10px] font-medium">{it.label}</span>
              </NavLink>
            );
          })}
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)} className="flex flex-col h-auto gap-1">
            <Menu className="h-5 w-5 text-muted-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground">Más</span>
          </Button>
        </nav>
      )}

      <Dialog open={showRoles} onOpenChange={setShowRoles}>
        <DialogContent className="max-w-2xl bg-background/95 backdrop-blur-xl border-primary/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Shield className="h-5 w-5 text-primary" /> Distribución de Roles
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-6">
            {roleItems.map((r) => {
              const active = role === r.key;
              return (
                <div
                  key={r.key}
                  className={cn(
                    "rounded-2xl border p-5 transition-all duration-500 group relative overflow-hidden",
                    active 
                      ? "border-primary bg-primary/5 shadow-lg scale-[1.02]" 
                      : "border-border bg-muted/30 hover:bg-muted/50 hover:border-primary/30"
                  )}
                >
                  <div className="flex items-start justify-between relative z-10">
                    <div className={cn("p-3 rounded-xl bg-white dark:bg-slate-850 shadow-sm transition-transform duration-500 group-hover:scale-110", r.color)}>
                      <r.icon className="h-6 w-6" />
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black text-slate-800 dark:text-slate-100">{r.count}</span>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Usuarios</p>
                    </div>
                  </div>
                  <div className="mt-4 relative z-10">
                    <p className="font-bold text-lg text-slate-800 dark:text-slate-100">{r.label}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{r.desc}</p>
                  </div>
                  {active && (
                    <div className="mt-4 flex items-center gap-2 relative z-10">
                      <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      <span className="text-[11px] uppercase tracking-wider text-primary font-black">Tu Rango Actual</span>
                    </div>
                  )}
                  <div className={cn(
                    "absolute -bottom-6 -right-6 h-24 w-24 rounded-full opacity-5 transition-transform duration-700 group-hover:scale-150",
                    active ? "bg-primary" : "bg-slate-400"
                  )} />
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AppLayout;