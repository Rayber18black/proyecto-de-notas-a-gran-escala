import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { configApi, usersApi, delegationsApi } from "@/lib/api";
import { toast } from "sonner";
import { 
  Server, Smartphone, RefreshCw, Crown, ShieldAlert, UserCircle, 
  QrCode, Laptop, Lock, ShieldCheck, Zap, Info, X
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const PERMISSION_DETAILS: Record<string, { label: string, desc: string }> = {
  p_doc_1: { label: "D1", desc: "Cargar y Modificar Calificaciones" },
  p_doc_3: { label: "D3", desc: "Consultar Notas por Alumno" },
  p_adm_2: { label: "A2", desc: "Registrar y Editar Alumnos" },
  p_adm_3: { label: "A3", desc: "Gestionar Secciones y Grados" },
  p_adm_4: { label: "A4", desc: "Acceso al Centro de Comunicaciones" },
  p_adm_5: { label: "A5", desc: "Ver Auditoría de Cambios de Notas" },
  p_adm_6: { label: "A6", desc: "Exportar Reportes PDF y Excel" },
  p_rot_2: { label: "R2", desc: "Crear y Editar Cuentas de Usuarios" },
  p_rot_3: { label: "R3", desc: "Asignar Roles y Grados Académicos" },
  p_rot_4: { label: "R4", desc: "Configuración Técnica del Servidor" },
  p_rot_5: { label: "R5", desc: "Ajustes de Integración con Telegram" },
  p_rot_6: { label: "R6", desc: "Realizar Copias de Seguridad" },
  p_rot_7: { label: "R7", desc: "Restaurar Base de Datos (Peligro)" },
  p_own_2: { label: "O2", desc: "Delegar Autoridad a otros Usuarios" },
  p_own_4: { label: "O4", desc: "Gestión de IP y Acceso Móvil" },
  p_own_5: { label: "O5", desc: "Acceso Total a Logs del Sistema" },
  can_manage_roles: { label: "S1", desc: "Administración de Roles Globales (Panel Oculto)" },
  can_delete_audit: { label: "S2", desc: "Eliminar Registro de Auditoría (Panel Oculto)" },
  can_config_system: { label: "S3", desc: "Modificar Configuración Base (Panel de Config.)" },
  can_export_backups: { label: "S4", desc: "Exportar Copias de Seguridad (Panel Oculto)" }
};

export function OwnerPanelModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: config } = useQuery({
    queryKey: ["app-config"],
    queryFn: configApi.get,
    enabled: open,
  });

  const { data: usersData } = useQuery({
    queryKey: ["users-all"],
    queryFn: usersApi.list,
    enabled: open,
  });

  const { data: delegations = [] } = useQuery({
    queryKey: ["delegations"],
    queryFn: delegationsApi.list,
    enabled: open,
  });

  const handleToggle = async (key: string, value: any) => {
    try {
      await configApi.update({ [key]: value });
      toast.success("Actualizado");
      queryClient.invalidateQueries({ queryKey: ["app-config"] });
    } catch (e) {
      toast.error("Error");
    }
  };

  const handleDelegation = async (userId: string, permKey: string, value: boolean) => {
    setBusy(true);
    try {
      const current = delegations.find((d: any) => d.user_id === userId) || { user_id: userId };
      await delegationsApi.save({ ...current, [permKey]: value ? 1 : 0 });
      queryClient.invalidateQueries({ queryKey: ["delegations"] });
      toast.success("Sincronizado");
    } catch (e) {
      toast.error("Error");
    } finally {
      setBusy(false);
    }
  };

  const localUrl = `http://${config?.local_ip || 'localhost'}:8080`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] lg:max-w-5xl h-[85vh] overflow-hidden bg-slate-950 border-white/10 p-0 flex flex-col shadow-2xl rounded-[2rem] group [&>button]:hidden">
        
        {/* Botón de Cerrar Maestro - Único y Resaltado */}
        <button 
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 z-50 h-8 w-8 rounded-full bg-red-500/10 border border-red-500/40 flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all duration-300 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
          title="Cerrar Panel"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Compacto y Elegante */}
        <div className="p-6 bg-gradient-to-br from-slate-900 to-black relative overflow-hidden flex items-center justify-between border-b border-white/5 pr-16">
          <div className="flex items-center gap-5 relative z-10">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 backdrop-blur-xl border border-primary/20 flex items-center justify-center text-primary shadow-lg">
              <Crown className="h-7 w-7 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white uppercase italic">Control Maestro</h1>
              <p className="text-[9px] text-blue-300/50 font-mono font-bold tracking-[0.2em] uppercase">Owner Access • Rayber Ventas</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 relative z-10 mr-4">
            <div className="px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Online</span>
            </div>
          </div>
        </div>

        <Tabs defaultValue="perms" className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-900">
          <div className="px-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-white/5">
            <TabsList className="h-12 bg-transparent gap-6">
              <TabsTrigger value="perms" className="data-[state=active]:text-primary rounded-none border-b-2 border-transparent data-[state=active]:border-primary h-full gap-2 px-4 font-bold uppercase text-[10px] tracking-wider transition-all">
                <ShieldCheck className="h-3.5 w-3.5" /> Permisos
              </TabsTrigger>
              <TabsTrigger value="infra" className="data-[state=active]:text-primary rounded-none border-b-2 border-transparent data-[state=active]:border-primary h-full gap-2 px-4 font-bold uppercase text-[10px] tracking-wider transition-all">
                <Zap className="h-3.5 w-3.5" /> Infraestructura
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            
            {/* TABS: PERMISOS (Compacto) */}
            <TabsContent value="perms" className="m-0 animate-in fade-in zoom-in-95 duration-300">
              <div className="rounded-2xl border border-slate-100 dark:border-white/10 overflow-hidden shadow-sm bg-white dark:bg-slate-950">
                <Table>
                  <TableHeader className="bg-slate-50/50 dark:bg-white/5">
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="w-[180px] font-black uppercase text-[9px] tracking-widest p-4">Usuario</TableHead>
                      <TableHead className="text-center font-black uppercase text-[9px] tracking-widest text-blue-500/70">Docente</TableHead>
                      <TableHead className="text-center font-black uppercase text-[9px] tracking-widest text-emerald-500/70">Admin</TableHead>
                      <TableHead className="text-center font-black uppercase text-[9px] tracking-widest text-purple-500/70">Root</TableHead>
                      <TableHead className="text-center font-black uppercase text-[9px] tracking-widest text-orange-500/70">Owner</TableHead>
                      <TableHead className="text-center font-black uppercase text-[9px] tracking-widest text-cyan-500/70">Sistema / Ocultos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersData?.profiles.filter((u: any) => u.username !== 'rayber').map((profile: any) => {
                      const userDelegation = delegations.find((d: any) => d.user_id === profile.id) || {};
                      return (
                        <TableRow key={profile.id} className="border-b border-slate-50 dark:border-white/5 hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-colors">
                          <TableCell className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-bold text-xs uppercase border border-slate-200 dark:border-white/5">
                                {profile.nombre.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{profile.nombre}</p>
                                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-tighter opacity-70 truncate">{profile.username}</p>
                              </div>
                            </div>
                          </TableCell>
                          
                          <TableCell className="p-2"><div className="flex justify-center gap-2">{['p_doc_1', 'p_doc_3'].map(k => <PermissionSwitch key={k} k={k} checked={!!userDelegation[k]} onChange={(v) => handleDelegation(profile.id, k, v)} color="bg-blue-500" />)}</div></TableCell>
                          <TableCell className="p-2"><div className="flex justify-center gap-1.5">{['p_adm_2', 'p_adm_3', 'p_adm_4', 'p_adm_5', 'p_adm_6'].map(k => <PermissionSwitch key={k} k={k} checked={!!userDelegation[k]} onChange={(v) => handleDelegation(profile.id, k, v)} color="bg-emerald-500" />)}</div></TableCell>
                          <TableCell className="p-2"><div className="flex justify-center gap-1">{['p_rot_2', 'p_rot_3', 'p_rot_4', 'p_rot_5', 'p_rot_6', 'p_rot_7'].map(k => <PermissionSwitch key={k} k={k} checked={!!userDelegation[k]} onChange={(v) => handleDelegation(profile.id, k, v)} color="bg-purple-500" />)}</div></TableCell>
                          <TableCell className="p-2"><div className="flex justify-center gap-2">{['p_own_2', 'p_own_4', 'p_own_5'].map(k => <PermissionSwitch key={k} k={k} checked={!!userDelegation[k]} onChange={(v) => handleDelegation(profile.id, k, v)} color="bg-orange-500" />)}</div></TableCell>
                          <TableCell className="p-2"><div className="flex justify-center gap-1.5">{['can_manage_roles', 'can_delete_audit', 'can_config_system', 'can_export_backups'].map(k => <PermissionSwitch key={k} k={k} checked={!!userDelegation[k]} onChange={(v) => handleDelegation(profile.id, k, v)} color="bg-cyan-500" />)}</div></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-6 p-4 bg-slate-900 rounded-2xl border border-white/5 flex items-center gap-4">
                <ShieldAlert className="h-5 w-5 text-orange-500 shrink-0" />
                <p className="text-[10px] text-slate-400 leading-tight">
                  <span className="font-bold text-white uppercase tracking-widest mr-2">Seguridad:</span>
                  Los permisos ROOT y OWNER permiten el acceso total a la infraestructura local. Use con extrema precaución.
                </p>
              </div>
            </TabsContent>

            {/* TABS: INFRAESTRUCTURA (Ajustado) */}
            <TabsContent value="infra" className="m-0 animate-in fade-in zoom-in-95 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-8 border-slate-100 dark:border-white/10 shadow-sm bg-white dark:bg-slate-950 rounded-[2rem] flex flex-col items-center">
                  <h3 className="text-sm font-black mb-6 flex items-center gap-2 text-slate-800 dark:text-white uppercase italic self-start">
                    <Laptop className="h-4 w-4 text-primary" /> Acceso de Red
                  </h3>
                  <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-50 mb-6">
                    <QRCodeSVG value={localUrl} size={180} level="H" includeMargin={true} />
                  </div>
                  <div className="text-center space-y-4 w-full">
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/[0.02] rounded-xl border border-slate-100 dark:border-white/5 w-full">
                      <span className="text-[10px] font-bold uppercase">Visibilidad Móvil</span>
                      <Switch className="scale-90" checked={!!config?.acceso_movil} onCheckedChange={(v) => handleToggle('acceso_movil', v)} />
                    </div>
                    <code className="block text-sm font-mono font-bold text-primary bg-primary/5 px-4 py-2 rounded-lg border border-primary/10">
                      {localUrl}
                    </code>
                  </div>
                </Card>

                <div className="space-y-6">
                  <Card className="p-8 border-blue-500/20 bg-blue-500/5 shadow-sm rounded-[2rem]">
                    <h3 className="text-sm font-black mb-4 flex items-center gap-2 text-blue-500 uppercase italic">
                      <RefreshCw className="h-4 w-4" /> Sincronización
                    </h3>
                    <p className="text-[11px] text-slate-500 mb-6 leading-relaxed">
                      Sincroniza la base de datos local si hay discrepancias en los roles asignados.
                    </p>
                    <Button className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-xs gap-2 transition-all">
                      <RefreshCw className="h-3.5 w-3.5" /> EJECUTAR AHORA
                    </Button>
                  </Card>

                  <div className="p-5 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-white/5 flex gap-4 items-center">
                    <Info className="h-5 w-5 text-blue-500 shrink-0" />
                    <p className="text-[10px] text-slate-500 leading-tight">
                      Sistema local autónomo. No requiere conexión externa para funcionar correctamente.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function PermissionSwitch({ k, checked, onChange, color }: { k: string, checked: boolean, onChange: (v: boolean) => void, color: string }) {
  const details = PERMISSION_DETAILS[k] || { label: "?", desc: "No definido" };
  
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col items-center gap-1 cursor-help group">
            <Switch 
              className={cn("scale-[0.7] transition-all", checked && color)} 
              checked={checked} 
              onCheckedChange={onChange} 
            />
            <span className={cn("text-[8px] font-bold uppercase tracking-tighter opacity-30 group-hover:opacity-100 transition-opacity", checked && "opacity-80")}>
              {details.label}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="p-2 bg-slate-900 text-white border-white/10 shadow-xl text-[10px] rounded-lg">
          {details.desc}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
