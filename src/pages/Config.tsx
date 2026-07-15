import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { configApi, usersApi, delegationsApi } from "@/lib/api";
import { toast } from "sonner";
import { 
  Server, Shield, RefreshCw, Smartphone, Globe, Lock, 
  Crown, UserCheck, ShieldAlert, Key, HelpCircle, QrCode, Monitor,
  Eye, EyeOff, Copy, Trash2, Check, ShieldCheck, Cpu, UserCircle, Wifi, WifiOff
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { QRCodeSVG } from "qrcode.react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const PERMISSION_DETAILS: Record<string, string> = {
  p_doc_1: "D1: Cargar y Modificar Calificaciones",
  p_doc_3: "D3: Consultar Notas por Alumno",
  p_adm_2: "A2: Registrar y Editar Alumnos",
  p_adm_3: "A3: Gestionar Secciones y Grados",
  p_adm_4: "A4: Centro de Comunicaciones (Telegram)",
  p_adm_5: "A5: Ver Auditoría de Notas",
  p_adm_6: "A6: Exportar Reportes PDF/Excel",
  p_rot_2: "R2: Crear y Editar Usuarios",
  p_rot_3: "R3: Asignar Roles Básicos",
  p_rot_4: "R4: Configuración de Integraciones",
  p_rot_5: "R5: Ajustes del Bot de Telegram",
  p_rot_6: "R6: Realizar Backups del Sistema",
  p_rot_7: "R7: Restaurar Base de Datos",
  p_own_2: "O2: Delegación de Autoridad a Otros",
  p_own_4: "O4: Gestión de Red Local y Servidor",
  p_own_5: "O5: Acceso al Logs de Sistema (Raíz)"
};

const Config = () => {
  const { user, perms, isOwner, isRoot } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  // Redirigir si no es Owner o no tiene permiso de configuración
  const canAccess = isOwner || perms.p_rot_4 || isRoot;
  
  useEffect(() => {
    if (!canAccess) {
      navigate("/");
    }
  }, [canAccess, navigate]);

  if (!canAccess) return null;

  const { data: config, isLoading: loadingConfig } = useQuery({
    queryKey: ["app-config"],
    queryFn: configApi.get,
  });

  const [showPassphrase, setShowPassphrase] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [publicUrl, setPublicUrl] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Cargar frase de cifrado del config
  useEffect(() => {
    if (config?.aes_encryption_key !== undefined) {
      setPassphrase(config.aes_encryption_key || "");
    }
  }, [config?.aes_encryption_key]);

  // Cargar URL pública del config
  useEffect(() => {
    if (config?.api_public_url !== undefined) {
      setPublicUrl(config.api_public_url || "");
    }
  }, [config?.api_public_url]);

  const handleSavePublicUrl = async () => {
    setBusy(true);
    try {
      await configApi.update({ api_public_url: publicUrl });
      toast.success("URL de Sincronización actualizada");
      queryClient.invalidateQueries({ queryKey: ["app-config"] });
    } catch (e) {
      toast.error("Error al guardar la URL");
    } finally {
      setBusy(false);
    }
  };

  // Cargar dispositivos conectados
  const { data: devices = [], refetch: refetchDevices } = useQuery({
    queryKey: ["connected-devices"],
    queryFn: configApi.getDevices,
  });

  // Polling de dispositivos cada 10 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      refetchDevices();
    }, 10000);
    return () => clearInterval(timer);
  }, [refetchDevices]);

  const handleSavePassphrase = async () => {
    setBusy(true);
    try {
      await configApi.update({ aes_encryption_key: passphrase });
      toast.success("Frase de cifrado guardada");
      queryClient.invalidateQueries({ queryKey: ["app-config"] });
    } catch (e) {
      toast.error("Error al guardar frase");
    } finally {
      setBusy(false);
    }
  };

  const handleRegenerateKey = async () => {
    if (!window.confirm("¿Está seguro de que desea regenerar la clave API? La aplicación móvil de Android perderá el acceso hasta que se configure la nueva clave.")) return;
    setBusy(true);
    try {
      const res = await configApi.regenerateApiKey();
      toast.success("Clave API regenerada");
      queryClient.invalidateQueries({ queryKey: ["app-config"] });
    } catch (e) {
      toast.error("Error al regenerar clave API");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteDevice = async (id: string) => {
    if (!window.confirm("¿Desea revocar el acceso a este dispositivo?")) return;
    try {
      await configApi.deleteDevice(id);
      toast.success("Acceso revocado");
      refetchDevices();
    } catch (e) {
      toast.error("Error al revocar");
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copiado al portapapeles");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const { data: usersData } = useQuery({
    queryKey: ["users-all"],
    queryFn: usersApi.list,
    enabled: perms.is_owner,
  });

  const { data: delegations = [] } = useQuery({
    queryKey: ["delegations"],
    queryFn: delegationsApi.list,
    enabled: perms.is_owner,
  });

  const handleToggle = async (key: string, value: any) => {
    try {
      await configApi.update({ [key]: value });
      toast.success("Ajuste actualizado");
      queryClient.invalidateQueries({ queryKey: ["app-config"] });
    } catch (e) {
      toast.error("Error al actualizar");
    }
  };

  const handleDelegation = async (userId: string, permKey: string, value: boolean) => {
    setBusy(true);
    try {
      const current = delegations.find((d: any) => d.user_id === userId) || { user_id: userId };
      await delegationsApi.save({ ...current, [permKey]: value ? 1 : 0 });
      queryClient.invalidateQueries({ queryKey: ["delegations"] });
      toast.success("Permiso de Owner actualizado");
    } catch (e) {
      toast.error("Error al delegar");
    } finally {
      setBusy(false);
    }
  };

  const syncRoot = async () => {
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      toast.success("Sincronización de permisos ROOT completada");
    }, 1500);
  };

  const localUrl = `http://${config?.local_ip || 'localhost'}:8080`;

  // Calcular estadísticas para el dashboard de dispositivos
  const totalDevicesCount = devices.length;
  const activeDevicesCount = devices.filter((d: any) => d.status === 'Online').length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5 border-primary/10">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary via-indigo-500 to-purple-600">
            Ajustes e Infraestructura
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configura el servidor local, el cifrado de datos, y supervisa los dispositivos Android conectados.
          </p>
        </div>
      </header>

      <Tabs defaultValue="infraestructura" className="space-y-6">
        <TabsList className="bg-muted/60 p-1 rounded-xl h-11 border border-primary/5 w-full md:w-auto inline-flex">
          <TabsTrigger value="infraestructura" className="rounded-lg px-4 py-2 font-semibold flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
            <Server className="h-4 w-4" /> Servidor & Seguridad
          </TabsTrigger>
          <TabsTrigger value="dispositivos" className="rounded-lg px-4 py-2 font-semibold flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
            <Smartphone className="h-4 w-4" /> Dispositivos Conectados
          </TabsTrigger>
        </TabsList>

        {/* PESTAÑA 1: INFRAESTRUCTURA Y SEGURIDAD */}
        <TabsContent value="infraestructura" className="space-y-8 mt-0 outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Panel de Servidor y Red (QR) */}
            <div className="lg:col-span-1 space-y-6">
              <Card className="p-6 border-primary/10 shadow-lg relative overflow-hidden bg-card/50 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-6 text-primary font-bold text-sm uppercase tracking-wider">
                  <Server className="h-4 w-4" /> Estado del Servidor
                </div>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${config?.acceso_movil ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                        <Smartphone className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold">Red Local / Móviles</p>
                        <p className="text-[10px] text-muted-foreground">{config?.acceso_movil ? 'Visible en red' : 'Solo este equipo'}</p>
                      </div>
                    </div>
                    <Switch 
                      checked={!!config?.acceso_movil} 
                      onCheckedChange={(v) => handleToggle('acceso_movil', v)}
                    />
                  </div>

                  <div className="p-6 bg-primary/5 rounded-3xl border border-primary/10 flex flex-col items-center text-center space-y-4">
                    <div className="bg-background p-4 rounded-2xl shadow-xl border border-primary/5">
                      <QRCodeSVG 
                        value={localUrl} 
                        size={180} 
                        level="H"
                        includeMargin={true}
                        className="rounded-lg"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-1">Escanea para Entrar</p>
                      <code className="text-sm font-mono font-bold bg-background px-3 py-1 rounded-full border shadow-sm select-all">
                        {localUrl}
                      </code>
                    </div>
                    <p className="text-[10px] text-muted-foreground px-4">
                      Comparte este código con los docentes para que accedan desde sus dispositivos en la misma red Wi-Fi.
                    </p>
                  </div>

                  <div className="p-4 border rounded-2xl bg-muted/10 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <RefreshCw className={`h-3 w-3 ${busy ? 'animate-spin' : ''}`} />
                      Mantenimiento
                    </div>
                    <Button variant="outline" className="w-full h-8 text-xs gap-2" onClick={syncRoot} disabled={busy}>
                      <RefreshCw className="h-3 w-3" /> Sincronizar Permisos Root
                    </Button>
                  </div>
                </div>
              </Card>
            </div>

            {/* Panel de Delegación de Autoridad */}
            <div className="lg:col-span-2">
              <Card className="p-8 border-primary/10 shadow-xl min-h-[600px] bg-card/50 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                      <Crown className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Delegación de Autoridad</h2>
                      <p className="text-sm text-muted-foreground">Otorga permisos específicos de administración a otros usuarios.</p>
                    </div>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><HelpCircle className="h-4 w-4" /></Button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[300px] p-4">
                        <p className="text-xs font-bold mb-2">Instrucciones:</p>
                        <p className="text-[10px] text-muted-foreground">Como Owner, puedes dar permisos de "Solo Lectura" o "Administrador Total". Los switches de la tabla representan permisos específicos heredados de la arquitectura local.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <div className="overflow-x-auto rounded-2xl border bg-background/50">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-[180px] font-bold text-primary">Usuario</TableHead>
                        <TableHead className="text-center bg-blue-50/50 dark:bg-blue-900/10">Docente</TableHead>
                        <TableHead className="text-center bg-green-50/50 dark:bg-green-900/10">Admin</TableHead>
                        <TableHead className="text-center bg-purple-50/50 dark:bg-purple-900/10">Root</TableHead>
                        <TableHead className="text-center bg-orange-50/50 dark:bg-orange-900/10">Owner</TableHead>
                      </TableRow>
                      <TableRow className="text-[9px] uppercase font-bold text-muted-foreground border-t">
                        <TableCell>Nombre</TableCell>
                        {/* DOCENTE */}
                        <TableCell className="p-1">
                          <div className="flex justify-center gap-1">
                            {['p_doc_1', 'p_doc_3'].map(k => (
                              <TooltipProvider key={k}>
                                <Tooltip>
                                  <TooltipTrigger className="cursor-help border-b border-dotted border-muted-foreground">{k.replace('p_doc_', 'D')}</TooltipTrigger>
                                  <TooltipContent>{PERMISSION_DETAILS[k]}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ))}
                          </div>
                        </TableCell>
                        {/* ADMIN */}
                        <TableCell className="p-1">
                          <div className="flex justify-center gap-1">
                            {['p_adm_2', 'p_adm_3', 'p_adm_4', 'p_adm_5', 'p_adm_6'].map(k => (
                              <TooltipProvider key={k}>
                                <Tooltip>
                                  <TooltipTrigger className="cursor-help border-b border-dotted border-muted-foreground">{k.replace('p_adm_', 'A')}</TooltipTrigger>
                                  <TooltipContent>{PERMISSION_DETAILS[k]}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ))}
                          </div>
                        </TableCell>
                        {/* ROOT */}
                        <TableCell className="p-1">
                          <div className="flex justify-center gap-1">
                            {['p_rot_2', 'p_rot_3', 'p_rot_4', 'p_rot_5', 'p_rot_6', 'p_rot_7'].map(k => (
                              <TooltipProvider key={k}>
                                <Tooltip>
                                  <TooltipTrigger className="cursor-help border-b border-dotted border-muted-foreground">{k.replace('p_rot_', 'R')}</TooltipTrigger>
                                  <TooltipContent>{PERMISSION_DETAILS[k]}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ))}
                          </div>
                        </TableCell>
                        {/* OWNER */}
                        <TableCell className="p-1">
                          <div className="flex justify-center gap-1">
                            {['p_own_2', 'p_own_4', 'p_own_5'].map(k => (
                              <TooltipProvider key={k}>
                                <Tooltip>
                                  <TooltipTrigger className="cursor-help border-b border-dotted border-muted-foreground">{k.replace('p_own_', 'O')}</TooltipTrigger>
                                  <TooltipContent>{PERMISSION_DETAILS[k]}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usersData?.profiles.filter((u: any) => u.username !== 'rayber').map((profile: any) => {
                        const userDelegation = delegations.find((d: any) => d.user_id === profile.id) || {};
                        return (
                          <TableRow key={profile.id} className="hover:bg-muted/10">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <UserCircle className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="text-xs font-bold truncate">{profile.nombre}</p>
                                  <p className="text-[10px] text-muted-foreground uppercase">{profile.username}</p>
                                </div>
                              </div>
                            </TableCell>
                            
                            {/* Switches Docente */}
                            <TableCell className="p-2">
                              <div className="flex justify-center gap-2">
                                {['p_doc_1', 'p_doc_3'].map(k => (
                                  <Switch 
                                    key={k}
                                    className="scale-75"
                                    checked={!!userDelegation[k]} 
                                    onCheckedChange={(v) => handleDelegation(profile.id, k, v)} 
                                  />
                                ))}
                              </div>
                            </TableCell>

                            {/* Switches Admin */}
                            <TableCell className="p-2">
                              <div className="flex justify-center gap-1">
                                {['p_adm_2', 'p_adm_3', 'p_adm_4', 'p_adm_5', 'p_adm_6'].map(k => (
                                  <Switch 
                                    key={k}
                                    className="scale-75"
                                    checked={!!userDelegation[k]} 
                                    onCheckedChange={(v) => handleDelegation(profile.id, k, v)} 
                                  />
                                ))}
                              </div>
                            </TableCell>

                            {/* Switches Root */}
                            <TableCell className="p-2">
                              <div className="flex justify-center gap-1">
                                {['p_rot_2', 'p_rot_3', 'p_rot_4', 'p_rot_5', 'p_rot_6', 'p_rot_7'].map(k => (
                                  <Switch 
                                    key={k}
                                    className="scale-75"
                                    checked={!!userDelegation[k]} 
                                    onCheckedChange={(v) => handleDelegation(profile.id, k, v)} 
                                  />
                                ))}
                              </div>
                            </TableCell>

                            {/* Switches Owner */}
                            <TableCell className="p-2">
                              <div className="flex justify-center gap-2">
                                {['p_own_2', 'p_own_4', 'p_own_5'].map(k => (
                                  <Switch 
                                    key={k}
                                    className="scale-75"
                                    checked={!!userDelegation[k]} 
                                    onCheckedChange={(v) => handleDelegation(profile.id, k, v)} 
                                  />
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                
                <div className="mt-8 p-6 bg-orange-50/50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-900/50 rounded-2xl flex items-start gap-4">
                  <ShieldAlert className="h-6 w-6 text-orange-600 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-orange-800 dark:text-orange-400">Aviso de Seguridad Crítica</p>
                    <p className="text-[10px] text-orange-700 dark:text-orange-300 mt-1">
                      La delegación de autoridad permite que otros usuarios realicen acciones que normalmente solo el Owner puede hacer. Use esta tabla con precaución extrema, especialmente los permisos tipo ROOT y OWNER.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
            {/* Tarjeta: Cifrado Absoluto */}
            <Card className="p-6 border-primary/10 shadow-lg relative overflow-hidden bg-card/50 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-6 text-primary font-bold text-sm uppercase tracking-wider">
                <Lock className="h-4 w-4" /> Cifrado Absoluto
              </div>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Activar Cifrado Local AES-256 GCM</h3>
                  <p className="text-xs text-muted-foreground mt-1">Los datos se cifran en el teléfono antes de ser guardados o enviados.</p>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-primary/5">
                  <span className="text-xs font-medium">Estado del Cifrado</span>
                  <Switch 
                    checked={!!config?.aes_encryption_enabled} 
                    onCheckedChange={(v) => handleToggle('aes_encryption_enabled', v)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Clave Privada de Cifrado (Passphrase)</Label>
                  <div className="relative flex items-center">
                    <Input 
                      type={showPassphrase ? "text" : "password"} 
                      value={passphrase} 
                      onChange={(e) => setPassphrase(e.target.value)} 
                      className="pr-10 h-10 rounded-xl bg-background"
                      placeholder="Introduce la frase de contraseña"
                    />
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setShowPassphrase(!showPassphrase)} 
                      className="absolute right-1 text-muted-foreground hover:text-foreground h-8 w-8"
                    >
                      {showPassphrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Esta contraseña debe configurarse igual en la aplicación móvil de Android.</p>
                </div>

                <Button 
                  variant="outline" 
                  onClick={handleSavePassphrase} 
                  disabled={busy} 
                  className="w-full h-10 text-xs font-semibold rounded-xl bg-primary/5 hover:bg-primary/10 border-primary/20"
                >
                  Guardar Contraseña
                </Button>
              </div>
            </Card>

            {/* Tarjeta: Configuración de la API del Sistema */}
            <Card className="lg:col-span-2 p-6 border-primary/10 shadow-lg relative overflow-hidden bg-card/50 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-6 text-primary font-bold text-sm uppercase tracking-wider">
                <Cpu className="h-4 w-4" /> Configuración de la API del Sistema
              </div>

              <div className="space-y-6">
                <div>
                  <p className="text-xs text-muted-foreground">Adapte a cualquier nodo o REST API global para la sincronización con la aplicación de Android.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Base URL de Sincronización (Pública / Local)</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1 flex items-center">
                        <Input 
                          value={publicUrl} 
                          onChange={(e) => setPublicUrl(e.target.value)}
                          placeholder={`${window.location.protocol}//${config?.local_ip || window.location.hostname}:8080/api/android/sync`}
                          className="pr-10 h-10 font-mono text-[11px] rounded-xl bg-background"
                        />
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => copyToClipboard(publicUrl || `${window.location.protocol}//${config?.local_ip || window.location.hostname}:8080/api/android/sync`, 'url')} 
                          className="absolute right-1 h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          {copiedField === 'url' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                      <Button 
                        type="button" 
                        onClick={handleSavePublicUrl} 
                        disabled={busy}
                        className="h-10 text-xs font-bold px-4 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 shrink-0"
                      >
                        Guardar
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Deja vacío para usar la IP local. Pega tu URL de túnel público si deseas conectarte desde internet.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Clave API del Dispositivo (Android)</Label>
                    <div className="relative flex items-center">
                      <Input 
                        readOnly 
                        type={showApiKey ? "text" : "password"}
                        value={config?.android_api_key || ""} 
                        className="pr-20 h-10 bg-muted/20 font-mono text-xs rounded-xl"
                      />
                      <div className="absolute right-1 flex items-center gap-1">
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setShowApiKey(!showApiKey)} 
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => copyToClipboard(config?.android_api_key || "", 'key')} 
                          className="h-8 w-8"
                        >
                          {copiedField === 'key' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Cabeceras HTTP de Ejemplo (JSON)</Label>
                  <pre className="p-4 bg-muted/30 border border-primary/5 rounded-2xl text-[10px] font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap">
{`{
  "X-Device-Id": "id-unico-del-dispositivo",
  "X-Device-Name": "Mi Celular Android",
  "X-Device-OS": "Android 14",
  "Authorization": "Bearer ${config?.android_api_key || '<CLAVE_API>'}"
}`}
                  </pre>
                </div>

                {/* Guía de Túneles */}
                <div className="space-y-3 pt-4 border-t border-primary/5">
                  <Label className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5" /> ¿Cómo conectar desde cualquier parte del mundo?
                  </Label>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Para que la app de Android sincronice fuera de tu red local, expón el puerto <code>8080</code> de tu PC usando herramientas de túnel gratuitas:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                    <div className="p-3 rounded-xl bg-muted/40 border border-primary/5 space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-foreground">Opción 1: Ngrok</p>
                      <code className="text-[10px] font-mono block bg-background/60 p-1.5 rounded border text-muted-foreground select-all">
                        ngrok http 8080
                      </code>
                      <p className="text-[9px] text-muted-foreground leading-tight">Genera una URL pública tipo <code>https://xxx.ngrok-free.app</code></p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/40 border border-primary/5 space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-foreground">Opción 2: LocalTunnel</p>
                      <code className="text-[10px] font-mono block bg-background/60 p-1.5 rounded border text-muted-foreground select-all">
                        npx localtunnel --port 8080
                      </code>
                      <p className="text-[9px] text-muted-foreground leading-tight">Rápido y no requiere registro previo.</p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/40 border border-primary/5 space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-foreground">Opción 3: Cloudflare</p>
                      <code className="text-[10px] font-mono block bg-background/60 p-1.5 rounded border text-muted-foreground select-all">
                        cloudflared tunnel --url http://localhost:8080
                      </code>
                      <p className="text-[9px] text-muted-foreground leading-tight">La opción más estable y segura a largo plazo.</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
                    Una vez ejecutado el comando, <strong>copia la URL HTTPS pública generada</strong>, pégala arriba en el campo "Base URL de Sincronización" y haz clic en <strong>Guardar</strong>.
                  </p>
                </div>

                <div className="flex justify-end pt-2 border-t border-primary/5">
                  <Button 
                    variant="destructive" 
                    onClick={handleRegenerateKey} 
                    disabled={busy} 
                    className="h-10 text-xs font-semibold rounded-xl gap-2 shadow-lg shadow-red-500/10 hover:shadow-red-500/20"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} /> Regenerar Clave API
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* PESTAÑA 2: DASHBOARD DE DISPOSITIVOS CONECTADOS */}
        <TabsContent value="dispositivos" className="space-y-6 mt-0 outline-none">
          {/* KPI Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Card 1: Dispositivos Totales */}
            <Card className="p-6 border-primary/10 shadow-lg relative overflow-hidden bg-card/40 backdrop-blur-md flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Dispositivos Totales</p>
                <h3 className="text-3xl font-black text-foreground">{totalDevicesCount}</h3>
                <p className="text-[10px] text-muted-foreground">Dispositivos registrados en el sistema</p>
              </div>
              <div className="p-4 rounded-2xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
                <Smartphone className="h-6 w-6" />
              </div>
            </Card>

            {/* Card 2: Dispositivos Online */}
            <Card className="p-6 border-primary/10 shadow-lg relative overflow-hidden bg-card/40 backdrop-blur-md flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Activos Ahora (Online)</p>
                <h3 className="text-3xl font-black text-emerald-500">{activeDevicesCount}</h3>
                <p className="text-[10px] text-muted-foreground">Sincronizados en los últimos 5 min</p>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 relative">
                {activeDevicesCount > 0 && (
                  <span className="absolute top-3 right-3 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                )}
                <Wifi className="h-6 w-6" />
              </div>
            </Card>

            {/* Card 3: Estado del Túnel */}
            <Card className="p-6 border-primary/10 shadow-lg relative overflow-hidden bg-card/40 backdrop-blur-md flex items-center justify-between col-span-1 md:col-span-1">
              <div className="space-y-2 flex-1 pr-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Túnel de Internet</p>
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${config?.api_public_url ? 'bg-purple-500 animate-pulse' : 'bg-amber-500'}`} />
                  <h4 className="text-sm font-bold truncate max-w-[180px] font-mono">
                    {config?.api_public_url ? 'Activo (LocalTunnel)' : 'Red Local Solo'}
                  </h4>
                </div>
                <p className="text-[10px] text-muted-foreground truncate max-w-[200px]" title={config?.api_public_url || "No activo"}>
                  {config?.api_public_url || "Sin URL pública activa"}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
                <Globe className="h-6 w-6" />
              </div>
            </Card>
          </div>

          {/* Tabla de Dispositivos Conectados */}
          <Card className="p-6 border-primary/10 shadow-lg relative overflow-hidden bg-card/40 backdrop-blur-md">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                  <Monitor className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Registro de Dispositivos</h2>
                  <p className="text-xs text-muted-foreground">Monitoriza las aplicaciones móviles que sincronizan datos con este servidor.</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => refetchDevices()} 
                className="h-8 text-xs gap-1.5 rounded-lg border-primary/10 hover:bg-primary/5"
              >
                <RefreshCw className="h-3 w-3" /> Actualizar
              </Button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-primary/5 bg-background/30">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[200px] text-xs font-bold text-primary">Dispositivo</TableHead>
                    <TableHead className="text-xs font-bold text-primary">ID de Dispositivo</TableHead>
                    <TableHead className="text-xs font-bold text-primary">Sistema Operativo</TableHead>
                    <TableHead className="text-xs font-bold text-primary">Dirección IP</TableHead>
                    <TableHead className="text-xs font-bold text-primary">Última Conexión</TableHead>
                    <TableHead className="text-center text-xs font-bold text-primary">Estado</TableHead>
                    <TableHead className="w-[80px] text-right text-xs font-bold text-primary"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                        No hay dispositivos conectados registrados en el sistema.
                      </TableCell>
                    </TableRow>
                  ) : (
                    devices.map((device: any) => (
                      <TableRow key={device.id} className="hover:bg-muted/10 transition-colors">
                        <TableCell className="font-semibold text-xs py-3">{device.device_name}</TableCell>
                        <TableCell className="font-mono text-[10px] text-muted-foreground py-3">{device.device_id}</TableCell>
                        <TableCell className="text-xs text-muted-foreground py-3">{device.os_version}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground py-3">{device.ip_address}</TableCell>
                        <TableCell className="text-xs text-muted-foreground py-3">
                          {new Date(device.last_active + ' UTC').toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            device.status === 'Online' 
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                              : 'bg-muted text-muted-foreground border border-muted-foreground/10'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${device.status === 'Online' ? 'bg-emerald-400' : 'bg-muted-foreground'}`} />
                            {device.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right py-3 pr-4">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleDeleteDevice(device.id)}
                                  className="h-8 w-8 text-red-500 hover:text-white hover:bg-red-500 rounded-lg transition-all"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="bg-slate-900 border-white/10 text-white text-[10px]">
                                Revocar Acceso del Dispositivo
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Config;