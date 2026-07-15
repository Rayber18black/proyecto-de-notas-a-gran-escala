import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Bot, RefreshCw, Send, MessageSquare, CheckCircle2, Settings, Users, Search, Filter, Reply, X, Video, Bookmark, Save, Trash2, Target, ChevronDown, UserCircle, Plus, UserCheck, Download } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { sugerenciasApi, botApi, alumnosApi, plantillasApi } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { GRADOS, SECCIONES } from "@/lib/constants";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

const Comunicaciones = () => {
  const { perms } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [expandedSug, setExpandedSug] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyMsg, setReplyMsg] = useState("");
  
  // Estados para Segmentación (Ahora en Popover con Multiselección)
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [selectedGrado, setSelectedGrado] = useState("");
  const [selectedSeccion, setSelectedSeccion] = useState("");
  const [searchAlumno, setSearchAlumno] = useState("");
  const [selectedAlumnos, setSelectedAlumnos] = useState<any[]>([]);

  // Estados para Plantillas
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateTitle, setTemplateTitle] = useState("");

  // Estados para Configuración del Bot
  const [botForm, setBotForm] = useState({ telegram_token: "", telegram_chat_id: "", enabled: false });

  // Redirigir si no tiene permiso básico de Comunicaciones
  if (!perms.p_rot_5 && !perms.p_adm_4) {
    navigate("/");
    return null;
  }

  const { data: sugerencias = [], isLoading: loadingSug } = useQuery({
    queryKey: ["sugerencias"],
    queryFn: sugerenciasApi.list,
  });

  const { data: alumnos = [] } = useQuery({
    queryKey: ["alumnos-comunicaciones"],
    queryFn: alumnosApi.list,
  });

  const { data: plantillas = [], isLoading: loadingPlantillas } = useQuery({
    queryKey: ["plantillas"],
    queryFn: plantillasApi.list,
  });

  const { data: botConfig } = useQuery({
    queryKey: ["bot-config"],
    queryFn: botApi.get,
    enabled: perms.p_rot_5,
  });

  // Efecto para auto-expandir textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [broadcastMsg]);

  useEffect(() => {
    if (botConfig) {
      setBotForm({
        telegram_token: botConfig.telegram_token || "",
        telegram_chat_id: botConfig.telegram_chat_id || "",
        enabled: !!botConfig.enabled
      });
    }
  }, [botConfig]);

  const filteredAlumnos = useMemo(() => {
    if (!searchAlumno) return [];
    return alumnos.filter((a: any) => 
      (a.nombre.toLowerCase().includes(searchAlumno.toLowerCase()) || 
      a.ci.includes(searchAlumno)) &&
      !selectedAlumnos.find(sel => sel.id === a.id)
    ).slice(0, 5);
  }, [searchAlumno, alumnos, selectedAlumnos]);

  const getFiltroLabel = () => {
    if (filtroTipo === 'todos') return "Todos los Representantes";
    if (filtroTipo === 'grado') return selectedGrado || "Seleccionar Grado";
    if (filtroTipo === 'seccion') return selectedSeccion ? `${selectedGrado} "${selectedSeccion}"` : "Seleccionar Sección";
    if (filtroTipo === 'alumno') {
      if (selectedAlumnos.length === 0) return "Seleccionar Alumnos";
      if (selectedAlumnos.length === 1) return selectedAlumnos[0].nombre;
      return `${selectedAlumnos.length} Alumnos seleccionados`;
    }
    return "Seleccionar Destino";
  };

  const handleBroadcast = async () => {
    if (!broadcastMsg.trim()) return toast.error("El mensaje no puede estar vacío");
    
    let valor = "";
    let label = "Todos";

    if (filtroTipo === 'grado') {
      if (!selectedGrado) return toast.error("Selecciona un grado");
      valor = selectedGrado;
      label = `Grado: ${selectedGrado}`;
    } else if (filtroTipo === 'seccion') {
      if (!selectedGrado || !selectedSeccion) return toast.error("Selecciona grado y sección");
      valor = `${selectedGrado}|${selectedSeccion}`;
      label = `Sección: ${selectedGrado} "${selectedSeccion}"`;
    } else if (filtroTipo === 'alumno') {
      if (selectedAlumnos.length === 0) return toast.error("Selecciona al menos un alumno");
      valor = selectedAlumnos.map(a => a.id).join(',');
      label = `${selectedAlumnos.length} Alumnos seleccionados`;
    }

    if (!confirm(`¿Enviar este comunicado a: ${label}?`)) return;
    
    setBusy(true);
    try {
      const res = await botApi.broadcast({
        mensaje: broadcastMsg,
        filtro: filtroTipo,
        valor
      });
      toast.success(`Mensaje enviado a ${res.sent} chats exitosamente`);
      setBroadcastMsg("");
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Error al enviar el comunicado");
    } finally {
      setBusy(false);
    }
  };

  const handleReply = async (chatId: string) => {
    if (!replyMsg.trim()) return toast.error("La respuesta no puede estar vacía");
    setBusy(true);
    try {
      await sugerenciasApi.reply({ chat_id: chatId, respuesta: replyMsg });
      toast.success("Respuesta enviada al representante");
      setReplyMsg("");
      setReplyingTo(null);
    } catch (e: any) {
      toast.error("Error al enviar respuesta");
    } finally {
      setBusy(false);
    }
  };

  const saveTemplate = async () => {
    if (!templateTitle.trim() || !broadcastMsg.trim()) return toast.error("Título y mensaje son obligatorios");
    setBusy(true);
    try {
      await plantillasApi.save({ titulo: templateTitle, mensaje: broadcastMsg });
      toast.success("Plantilla guardada correctamente");
      setTemplateTitle("");
      setSavingTemplate(false);
      queryClient.invalidateQueries({ queryKey: ["plantillas"] });
    } catch (e: any) {
      toast.error("Error al guardar plantilla");
    } finally {
      setBusy(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("¿Eliminar esta plantilla?")) return;
    try {
      await plantillasApi.delete(id);
      queryClient.invalidateQueries({ queryKey: ["plantillas"] });
      toast.success("Plantilla eliminada");
    } catch (e: any) {
      toast.error("Error al eliminar");
    }
  };

  const saveBot = async () => {
    setBusy(true);
    try {
      await botApi.update(botForm);
      toast.success("Configuración del bot guardada");
      queryClient.invalidateQueries({ queryKey: ["bot-config"] });
    } catch (e: any) {
      toast.error("Error al guardar bot: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const testBot = async () => {
    if (!botForm.telegram_token || !botForm.telegram_chat_id) return toast.error("Configura el token y el chat id primero");
    setBusy(true);
    try {
      await botApi.test();
      toast.success("Mensaje de prueba enviado exitosamente");
    } catch (e: any) {
      toast.error(e.message || "Error al probar bot");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSugerencia = async (id: string) => {
    if (!confirm("¿Eliminar esta sugerencia?")) return;
    try {
      await sugerenciasApi.delete(id);
      queryClient.invalidateQueries({ queryKey: ["sugerencias"] });
      toast.success("Sugerencia eliminada");
    } catch (e: any) {
      toast.error("Error al eliminar");
    }
  };

  const addAlumno = (alumno: any) => {
    if (!selectedAlumnos.find(a => a.id === alumno.id)) {
      setSelectedAlumnos([...selectedAlumnos, alumno]);
    }
    setSearchAlumno("");
  };

  const removeAlumno = (id: string) => {
    setSelectedAlumnos(selectedAlumnos.filter(a => a.id !== id));
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Comunicaciones & Centro de Control</h1>
        <p className="text-muted-foreground">Sistema avanzado de mensajería escolar y feedback.</p>
      </header>

      <Tabs defaultValue="broadcast" className="space-y-6">
        <TabsList className="w-full flex overflow-x-auto justify-start sm:justify-center bg-muted/50 p-1 rounded-xl whitespace-nowrap scrollbar-none">
          <TabsTrigger value="broadcast" className="gap-2 rounded-lg px-6 shrink-0">
            <Send className="h-4 w-4" /> Enviar Mensajes
          </TabsTrigger>
          <TabsTrigger value="sugerencias" className="gap-2 rounded-lg px-6 shrink-0">
            <MessageSquare className="h-4 w-4" /> Sugerencias
          </TabsTrigger>
          {perms.p_rot_5 && (
            <TabsTrigger value="config" className="gap-2 rounded-lg px-6 shrink-0">
              <Settings className="h-4 w-4" /> Ajustes del Bot
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="broadcast" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            
            {/* Columna Izquierda: PLANTILLAS FIJAS */}
            <div className="lg:col-span-1 space-y-6 order-2 lg:order-1">
              <Card className="p-6 border-primary/10 shadow-sm flex flex-col h-[600px]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider">
                    <Bookmark className="h-4 w-4" /> Plantillas Fijas
                  </div>
                  {loadingPlantillas && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {plantillas.length === 0 && !loadingPlantillas && (
                    <div className="text-center py-10 opacity-30">
                      <Bookmark className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-[10px] italic">No hay mensajes guardados.</p>
                    </div>
                  )}
                  {plantillas.map((p: any) => (
                    <div key={p.id} className="group relative flex items-center gap-2 p-3 rounded-xl border bg-muted/20 hover:bg-muted/40 transition-all border-transparent hover:border-primary/20 cursor-pointer"
                        onClick={() => {
                          setBroadcastMsg(p.mensaje);
                          toast.info(`Plantilla cargada`);
                        }}
                    >
                      <div className="flex-1 overflow-hidden">
                        <p className="text-xs font-bold truncate">{p.titulo}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{p.mensaje}</p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTemplate(p.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 pt-4 border-t text-[10px] text-muted-foreground italic flex gap-2 items-center">
                  <Users className="h-3 w-3" /> Solo registrados recibirán mensajes.
                </div>
              </Card>
            </div>

            {/* Columna Derecha: Redacción y Segmentación Desplegable */}
            <Card className="lg:col-span-3 p-8 border-primary/10 shadow-sm flex flex-col relative overflow-hidden order-1 lg:order-2">
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Redactar Comunicado</h2>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                    {/* SEGMENTACIÓN DESPLEGABLE CON MULTISELECCIÓN */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9 gap-2 bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 rounded-full px-4 shrink-0">
                          <Target className="h-4 w-4" />
                          <span className="max-w-[120px] sm:max-w-[150px] truncate">{getFiltroLabel()}</span>
                          <ChevronDown className="h-3 w-3 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[calc(100vw-32px)] sm:w-[350px] p-5 space-y-4 shadow-2xl border-primary/10" align="end">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase text-muted-foreground">Tipo de Destino</Label>
                          <Select value={filtroTipo} onValueChange={(v) => {
                            setFiltroTipo(v);
                            if (v !== 'alumno') setSelectedAlumnos([]);
                          }}>
                            <SelectTrigger className="h-9 bg-muted/30">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todos">Todos los Representantes</SelectItem>
                              <SelectItem value="grado">Por Grado / Año</SelectItem>
                              <SelectItem value="seccion">Por Sección Específica</SelectItem>
                              <SelectItem value="alumno">Estudiantes Individuales</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {(filtroTipo === 'grado' || filtroTipo === 'seccion') && (
                          <div className="space-y-2 animate-in slide-in-from-top-1">
                            <Label className="text-[10px] font-bold uppercase text-muted-foreground">Grado / Año</Label>
                            <Select value={selectedGrado} onValueChange={setSelectedGrado}>
                              <SelectTrigger className="h-9 bg-muted/30">
                                <SelectValue placeholder="Seleccionar..." />
                              </SelectTrigger>
                              <SelectContent>
                                {GRADOS.filter(g => g !== "Egresado").map(g => (
                                  <SelectItem key={g} value={g}>{g}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {filtroTipo === 'seccion' && (
                          <div className="space-y-2 animate-in slide-in-from-top-1">
                            <Label className="text-[10px] font-bold uppercase text-muted-foreground">Sección</Label>
                            <Select value={selectedSeccion} onValueChange={setSelectedSeccion}>
                              <SelectTrigger className="h-9 bg-muted/30">
                                <SelectValue placeholder="Seleccionar..." />
                              </SelectTrigger>
                              <SelectContent>
                                {SECCIONES.map(s => (
                                  <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {filtroTipo === 'alumno' && (
                          <div className="space-y-4 animate-in slide-in-from-top-1">
                            <div className="space-y-2">
                              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Añadir Estudiantes (Multiselección)</Label>
                              <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input 
                                  placeholder="Escribe nombre o CI..." 
                                  className="pl-8 h-9 bg-muted/30 text-xs"
                                  value={searchAlumno}
                                  onChange={(e) => setSearchAlumno(e.target.value)}
                                />
                              </div>
                              
                              {filteredAlumnos.length > 0 && (
                                <div className="border rounded-lg overflow-hidden bg-background shadow-md max-h-[120px] overflow-y-auto mt-1 border-primary/10">
                                  {filteredAlumnos.map((a: any) => (
                                    <button
                                      key={a.id}
                                      className="w-full text-left p-2 text-[10px] hover:bg-primary/5 border-b last:border-0 flex items-center justify-between group"
                                      onClick={() => addAlumno(a)}
                                    >
                                      <div>
                                        <span className="font-bold text-primary">{a.nombre}</span>
                                        <span className="ml-2 text-muted-foreground font-mono">{a.ci}</span>
                                      </div>
                                      <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100 text-primary" />
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            {selectedAlumnos.length > 0 && (
                              <div className="space-y-2 pt-2 border-t">
                                <Label className="text-[9px] font-bold uppercase text-muted-foreground">Seleccionados ({selectedAlumnos.length})</Label>
                                <div className="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto p-1">
                                  {selectedAlumnos.map((a: any) => (
                                    <Badge 
                                      key={a.id} 
                                      variant="secondary" 
                                      className="gap-1 px-2 py-0.5 text-[9px] bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                                    >
                                      {a.nombre}
                                      <X className="h-2 w-2 cursor-pointer hover:text-destructive" onClick={() => removeAlumno(a.id)} />
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div className="pt-2 border-t">
                           <p className="text-[9px] text-muted-foreground text-center italic">Ajusta los destinatarios y el panel se guardará solo.</p>
                        </div>
                      </PopoverContent>
                    </Popover>
                    
                    <Button 
                       variant="ghost" 
                       size="sm" 
                       className={`h-9 gap-2 text-[10px] font-bold uppercase rounded-full px-4 shrink-0 ${savingTemplate ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-primary hover:bg-primary/5'}`}
                       onClick={() => setSavingTemplate(!savingTemplate)}
                       disabled={!broadcastMsg.trim()}
                    >
                       <Save className="h-3.5 w-3.5" /> <span className="hidden xs:inline">{savingTemplate ? "Cancelar" : "Fijar Mensaje"}</span><span className="xs:hidden">{savingTemplate ? "Cancelar" : "Fijar"}</span>
                    </Button>
                  </div>
                </div>

                {savingTemplate && (
                  <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-2xl animate-in slide-in-from-top-2">
                    <Label className="text-[10px] font-bold uppercase mb-2 block">Título de la Plantilla:</Label>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Ej: Aviso de Suspensión, Nueva Tarea..." 
                        value={templateTitle}
                        onChange={(e) => setTemplateTitle(e.target.value)}
                        className="h-10 bg-background"
                        autoFocus
                      />
                      <Button size="sm" className="h-10 px-6 shadow-md" onClick={saveTemplate} disabled={busy}>Guardar</Button>
                    </div>
                  </div>
                )}
                
                <Textarea
                  ref={textareaRef}
                  placeholder="Escribe aquí el contenido del comunicado..."
                  className="min-h-[100px] text-lg resize-none mb-6 p-6 border-none shadow-inner bg-muted/5 focus-visible:ring-primary/5 transition-all rounded-2xl overflow-hidden"
                  value={broadcastMsg}
                  onChange={(e) => setBroadcastMsg(e.target.value)}
                  rows={1}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-muted/5 p-4 rounded-2xl border border-dashed border-primary/10 mt-auto">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
                    <Target className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Destinatarios Seleccionados:</p>
                    <p className="text-sm font-bold text-primary truncate max-w-[280px] sm:max-w-[400px]">{getFiltroLabel()}</p>
                  </div>
                </div>
                
                <Button onClick={handleBroadcast} disabled={busy || !broadcastMsg.trim()} size="lg" className="w-full sm:w-auto gap-3 px-10 h-12 shadow-xl shadow-primary/20 rounded-xl font-bold transition-all hover:scale-105 active:scale-95 justify-center">
                  <Send className={`h-5 w-5 ${busy ? 'animate-bounce' : ''}`} /> 
                  {busy ? "Enviando..." : "Enviar a Telegram"}
                </Button>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sugerencias" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex flex-col h-[600px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Buzón de Sugerencias</h2>
              <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["sugerencias"] })}>
                <RefreshCw className={`h-4 w-4 ${loadingSug ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {loadingSug && <p className="text-sm text-center py-10 text-muted-foreground">Cargando buzón...</p>}
              
              {!loadingSug && sugerencias.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground opacity-30 py-20">
                  <Bot className="h-16 w-16 mb-4" />
                  <p>No hay sugerencias nuevas.</p>
                </div>
              )}

              {sugerencias.map((s: any) => {
                const isExpanded = expandedSug === s.id;
                const isReplying = replyingTo === s.id;
                const canReply = !!s.chat_id;
                
                return (
                  <div 
                    key={s.id} 
                    className={`border rounded-xl cursor-pointer transition-all overflow-hidden ${isExpanded ? 'bg-card border-primary/30 shadow-md' : 'bg-muted/10 hover:bg-muted/30 border-transparent'}`}
                    onClick={() => {
                      setExpandedSug(isExpanded ? null : s.id);
                      if (isExpanded) setReplyingTo(null);
                    }}
                  >
                    <div className={`p-4 flex justify-between items-start gap-4 ${isExpanded ? 'border-b pb-3' : ''}`}>
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="h-2.5 w-2.5 rounded-full bg-orange-500 animate-pulse mt-1.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {s.alumno_nombre ? (
                              <>
                                <span className="font-extrabold text-sm text-foreground flex items-center gap-1.5">
                                  <UserCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                                  {s.alumno_nombre}
                                </span>
                                <Badge variant="outline" className="text-[10px] py-0.5 text-muted-foreground border-muted-foreground/20 font-bold bg-background/50">
                                  🎓 {s.alumno_grado} - {s.alumno_seccion || "Sin Secc."}
                                </Badge>
                                <Badge variant="outline" className="text-[10px] py-0.5 font-mono text-muted-foreground border-muted-foreground/20 font-bold bg-background/50">
                                  🪪 {s.alumno_ci || "CI N/A"}
                                </Badge>
                                <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10 text-[10px] py-0.5 font-bold">
                                  Representante: {s.nombre}
                                </Badge>
                              </>
                            ) : (
                              <>
                                <span className="font-bold text-sm text-primary">
                                  {s.nombre}
                                </span>
                                <Badge variant="outline" className="text-[10px] py-0.5 text-muted-foreground font-semibold">
                                  No Vinculado
                                </Badge>
                              </>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 truncate max-w-[280px] sm:max-w-[400px] lg:max-w-[600px]">
                            {s.mensaje || "(Foto/Video sin mensaje)"}
                          </div>
                        </div>
                      </div>
                      <div className="text-[10px] bg-muted px-2 py-1 rounded-md text-muted-foreground font-medium shrink-0 whitespace-nowrap self-start mt-0.5 border dark:border-white/5 shadow-sm">
                        {new Date(s.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="p-4 bg-muted/5 animate-in slide-in-from-top-2 duration-200 space-y-4">

                        {s.mensaje && (
                          <p className="text-sm text-foreground/90 leading-relaxed bg-background p-4 rounded-xl border shadow-sm">
                            {s.mensaje}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-4 mb-4" onClick={(e) => e.stopPropagation()}>
                          {s.foto_path && (
                            <div className="border rounded-xl p-3 bg-background flex flex-col items-center gap-3">
                              <img 
                                src={s.foto_path} 
                                className="max-h-[300px] rounded-lg cursor-zoom-in" 
                                onClick={(e) => { e.stopPropagation(); window.open(s.foto_path, '_blank'); }}
                              />
                              <a 
                                href={s.foto_path} 
                                download={`sugerencia_foto_${(s.alumno_nombre || s.nombre).replace(/\s+/g, '_')}_${s.id}.jpg`}
                                className="w-full text-center text-xs bg-primary text-primary-foreground font-bold px-4 py-2 rounded-lg shadow-md hover:bg-primary/95 flex items-center justify-center gap-1.5 cursor-pointer transition-transform active:scale-95"
                              >
                                <Download className="h-4 w-4" /> Descargar Imagen
                              </a>
                            </div>
                          )}

                          {s.video_path && (
                            <div className="border rounded-xl p-3 bg-background flex flex-col items-center gap-3">
                              <video 
                                src={s.video_path} 
                                controls 
                                className="max-h-[300px] rounded-lg" 
                              />
                              <a 
                                href={s.video_path} 
                                download={`sugerencia_video_${(s.alumno_nombre || s.nombre).replace(/\s+/g, '_')}_${s.id}.mp4`}
                                className="w-full text-center text-xs bg-primary text-primary-foreground font-bold px-4 py-2 rounded-lg shadow-md hover:bg-primary/95 flex items-center justify-center gap-1.5 cursor-pointer transition-transform active:scale-95"
                              >
                                <Download className="h-4 w-4" /> Descargar Video
                              </a>
                            </div>
                          )}
                        </div>

                        {isReplying && (
                          <div className="mb-4 animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-2">
                              <Label className="text-[10px] font-bold uppercase text-primary">Escribir Respuesta:</Label>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setReplyingTo(null)}><X className="h-3 w-3" /></Button>
                            </div>
                            <Textarea 
                              className="min-h-[100px] text-sm mb-2"
                              placeholder="Escribe aquí tu respuesta para el representante..."
                              value={replyMsg}
                              onChange={(e) => setReplyMsg(e.target.value)}
                            />
                            <Button size="sm" className="w-full gap-2" onClick={() => handleReply(s.chat_id)} disabled={busy}>
                              <Send className="h-3 w-3" /> Enviar Respuesta
                            </Button>
                          </div>
                        )}

                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          {!isReplying && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              disabled={!canReply}
                              className="h-8 gap-2 border-primary/20 text-primary hover:bg-primary/5"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!canReply) return toast.info("No se puede responder a sugerencias antiguas.");
                                setReplyingTo(s.id);
                              }}
                            >
                              <Reply className="h-4 w-4" />
                              {canReply ? "Responder" : "No respondible"}
                            </Button>
                          )}
                          <Button 
                            variant="default" 
                            size="sm" 
                            className="h-8 gap-2 bg-primary hover:bg-primary/90" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSugerencia(s.id);
                            }}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Marcar Leída
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {perms.p_rot_5 && (
          <TabsContent value="config" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Card className="p-8 shadow-[var(--shadow-soft)] max-w-3xl border-primary/10">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                  <Settings className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Configuración Técnica</h2>
                  <p className="text-sm text-muted-foreground">Conecta el sistema con la API de Telegram.</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase font-bold text-muted-foreground">Token del Bot (API)</Label>
                    <Input 
                      type="password" 
                      placeholder="Ej: 123456:ABC-DEF..." 
                      className="bg-muted/30"
                      value={botForm.telegram_token}
                      onChange={(e) => setBotForm({ ...botForm, telegram_token: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase font-bold text-muted-foreground">ID de Grupo/Canal Destino</Label>
                    <Input 
                      placeholder="Ej: -100123456789" 
                      className="bg-muted/30"
                      value={botForm.telegram_chat_id}
                      onChange={(e) => setBotForm({ ...botForm, telegram_chat_id: e.target.value })}
                    />
                  </div>
                </div>

                <div className="p-6 border rounded-2xl bg-primary/5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Switch 
                      checked={botForm.enabled} 
                      onCheckedChange={(v) => setBotForm({ ...botForm, enabled: v })}
                    />
                    <div>
                      <p className="font-bold text-sm">Estado del Motor de Telegram</p>
                      <p className="text-xs text-muted-foreground">
                        {botForm.enabled ? "✅ El sistema está procesando mensajes en tiempo real." : "❌ El bot está apagado."}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <Button variant="outline" size="sm" onClick={testBot} disabled={busy || !botForm.enabled} className="flex-1 md:flex-none justify-center h-9">
                      Probar Conexión
                    </Button>
                    <Button size="sm" onClick={saveBot} disabled={busy} className="flex-1 md:flex-none justify-center h-9 bg-primary hover:bg-primary/90 text-white font-bold">
                      Guardar Cambios
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Comunicaciones;
