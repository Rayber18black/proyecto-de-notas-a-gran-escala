import React, { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { BookOpen, Plus, Trash2, CheckCircle2, AlertTriangle, ArrowRight, CheckSquare, GraduationCap, History, Search, Download, ChevronDown, ChevronUp } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { GRADOS, ASCENSO_MAP } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { alumnosApi, notasApi, configApi } from "@/lib/api";
import * as XLSX from "xlsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";



type MateriaConfig = {
  nombre: string;
  evaluaciones: number[]; // Un número de evaluaciones por cada lapso
  grados: string[];
};

const parseSub = (val: any) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try { return JSON.parse(val); } catch(e) { return []; }
};

const Academico = () => {
  const [lapsosCount, setLapsosCount] = useState(3);
  const [lapsoActivo, setLapsoActivo] = useState(1);
  const [materias, setMaterias] = useState<MateriaConfig[]>([]);
  
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<MateriaConfig>({ nombre: "", evaluaciones: [4, 4, 4], grados: [] });
  
  const [validating, setValidating] = useState(false);
  
  // Estado para el modal de Cierre de Lapso
  const [showNextLapsoConfig, setShowNextLapsoConfig] = useState(false);
  const [nextLapsoEvals, setNextLapsoEvals] = useState<Record<string, number>>({});
  const [isYearFinalized, setIsYearFinalized] = useState(false);
  const [alumnosIncompletos, setAlumnosIncompletos] = useState<string[]>([]);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  
  // Cierre de Año (Promoción) State
  const [cierreOpen, setCierreOpen] = useState(false);
  const [cierreStep, setCierreStep] = useState(0);
  const [cierreSelection, setCierreSelection] = useState<Record<string, boolean>>({});
  const { isRoot } = useAuth();

  // Historial de Notas de Años Anteriores
  const [showHistoricalDialog, setShowHistoricalDialog] = useState(false);
  const [historicalGrades, setHistoricalGrades] = useState<any[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const [selectedHistYear, setSelectedHistYear] = useState<string>("Todos");
  const [searchQueryHist, setSearchQueryHist] = useState("");

  const fetchHistorical = async () => {
    setLoadingHist(true);
    try {
      const data = await notasApi.getHistorical();
      setHistoricalGrades(data || []);
      
      if (data && data.length > 0) {
        const years = Array.from(new Set(data.map((x: any) => x.anio_escolar))) as string[];
        if (years.length > 0) {
          setSelectedHistYear(years[0]);
        }
      }
    } catch (e: any) {
      toast.error("Error al cargar histórico: " + e.message);
    } finally {
      setLoadingHist(false);
    }
  };

  const histYears = useMemo(() => {
    return Array.from(new Set(historicalGrades.map((x: any) => x.anio_escolar))) as string[];
  }, [historicalGrades]);

  const filteredHistGrades = useMemo(() => {
    return historicalGrades.filter((g: any) => {
      const matchYear = selectedHistYear === "Todos" || g.anio_escolar === selectedHistYear;
      const term = searchQueryHist.toLowerCase().trim();
      const matchSearch = !term || 
        (g.alumno_nombre || "").toLowerCase().includes(term) ||
        (g.alumno_ci || "").toLowerCase().includes(term) ||
        (g.materia || "").toLowerCase().includes(term);
      return matchYear && matchSearch;
    });
  }, [historicalGrades, selectedHistYear, searchQueryHist]);

  const [expandedHistGroups, setExpandedHistGroups] = useState<Record<string, boolean>>({});

  const groupedHistGrades = useMemo(() => {
    const groups: Record<string, {
      key: string;
      anio_escolar: string;
      alumno_nombre: string;
      alumno_ci: string;
      alumno_grado: string;
      alumno_seccion: string;
      notas: any[];
    }> = {};

    filteredHistGrades.forEach((g: any) => {
      const key = `${g.anio_escolar}_${g.alumno_ci}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          anio_escolar: g.anio_escolar,
          alumno_nombre: g.alumno_nombre,
          alumno_ci: g.alumno_ci,
          alumno_grado: g.alumno_grado,
          alumno_seccion: g.alumno_seccion,
          notas: []
        };
      }
      groups[key].notas.push(g);
    });

    return Object.values(groups);
  }, [filteredHistGrades]);

  const toggleHistGroup = (key: string) => {
    setExpandedHistGroups(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const exportHistYearExcel = (year: string) => {
    const rowsToExport = historicalGrades.filter((g: any) => g.anio_escolar === year);
    if (rowsToExport.length === 0) return toast.error("No hay notas para exportar");
    
    const rows = rowsToExport.map((n: any) => ({
      "Año Escolar": n.anio_escolar,
      "Cédula": n.alumno_ci,
      "Nombre": n.alumno_nombre,
      "Grado": n.alumno_grado,
      "Sección": n.alumno_seccion,
      "Materia": n.materia,
      "Lapso 1": n.tramo1,
      "Lapso 2": n.tramo2,
      "Lapso 3": n.tramo3,
      "Promedio Final": n.promedio,
      "Estado": n.estado,
      "Archivado el": new Date(n.created_at).toLocaleDateString()
    }));
    
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Histórico ${year}`);
    XLSX.writeFile(wb, `Historico_Notas_${year}.xlsx`);
    toast.success(`Respaldo Excel generado para el año ${year}`);
  };

  const queryClient = useQueryClient();

  const { data: alumnosRaw = [] } = useQuery({
    queryKey: ["alumnos"],
    queryFn: alumnosApi.list,
  });

  const { data: appConfig } = useQuery({
    queryKey: ["config"],
    queryFn: configApi.get,
  });

  const { data: notas = [] } = useQuery({
    queryKey: ["notas"],
    queryFn: notasApi.list,
  });

  const alumnosConNotas = useMemo(() => {
    return alumnosRaw.map((a: any) => ({
      ...a,
      notas: notas.filter((n: any) => n.alumno_id === a.id)
    }));
  }, [alumnosRaw, notas]);

  useEffect(() => {
    if (appConfig) {
      setLapsosCount(appConfig.lapsos_count || 3);
      const mpg = typeof appConfig.materias_por_grado === 'string' 
        ? JSON.parse(appConfig.materias_por_grado) 
        : appConfig.materias_por_grado;
      
      if (mpg && mpg.version === 2) {
        const mats = (mpg.materias || []).map((m: any) => ({
          ...m,
          evaluaciones: Array.isArray(m.evaluaciones) ? m.evaluaciones : Array.from({length: appConfig.lapsos_count}).map(() => m.evaluaciones || 4)
        }));
        setMaterias(mats);
        setLapsoActivo(mpg.lapso_activo || 1);
        setIsYearFinalized(!!mpg.finalizado);
      }
    }
  }, [appConfig]);

  const saveAppCfg = async (mats = materias, lapso = lapsoActivo, finalizado = isYearFinalized, count = lapsosCount) => {
    const payload = {
      version: 2,
      materias: mats,
      lapso_activo: lapso,
      finalizado: finalizado
    };
    try {
      await configApi.update({
        materias_por_grado: JSON.stringify(payload),
        lapsos_count: count
      });
      queryClient.invalidateQueries({ queryKey: ["config"] });
      toast.success("Configuración académica guardada");
    } catch (e: any) {
      toast.error("Error al guardar: " + e.message);
    }
  };

  const handleLapsosCountChange = (val: string) => {
    const newCount = parseInt(val);
    setLapsosCount(newCount);
    
    // Ajustar el arreglo de evaluaciones de todas las materias
    const newMats = materias.map(m => {
      const evals = [...m.evaluaciones];
      if (evals.length < newCount) {
        while (evals.length < newCount) evals.push(4);
      } else if (evals.length > newCount) {
        evals.splice(newCount);
      }
      return { ...m, evaluaciones: evals };
    });
    
    setMaterias(newMats);
    if (lapsoActivo > newCount) setLapsoActivo(newCount);
    
    saveAppCfg(newMats, lapsoActivo > newCount ? newCount : lapsoActivo, isYearFinalized, newCount);
  };

  const saveMateria = () => {
    if (!form.nombre.trim()) return toast.error("El nombre es requerido");
    if (form.grados.length === 0) return toast.error("Debe seleccionar al menos un grado");
    const newMats = [...materias.filter(m => m.nombre !== form.nombre), form];
    setMaterias(newMats);
    setOpen(false);
    saveAppCfg(newMats, lapsoActivo);
  };

  const removeMateria = (nombre: string) => {
    if (!confirm(`¿Eliminar la materia ${nombre}?`)) return;
    const newMats = materias.filter(m => m.nombre !== nombre);
    setMaterias(newMats);
    saveAppCfg(newMats, lapsoActivo);
  };

  const toggleGrado = (g: string) => {
    setForm(prev => ({
      ...prev,
      grados: prev.grados.includes(g) ? prev.grados.filter(x => x !== g) : [...prev.grados, g]
    }));
  };

  const intentarCierreLapso = async () => {
    if (isYearFinalized) return toast.error("El año ya ha sido finalizado.");
    setValidating(true);
    toast.info("Validando notas de todos los alumnos...");
    
    const allAlumnos = alumnosRaw.filter((a: any) => a.grado !== "Egresado");
    const allNotas = notas;

    if (!allAlumnos || !allNotas) {
      setValidating(false);
      return toast.error("Error al obtener datos");
    }

    let alumnosFaltantes: string[] = [];
    const normalize = (s: string) => (s || "").trim().toLowerCase().replace(/°/g, '').replace(/\s+/g, ' ');

    for (const a of allAlumnos) {
      if (!a.grado) continue;
      const gNormal = normalize(a.grado);
      const materiasAlumno = materias.filter((m: any) => 
        m.grados && m.grados.map(normalize).includes(gNormal)
      );
      
      if (materiasAlumno.length === 0) continue;
      
      let faltan = false;
      let lapsosAValidar = (lapsoActivo === lapsosCount) ? Array.from({length: lapsosCount}, (_, i) => i + 1) : [lapsoActivo];
      let detallesFaltantes: string[] = [];

      for (const m of materiasAlumno) {
        const notaReg = allNotas.find(n => 
          String(n.alumno_id) === String(a.id) && 
          normalize(n.materia) === normalize(m.nombre)
        );

        for (const l of lapsosAValidar) {
          const evalsArr = m.evaluaciones || [4, 4, 4];
          const expected = evalsArr[l - 1] || 4;

          if (!notaReg) {
            faltan = true;
            detallesFaltantes.push(`${m.nombre} [L${l}] (Sin registrar: ${expected} notas)`);
            continue;
          }

          const tramoArr = (notaReg as any)[`t${l}_sub`];
          let subs: any[] = [];
          if (tramoArr) {
            if (Array.isArray(tramoArr)) {
              subs = tramoArr;
            } else {
              try { subs = JSON.parse(tramoArr); } catch(e) {}
            }
          }

          const validSubs = subs.filter(v => v !== null && v !== undefined && String(v).trim() !== "");
          const faltantesCount = Math.max(0, expected - validSubs.length);

          if (faltantesCount > 0) {
            faltan = true;
            detallesFaltantes.push(`${m.nombre} [L${l}] (Faltan ${faltantesCount} de ${expected} notas)`);
          }
        }
      }
      
      if (faltan || detallesFaltantes.length > 0) {
        alumnosFaltantes.push(`${a.nombre} (${a.grado} "${a.seccion || ''}")|${detallesFaltantes.join(", ")}`);
      }
    }


    setValidating(false);

    if (alumnosFaltantes.length > 0) {
      setAlumnosIncompletos(alumnosFaltantes);
      setShowErrorDialog(true);
      return;
    }

    // Si todo es válido
    if (lapsoActivo === lapsosCount) {
      // Es el último lapso, no hay "siguiente" que configurar
      if (confirm("¿Estás seguro de finalizar el año académico? Se ha verificado que TODOS los alumnos tienen sus notas completas en TODOS los lapsos.")) {
        await saveAppCfg(materias, lapsoActivo, true);
        setIsYearFinalized(true);
        toast.success("¡Año Académico Finalizado con éxito!");
      }
      return;
    }


    const defaultEvals: Record<string, number> = {};
    materias.forEach(m => {
      defaultEvals[m.nombre] = m.evaluaciones[lapsoActivo - 1] || 4; 
    });
    setNextLapsoEvals(defaultEvals);
    setShowNextLapsoConfig(true);
  };

  const confirmarCierreLapso = async () => {
    const nextLapso = lapsoActivo + 1;
    const newMats = materias.map(m => {
      const evals = [...m.evaluaciones];
      evals[nextLapso - 1] = nextLapsoEvals[m.nombre] || 4;
      return { ...m, evaluaciones: evals };
    });
    
    await saveAppCfg(newMats, nextLapso);
    setMaterias(newMats);
    setLapsoActivo(nextLapso);
    setShowNextLapsoConfig(false);
    toast.success(`¡Cierre de Lapso completado! Ahora estamos en el Lapso ${nextLapso}`);
  };

  // Lógica de Promoción (Cierre de Año)
  const activeGradoToPromote = GRADOS[cierreStep];
  const alumnosToPromote = alumnosConNotas.filter(a => a.grado === activeGradoToPromote);
  
  const handleSelectAllPromote = () => {
    const allSelected = alumnosToPromote.every(a => cierreSelection[a.id]);
    const newSel = { ...cierreSelection };
    alumnosToPromote.forEach(a => { newSel[a.id] = !allSelected; });
    setCierreSelection(newSel);
  };

  const finalizarYReiniciarCiclo = async () => {
    toast.info("Generando Excel histórico y limpiando registros del año...");
    
    // 1. Export Excel
    const rows = notas.map((n: any) => {
      const alumno = alumnosRaw.find((a: any) => a.id === n.alumno_id) || {};
      return {
        "Cédula": alumno.ci,
        "Nombre": alumno.nombre,
        "Grado": alumno.grado,
        "Materia": n.materia,
        "Lapso 1": n.tramo1,
        "Lapso 2": n.tramo2,
        "Lapso 3": n.tramo3,
        "Promedio Final": n.promedio,
        "Estado": n.estado,
        "Fecha": new Date().toISOString().slice(0, 10)
      };
    });
    
    if (rows.length > 0) {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Histórico");
      XLSX.writeFile(wb, `Historico_Notas_Fin_De_Ano_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    // 2. Clear grades
    try {
      await notasApi.deleteAll();
      toast.success("Calificaciones borradas correctamente.");
    } catch (e: any) {
      toast.error("Error al borrar calificaciones: " + e.message);
    }

    // 3. Reset Lapso to 1 and finalizado to false
    await saveAppCfg(materias, 1, false, lapsosCount);
    setIsYearFinalized(false);
    setLapsoActivo(1);
    
    queryClient.invalidateQueries({ queryKey: ["notas"] });
    queryClient.invalidateQueries({ queryKey: ["alumnos"] });
    queryClient.invalidateQueries({ queryKey: ["config"] });
    toast.success("¡El sistema está listo para un nuevo año académico!");
  };

  const applyPromotionsForCurrentStep = async () => {
    const toPromoteIds = alumnosToPromote.filter(a => cierreSelection[a.id]).map(a => a.id);
    if (toPromoteIds.length > 0) {
      const nextGrado = ASCENSO_MAP[activeGradoToPromote] || "Egresado";
      try {
        for (const id of toPromoteIds) {
          await alumnosApi.save({ id, grado: nextGrado });
        }
      } catch (e: any) {
        return toast.error("Error al promocionar: " + e.message);
      }
    }
    toast.success(`Se procesó el ${activeGradoToPromote}`);
    queryClient.invalidateQueries({ queryKey: ["alumnos"] });
    
    if (cierreStep < GRADOS.length - 1) {
      setCierreStep(cierreStep + 1);
    } else {
      toast.success("¡Promociones Finalizadas!");
      setCierreOpen(false);
      setCierreStep(0);
      setCierreSelection({});
      await finalizarYReiniciarCiclo();
    }
  };

  const startCierre = () => {
    const defaultSel: any = {};
    alumnosConNotas.forEach(a => {
      const nts = a.notas || [];
      const reprobadas = nts.filter((n:any) => n.estado === "Reprobado").length;
      defaultSel[a.id] = nts.length > 0 && reprobadas === 0;
    });
    setCierreSelection(defaultSel);
    setCierreStep(0);
    setCierreOpen(true);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Académico</h1>
          <p className="text-muted-foreground">Gestiona las materias, controla los lapsos y consulta el historial histórico escolar.</p>
        </div>
      </header>

      <Tabs defaultValue="actual" className="w-full space-y-6" onValueChange={(val) => { if(val === "historial") fetchHistorical(); }}>
        <TabsList className="grid w-full grid-cols-2 max-w-md border-primary/20 border">
          <TabsTrigger value="actual" className="font-bold flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Ciclo Activo y Materias
          </TabsTrigger>
          <TabsTrigger value="historial" className="font-bold flex items-center gap-2">
            <History className="h-4 w-4" /> Historial de Años Anteriores
          </TabsTrigger>
        </TabsList>

        <TabsContent value="actual" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6 shadow-[var(--shadow-soft)] border-primary/20 border-2">
              <h2 className="font-semibold mb-4 flex items-center gap-2 text-primary"><BookOpen className="h-5 w-5" /> Control de Lapsos</h2>
              <div className="flex items-center justify-between bg-muted/30 p-4 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Estado del Ciclo</p>
                  <p className="text-4xl font-black text-primary">{isYearFinalized ? "Finalizado" : `Lapso ${lapsoActivo}`}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">Total de lapsos:</span>
                    <Select value={String(lapsosCount)} onValueChange={handleLapsosCountChange} disabled={isYearFinalized}>
                      <SelectTrigger className="h-7 w-20 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6].map(n => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {!isYearFinalized ? (
                  <Button onClick={intentarCierreLapso} disabled={validating} className="font-bold">
                    {validating ? "Validando..." : (lapsoActivo === lapsosCount ? "Finalizar Año" : "Cerrar Lapso")} <ArrowRight className="ml-2 h-4 w-4"/>
                  </Button>
                ) : (
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-success flex items-center font-bold bg-success/10 px-4 py-2 rounded-full text-xs">
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Año Completado
                    </div>
                    {isRoot && (
                      <Button 
                        onClick={startCierre} 
                        variant="default"
                        className="font-bold border-2 border-success animate-pulse shadow-lg bg-success hover:bg-success/90"
                      >
                        <GraduationCap className="h-4 w-4 mr-2" /> ¡Iniciar Cierre de Año!
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Card>
            
            <Card className="p-6 shadow-[var(--shadow-soft)] border border-border/50 flex flex-col justify-between">
              <div>
                <h2 className="font-semibold mb-2 flex items-center gap-2 text-primary">
                  <History className="h-5 w-5" /> Expedientes Archivados
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Visualiza las notas históricas guardadas permanentemente. El sistema registra cada año cursado (desde 1° grado a 5° año) de forma separada y cómoda para la vista.
                </p>
              </div>
              <div className="flex items-center justify-between bg-muted/30 p-3 rounded-lg mt-auto">
                <span className="text-xs text-muted-foreground italic flex items-center gap-1">
                  <CheckSquare className="h-3 w-3 text-success" /> Historial SQLite Activo
                </span>
                <span className="text-xs text-primary font-bold">Usa la pestaña superior ↑</span>
              </div>
            </Card>
          </div>

          <Card className="p-6 shadow-[var(--shadow-soft)]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-semibold flex items-center gap-2"><BookOpen className="h-4 w-4" /> Configuración de Materias</h2>
              <Dialog open={open} onOpenChange={(o) => { 
                setOpen(o); 
                if(!o) setForm({ nombre: "", evaluaciones: Array.from({length: lapsosCount}).fill(4) as number[], grados: [] }); 
              }}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-2"/> Añadir Materia</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader><DialogTitle>{materias.some(m=>m.nombre===form.nombre) ? "Editar" : "Añadir"} Materia</DialogTitle></DialogHeader>
                  <div className="space-y-6 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label>Nombre de la Materia</Label>
                        <Input value={form.nombre} onChange={e=>setForm({...form, nombre: e.target.value})} placeholder="Ej: Inglés" />
                      </div>
                      <div>
                        <Label className="mb-2 block">Evaluaciones (notas) para el Lapso Actual ({lapsoActivo})</Label>
                        <Input type="number" min={1} max={10} value={form.evaluaciones[lapsoActivo - 1] || 4} onChange={e => {
                          const newEvals = [...form.evaluaciones];
                          newEvals[lapsoActivo - 1] = parseInt(e.target.value) || 1;
                          setForm({...form, evaluaciones: newEvals});
                        }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <Label className="block">Cursos/Años que ven esta materia</Label>
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" size="sm" className="h-6 text-xs px-2" onClick={() => setForm({...form, grados: [...GRADOS]})}>Todos</Button>
                          <Button type="button" variant="outline" size="sm" className="h-6 text-xs px-2" onClick={() => setForm({...form, grados: []})}>Ninguno</Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 border p-3 rounded-lg max-h-48 overflow-y-auto">
                        {GRADOS.map(g => (
                          <div key={g} className="flex items-center space-x-2">
                            <Checkbox id={`g-${g}`} checked={form.grados.includes(g)} onCheckedChange={() => toggleGrado(g)} />
                            <label htmlFor={`g-${g}`} className="text-sm cursor-pointer">{g}</label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={saveMateria}>Guardar Materia</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Materia</TableHead>
                    <TableHead>Notas (L1 / L2 / L3)</TableHead>
                    <TableHead>Cursos Asignados</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materias.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Sin materias configuradas</TableCell></TableRow>
                  ) : materias.map(m => (
                    <TableRow key={m.nombre}>
                      <TableCell className="font-bold">{m.nombre}</TableCell>
                      <TableCell>{m.evaluaciones.join(" / ")}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate" title={m.grados.join(", ")}>
                        {m.grados.join(", ")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => { 
                          const evals = [...m.evaluaciones];
                          while(evals.length < lapsosCount) evals.push(4);
                          setForm({...m, evaluaciones: evals}); 
                          setOpen(true); 
                        }}>Editar</Button>
                        <Button size="icon" variant="ghost" onClick={() => removeMateria(m.nombre)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="historial" className="space-y-6">
          <Card className="p-6 shadow-[var(--shadow-soft)] border border-border/50">
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2 text-primary">
                  <History className="h-6 w-6" /> Archivo Histórico de Calificaciones
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Consulta de forma cómoda el expediente completo de notas de periodos escolares anteriores almacenados de forma persistente en SQLite.
                </p>
              </div>

              <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-muted/20 p-4 rounded-xl border border-border/40">
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <Label className="text-sm font-semibold whitespace-nowrap">Año Escolar:</Label>
                  <Select value={selectedHistYear} onValueChange={setSelectedHistYear}>
                    <SelectTrigger className="w-full md:w-[220px] bg-card">
                      <SelectValue placeholder="Seleccionar Año" />
                    </SelectTrigger>
                    <SelectContent>
                      {histYears.length === 0 ? (
                        <SelectItem value="Todos">Sin años archivados</SelectItem>
                      ) : (
                        <>
                          <SelectItem value="Todos">Todos los años</SelectItem>
                          {histYears.map(y => (
                            <SelectItem key={y} value={y}>{y}</SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="relative w-full md:w-[350px]">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por estudiante, cédula o materia..."
                    className="pl-9 bg-card"
                    value={searchQueryHist}
                    onChange={e => setSearchQueryHist(e.target.value)}
                  />
                </div>

                {selectedHistYear !== "Todos" && selectedHistYear !== "Sin años archivados" && histYears.length > 0 && (
                  <Button 
                    onClick={() => exportHistYearExcel(selectedHistYear)}
                    className="w-full md:w-auto bg-success hover:bg-success/90 text-white font-bold border-2 border-success/30 shadow-md"
                  >
                    <Download className="h-4 w-4 mr-2" /> Exportar Excel ({selectedHistYear})
                  </Button>
                )}
              </div>

              <div className="border rounded-xl overflow-hidden shadow-sm bg-card">
                <div className="max-h-[60vh] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10 border-b shadow-sm">
                      <TableRow>
                        <TableHead className="w-[10px]"></TableHead>
                        <TableHead className="font-bold">Año Escolar</TableHead>
                        <TableHead className="font-bold">Estudiante</TableHead>
                        <TableHead className="font-bold">Cédula</TableHead>
                        <TableHead className="font-bold">Curso / Sec</TableHead>
                        <TableHead className="text-right font-bold pr-6">Materias registradas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingHist ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-20 text-muted-foreground text-sm font-semibold animate-pulse">
                            Cargando registros históricos de la base de datos local...
                          </TableCell>
                        </TableRow>
                      ) : groupedHistGrades.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-20 text-muted-foreground text-sm">
                            No se encontraron registros de calificaciones en el historial para los filtros aplicados.
                          </TableCell>
                        </TableRow>
                      ) : (
                        groupedHistGrades.map((group) => {
                          const isExpanded = !!expandedHistGroups[group.key];
                          return (
                            <React.Fragment key={group.key}>
                              <TableRow 
                                className="hover:bg-muted/50 transition-colors border-b cursor-pointer"
                                onClick={() => toggleHistGroup(group.key)}
                              >
                                <TableCell className="p-3 text-center">
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4 text-muted-foreground transition-transform" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
                                  )}
                                </TableCell>
                                <TableCell className="font-bold text-xs text-primary">{group.anio_escolar}</TableCell>
                                <TableCell className="font-extrabold text-xs text-foreground">{group.alumno_nombre}</TableCell>
                                <TableCell className="text-xs text-muted-foreground font-mono">{group.alumno_ci}</TableCell>
                                <TableCell className="text-xs text-muted-foreground font-semibold">{group.alumno_grado} - "{group.alumno_seccion}"</TableCell>
                                <TableCell className="text-right text-xs font-bold text-muted-foreground pr-6">
                                  <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border border-primary/20">
                                    {group.notas.length} {group.notas.length === 1 ? "Materia" : "Materias"}
                                  </span>
                                </TableCell>
                              </TableRow>
                              {isExpanded && (
                                <TableRow className="bg-muted/10 border-b-2 border-primary/20">
                                  <TableCell colSpan={6} className="p-0">
                                    <div className="p-5 bg-gradient-to-b from-muted/30 to-background animate-in slide-in-from-top-2 duration-300">
                                      <div className="overflow-x-auto rounded-xl border bg-background shadow-sm">
                                        <Table className="w-full">
                                          <TableHeader className="bg-muted/50 border-b">
                                            <TableRow>
                                              <TableHead className="font-bold py-3 pl-4">Materia</TableHead>
                                              <TableHead className="text-center font-bold">Lapso 1</TableHead>
                                              <TableHead className="text-center font-bold">Lapso 2</TableHead>
                                              <TableHead className="text-center font-bold">Lapso 3</TableHead>
                                              <TableHead className="text-center font-bold">Promedio</TableHead>
                                              <TableHead className="text-center font-bold">Estado</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {group.notas.map((n: any) => (
                                              <TableRow key={n.id} className="hover:bg-muted/20 border-b">
                                                <TableCell className="font-semibold pl-4 py-3 align-middle">{n.materia}</TableCell>
                                                {[1, 2, 3].map((i) => {
                                                  const subs = parseSub(n[`t${i}_sub`]);
                                                  const matConf = appConfig?.materias?.find((m: any) => m.nombre === n.materia);
                                                  const evalsCount = matConf ? (matConf.evaluaciones?.[i - 1] || 4) : 4;
                                                  const tramoVal = n[`tramo${i}`];
                                                  return (
                                                    <TableCell key={i} className="text-center py-2 align-middle">
                                                      <div className="font-bold text-sm">
                                                        {tramoVal !== null && tramoVal !== undefined ? tramoVal.toFixed(1) : '-'}
                                                      </div>
                                                      <div className="flex justify-center gap-1 mt-1 text-[9px] text-muted-foreground font-semibold">
                                                        {Array.from({ length: evalsCount }).map((_, idx) => {
                                                          const val = subs[idx] !== undefined && subs[idx] !== "" ? subs[idx] : "-";
                                                          return (
                                                            <span 
                                                              key={idx} 
                                                              className="px-1.5 py-0.5 bg-muted/60 text-muted-foreground rounded border border-muted-foreground/10 min-w-[20px] text-center inline-block"
                                                            >
                                                              {val}
                                                            </span>
                                                          );
                                                        })}
                                                      </div>
                                                    </TableCell>
                                                  );
                                                })}
                                                <TableCell className="text-center font-black text-primary font-mono bg-primary/5 align-middle">{n.promedio !== null && n.promedio !== undefined ? n.promedio.toFixed(1) : '-'}</TableCell>
                                                <TableCell className="text-center">
                                                  <span className={`text-[10px] font-black tracking-wide uppercase px-2 py-0.5 rounded ${
                                                    n.estado === "Aprobado" 
                                                      ? "bg-success/15 text-success border border-success/20" 
                                                      : n.estado === "Reprobado" 
                                                      ? "bg-destructive/15 text-destructive border border-destructive/20" 
                                                      : "bg-warning/15 text-warning border border-warning/20"
                                                  }`}>
                                                    {n.estado}
                                                  </span>
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Notas Incompletas
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm mb-4">
              {lapsoActivo === lapsosCount 
                ? "No se puede finalizar el año porque hay alumnos con notas incompletas en uno o más lapsos:" 
                : `Los siguientes alumnos no tienen sus calificaciones completas para el Lapso ${lapsoActivo}:`}
            </p>
            <div className="max-h-60 overflow-y-auto border rounded-lg bg-muted/20 p-3">
              <ul className="space-y-2">
                {alumnosIncompletos.map((item, i) => {
                  const [studentName, details] = item.split("|");
                  return (
                    <li key={i} className="py-1.5 border-b last:border-0 border-border/50">
                      <div className="font-bold text-sm text-foreground">{studentName}</div>
                      <div className="text-xs text-destructive mt-1 pl-2 border-l-2 border-destructive/40 leading-relaxed font-semibold">
                        {details || "Sin notas configuradas"}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowErrorDialog(false)}>Entendido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNextLapsoConfig} onOpenChange={setShowNextLapsoConfig}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configurar Lapso {lapsoActivo + 1}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-muted-foreground">
              ¡Validación exitosa! Todos los alumnos tienen sus notas completas. <br/>
              Antes de iniciar el <strong>Lapso {lapsoActivo + 1}</strong>, ajusta cuántas evaluaciones (sub-notas) tendrá cada materia.
            </p>
            <div className="max-h-64 overflow-y-auto border rounded-lg p-2 space-y-2">
              {materias.map(m => (
                <div key={m.nombre} className="flex justify-between items-center p-2 bg-muted/30 rounded-md">
                  <span className="font-semibold text-sm">{m.nombre}</span>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Evaluaciones:</Label>
                    <Input 
                      type="number" min={1} max={10} className="w-20"
                      value={nextLapsoEvals[m.nombre] || 4}
                      onChange={e => setNextLapsoEvals({...nextLapsoEvals, [m.nombre]: parseInt(e.target.value) || 1})}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNextLapsoConfig(false)}>Cancelar</Button>
            <Button onClick={confirmarCierreLapso}>Confirmar e Iniciar Lapso {lapsoActivo + 1}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cierreOpen} onOpenChange={setCierreOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Asistente de Cierre de Año — {activeGradoToPromote}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Selecciona a los alumnos que han **Aprobado** y serán promovidos a {ASCENSO_MAP[activeGradoToPromote] || "Egresado"}. 
              Los que no selecciones, permanecerán en {activeGradoToPromote} (repitientes).
            </p>
            <div className="flex justify-between items-center mb-2">
              <Button variant="outline" size="sm" onClick={handleSelectAllPromote}><CheckSquare className="h-4 w-4 mr-2" /> Seleccionar Todos / Ninguno</Button>
              <span className="text-sm font-semibold">{alumnosToPromote.length} alumnos en {activeGradoToPromote}</span>
            </div>
            
            <div className="max-h-[50vh] overflow-y-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Ascender</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Sección</TableHead>
                    <TableHead>Estado Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alumnosToPromote.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No hay alumnos en este grado.</TableCell></TableRow>
                  ) : alumnosToPromote.map(a => {
                    const nts = a.notas || [];
                    const reprobadas = nts.filter((n:any) => n.estado === "Reprobado").length;
                    const statusText = nts.length === 0 ? "Sin notas" : reprobadas > 0 ? `${reprobadas} materia(s) reprobada(s)` : "Todo Aprobado";
                    const isWarning = nts.length === 0 || reprobadas > 0;
                    
                    return (
                      <TableRow key={a.id} className={isWarning ? "bg-warning/10" : ""}>
                        <TableCell>
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 cursor-pointer"
                            checked={!!cierreSelection[a.id]}
                            onChange={(e) => setCierreSelection({...cierreSelection, [a.id]: e.target.checked})}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{a.nombre}</TableCell>
                        <TableCell>{a.seccion}</TableCell>
                        <TableCell className={isWarning ? "text-warning font-bold text-xs" : "text-success font-bold text-xs"}>{statusText}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={applyPromotionsForCurrentStep}>
              Procesar y Continuar <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Academico;
