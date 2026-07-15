import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

import { useAuth } from "@/hooks/useAuth";
import { CheckCircle2, XCircle, ShieldCheck, Pencil, X, Save, Send, History, Filter, Download, Upload, FileSpreadsheet, Trash2, Plus, Search, Eraser, ChevronDown, ChevronUp } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { translateError, generateId } from "@/lib/utils";
import * as XLSX from "xlsx";
import { logAudit } from "@/utils/audit";
import { GRADOS, SECCIONES } from "@/lib/constants";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notasApi, alumnosApi, configApi, auditApi, botApi } from "@/lib/api";



const parseSub = (val: any) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try { return JSON.parse(val); } catch(e) { return []; }
};

const Notas = () => {
  const { isAdmin, isStaff, isRoot, profile, roles } = useAuth();
  const queryClient = useQueryClient();

  // 1. Consulta reactiva de notas con JOIN local a alumnos
  const { data: notasRaw = [] } = useQuery({
    queryKey: ["notas"],
    queryFn: notasApi.list,
    refetchInterval: 3000,
  });

  // Formateamos las notas para que coincidan con la estructura antigua
  const notas = useMemo(() => notasRaw.map((n: any) => ({
    ...n,
    alumnos: { nombre: n.alumno_nombre, ci: n.alumno_ci, grado: n.alumno_grado, seccion: n.alumno_seccion }
  })), [notasRaw]);

  // 2. Consulta reactiva de alumnos
  const { data: alumnos = [] } = useQuery({
    queryKey: ["alumnos"],
    queryFn: alumnosApi.list,
    refetchInterval: 5000,
  });

  // 3. Consulta reactiva de configuración
  const { data: appConfig } = useQuery({
    queryKey: ["config"],
    queryFn: configApi.get,
    refetchInterval: 10000,
  });
  
  const appCfg = useMemo(() => {
    if (!appConfig) return { lapsos_count: 3, lapso_activo: 1, materias: [], consultas_habilitadas: false, publicaciones_habilitadas: false };
    
    let mpg = appConfig.materias_por_grado;
    if (typeof mpg === 'string') try { mpg = JSON.parse(mpg); } catch(e) {}
    
    let materias: any[] = [];
    let lapsoActivo = 1;
    
    if (mpg && mpg.version === 2) {
      materias = mpg.materias || [];
      lapsoActivo = mpg.lapso_activo || 1;
    } else if (mpg) {
      const legacyMap: any = mpg;
      const matSet = new Set<string>();
      Object.values(legacyMap).forEach((list: any) => list.forEach((m:string)=>matSet.add(m)));
      materias = Array.from(matSet).map(m => {
        const gs = Object.keys(legacyMap).filter(g => legacyMap[g].includes(m));
        return { nombre: m, evaluaciones: [4,4,4], grados: gs };
      });
    }

    return {
      ...appConfig,
      materias,
      lapso_activo: lapsoActivo,
      consultas_habilitadas: !!appConfig.consultas_habilitadas,
      publicaciones_habilitadas: !!appConfig.publicaciones_habilitadas
    };
  }, [appConfig]);

  const { data: audit = [] } = useQuery({
    queryKey: ["audit"],
    queryFn: auditApi.list,
    refetchInterval: 30000,
  });

  const [form, setForm] = useState<any>({ alumno_id: "", materia: "", t1_sub: [], t2_sub: [], t3_sub: [] });
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [filtroGrado, setFiltroGrado] = useState("Todos");
  const [filtroSeccion, setFiltroSeccion] = useState("Todos");
  const [filtroMateria, setFiltroMateria] = useState("Todos");
  const [diagGrado, setDiagGrado] = useState("Todos");
  const [diagSeccion, setDiagSeccion] = useState("Todos");
  const [diagSearch, setDiagSearch] = useState("");
  const [diagSearchMateria, setDiagSearchMateria] = useState("");
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());

  const toggleStudent = (id: string) => {
    const next = new Set(expandedStudents);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedStudents(next);
  };

  const updateAppConfig = async (field: string, val: any) => {
    try {
      await configApi.update({ [field]: val });
      queryClient.invalidateQueries({ queryKey: ["config"] });
      toast.success("Configuración actualizada");
    } catch (e: any) {
      toast.error("Error al actualizar config: " + e.message);
    }
  };

  const updateLapsos = async (val: string) => {
    const n = parseInt(val);
    updateAppConfig("lapsos_count", n);
  };


  const calcTramo = (sub: any[]) => {
    const valid = (sub || []).map(v => parseFloat(v)).filter(v => !isNaN(v));
    if (valid.length === 0) return 0;
    const sum = valid.reduce((a, b) => a + b, 0);
    return Number((sum / valid.length).toFixed(2));
  };

  const promedio = useMemo(() => {
    const selectedMateriaConfig = (appCfg.materias || []).find((m: any) => m.nombre === form.materia);
    const evaluacionesArr = selectedMateriaConfig ? selectedMateriaConfig.evaluaciones : [4,4,4];

    const t1 = calcTramo((form.t1_sub || []).slice(0, evaluacionesArr[0] || 4));
    const t2 = calcTramo((form.t2_sub || []).slice(0, evaluacionesArr[1] || 4));
    const t3 = calcTramo((form.t3_sub || []).slice(0, evaluacionesArr[2] || 4));
    
    // Sumamos todos los tramos disponibles hasta el conteo total de lapsos del año
    const sum = [t1, t2, t3].slice(0, appCfg.lapsos_count).reduce((a, b) => a + (Number(b) || 0), 0);
    // El promedio definitivo siempre se divide entre el total de lapsos configurados para el año
    return (sum / appCfg.lapsos_count).toFixed(2);
  }, [form, appCfg]);
  
  const lapsoCols = useMemo(() => Array.from({ length: appCfg.lapsos_count }, (_, i) => i + 1), [appCfg.lapsos_count]);
  
  const handleAlumnoChange = (val: string) => {
    setForm((f: any) => ({ ...f, alumno_id: val }));
  };

  const handleMateriaChange = (val: string) => {
    setForm((f: any) => ({ ...f, materia: val }));
  };

  // Auto-poblar formulario si ya existe una nota para ese alumno y materia
  useEffect(() => {
    if (form.alumno_id && form.materia && !editId) {
      const existing = notas.find(n => 
        String(n.alumno_id) === String(form.alumno_id) && 
        n.materia.toLowerCase().trim() === form.materia.toLowerCase().trim()
      );
      if (existing) {
        console.log("Nota existente encontrada, auto-poblando...", existing);
        setEditId(existing.id);
        setForm({
          alumno_id: String(existing.alumno_id),
          materia: existing.materia,
          t1_sub: parseSub(existing.t1_sub),
          t2_sub: parseSub(existing.t2_sub),
          t3_sub: parseSub(existing.t3_sub),
        });
      }
    }
  }, [form.alumno_id, form.materia, editId, notas]);

  const evaluacionesArr = useMemo(() => {
    const selectedMateriaConfig = (appCfg.materias || []).find((m: any) => m.nombre === form?.materia);
    return selectedMateriaConfig ? selectedMateriaConfig.evaluaciones : [4, 4, 4];
  }, [appCfg.materias, form.materia]);

  const save = async () => {
    if (!form.alumno_id || !form.materia) return toast.error("Selecciona alumno y materia");
    
    const selectedMateriaConfig = (appCfg.materias || []).find((m: any) => m.nombre === form.materia);
    const evaluacionesArr = selectedMateriaConfig ? selectedMateriaConfig.evaluaciones : [4,4,4];

    const t1_sub_final = (form.t1_sub || []).slice(0, evaluacionesArr[0] || 4);
    const t2_sub_final = (form.t2_sub || []).slice(0, evaluacionesArr[1] || 4);
    const t3_sub_final = (form.t3_sub || []).slice(0, evaluacionesArr[2] || 4);

    const t1 = calcTramo(t1_sub_final);
    const t2 = calcTramo(t2_sub_final);
    const t3 = calcTramo(t3_sub_final);
    
    let finalId = editId;
    if (!finalId) {
      // Búsqueda más agresiva: ignorar mayúsculas y espacios
      const existing = notas.find(n => 
        String(n.alumno_id) === String(form.alumno_id) && 
        n.materia.toLowerCase().trim() === form.materia.toLowerCase().trim()
      );
      if (existing) finalId = existing.id;
    }
    
    const id = finalId || generateId();
    const tramo1 = appCfg.lapsos_count >= 1 ? t1 : 0;
    const tramo2 = appCfg.lapsos_count >= 2 ? t2 : 0;
    const tramo3 = appCfg.lapsos_count >= 3 ? t3 : 0;

    const promNum = parseFloat(promedio);
    const estado = promNum >= 10 
      ? "Aprobado" 
      : (appCfg.lapso_activo === appCfg.lapsos_count ? "Reprobado" : "Pendiente");

    try {
      await notasApi.save({
        id, alumno_id: form.alumno_id, materia: form.materia, 
        tramo1, tramo2, tramo3, 
        t1_sub: JSON.stringify(t1_sub_final), 
        t2_sub: JSON.stringify(t2_sub_final), 
        t3_sub: JSON.stringify(t3_sub_final), 
        promedio: promNum, 
        estado,
        created_at: new Date().toISOString()
      });
      
      toast.success("Nota " + (editId ? "actualizada" : "registrada") + " en el servidor local");
      queryClient.invalidateQueries({ queryKey: ["notas"] });
      
      logAudit(profile?.nombre || "Sistema", roles[0] || "admin", editId ? "Edición de Nota" : "Creación de Nota", `Materia: ${form.materia}, Alumno ID: ${form.alumno_id}`);
      setForm({ alumno_id: "", materia: "", t1_sub: [], t2_sub: [], t3_sub: [] });
      setEditId(null);
      setShowForm(false);
    } catch (e: any) {
      toast.error("Error al guardar: " + e.message);
    }
  };

  const remove = async (id: string) => {
    const toastId = toast.loading("Eliminando...");
    try {
      await notasApi.delete(id);
      await queryClient.invalidateQueries({ queryKey: ["notas"] });
      toast.success("Eliminado", { id: toastId });
      setDeleteId(null);
    } catch (e: any) {
      toast.error("Error: " + e.message, { id: toastId });
    }
  };

  const cleanDuplicates = async () => {
    setIsCleaning(true);
    const toastId = toast.loading("Limpiando duplicados...");
    try {
      const seen = new Set();
      const toDelete = [];
      
      // Identificar duplicados (mismo alumno y misma materia)
      for (const n of notas) {
        const key = `${n.alumno_id}-${n.materia.toLowerCase().trim()}`;
        if (seen.has(key)) {
          toDelete.push(n.id);
        } else {
          seen.add(key);
        }
      }

      if (toDelete.length === 0) {
        toast.info("No se encontraron duplicados", { id: toastId });
      } else {
        for (const id of toDelete) {
          await notasApi.delete(id);
        }
        await queryClient.invalidateQueries({ queryKey: ["notas"] });
        toast.success(`Se eliminaron ${toDelete.length} duplicados`, { id: toastId });
      }
    } catch (e: any) {
      toast.error("Error al limpiar: " + e.message, { id: toastId });
    } finally {
      setIsCleaning(false);
    }
  };

  const toggleAuthorize = async (id: string, current: boolean) => {
    const next = !current;
    try {
      await notasApi.update(id, { autorizado: next ? 1 : 0 });
      toast.success(next ? "Nota autorizada" : "Autorización retirada"); 
      queryClient.invalidateQueries({ queryKey: ["notas"] });
    } catch (e: any) {
      toast.error("Error al autorizar: " + e.message);
    }
  };


  const togglePublish = async (id: string, current: boolean) => {
    const next = !current;
    
    try {
      if (next) {
        // Ahora usamos la API local del bot
        await botApi.publish(id);
        toast.success("Publicada en Telegram (Modo Local)");
      } else {
        await notasApi.update(id, { publicado: 0 });
        toast.success("Publicación retirada");
      }
      queryClient.invalidateQueries({ queryKey: ["notas"] });
    } catch (e: any) {
      toast.error("Error al publicar: " + e.message);
    }
  };

  const publish = async (id: string) => {
    togglePublish(id, false);
  };


  const authSection = async () => {
    const toAuth = notasFiltered.filter(n => !n.autorizado).map(n => n.id);
    if (toAuth.length === 0) return toast.info("No hay notas pendientes con los filtros actuales");
    
    try {
      for (const id of toAuth) {
        await notasApi.update(id, { autorizado: 1 });
      }
      toast.success(`${toAuth.length} notas autorizadas`); 
      queryClient.invalidateQueries({ queryKey: ["notas"] });
    } catch (e: any) {
      toast.error("Error al autorizar: " + e.message);
    }
  };

  const publishSection = async () => {
    const toPub = notasFiltered.filter(n => n.autorizado).map(n => n.id);
    if (toPub.length === 0) return toast.info("No hay notas autorizadas con los filtros actuales");
    
    toast.info(`Publicando ${toPub.length} notas...`);
    try {
      for (const id of toPub) {
        await botApi.publish(id);
      }
      toast.success("Proceso de publicación finalizado (Modo Local)");
      queryClient.invalidateQueries({ queryKey: ["notas"] });
    } catch (e: any) {
      toast.error("Error en publicación masiva: " + e.message);
    }
  };

  const publishStudentNotes = async (groupId: string, val: boolean) => {
    if (!appCfg?.publicaciones_habilitadas) return toast.error("Publicación global desactivada.");
    const notasToUpdate = groupedNotas.find(g => String(g.id) === String(groupId))?.notas || [];
    const authorizedNotas = notasToUpdate.filter(n => n.autorizado);
    if (authorizedNotas.length === 0) return toast.error("El alumno no tiene notas autorizadas.");

    if (val) {
      toast.info("Enviando notas a Telegram...");
      try {
        await botApi.publishStudent(groupId);
        toast.success("Notas enviadas al alumno correctamente");
        queryClient.invalidateQueries({ queryKey: ["notas"] });
      } catch (e: any) {
        toast.error("Error al enviar: " + (e.response?.data?.error || e.message));
      }
    } else {
      toast.info("Retirando publicación de notas...");
      try {
        for (const n of authorizedNotas) {
          if (n.publicado) await notasApi.update(n.id, { publicado: 0 });
        }
        toast.success("Publicación retirada");
        queryClient.invalidateQueries({ queryKey: ["notas"] });
      } catch (e: any) {
        toast.error("Error al retirar: " + e.message);
      }
    }
  };


  const notasFiltered = notas.filter(n => {
    if (filtroGrado !== "Todos" && n.alumnos?.grado !== filtroGrado) return false;
    if (filtroSeccion !== "Todos" && n.alumnos?.seccion !== filtroSeccion) return false;
    if (filtroMateria !== "Todos" && n.materia !== filtroMateria) return false;
    return true;
  });

  const groupedNotas = useMemo(() => {
    const groups: Record<string, any> = {};
    notasFiltered.forEach(n => {
      const id = String(n.alumno_id);
      if (!groups[id]) {
        groups[id] = {
          alumno: n.alumnos,
          id: n.alumno_id,
          notas: []
        };
      }
      groups[id].notas.push(n);
    });
    return Object.values(groups);
  }, [notasFiltered]);

  const alumnosParaSelect = useMemo(() => {
    return alumnos.filter(a => {
      if (a.grado === "Egresado") return false;
      const matchG = diagGrado === "Todos" || a.grado === diagGrado;
      const matchS = diagSeccion === "Todos" || a.seccion === diagSeccion;
      return matchG && matchS;
    });
  }, [alumnos, diagGrado, diagSeccion]);

  const availableMaterias = useMemo(() => {
    const selectedAlumnoInfo = alumnos.find(a => String(a.id) === String(form.alumno_id));
    let filtered = (appCfg.materias || [])
      .filter((m: any) => m.grados && m.grados.includes(selectedAlumnoInfo?.grado))
      .map((m: any) => m.nombre);
    
    if (filtered.length === 0 && appCfg.materias && appCfg.materias.length > 0) {
      filtered = appCfg.materias.map((m: any) => m.nombre);
    }
    return filtered;
  }, [alumnos, form.alumno_id, appCfg.materias]);

  const alumnosFilteredForSelect = useMemo(() => {
    return alumnosParaSelect.filter(a => {
      if (!diagSearch.trim()) return true;
      const term = diagSearch.toLowerCase();
      return (a.nombre || "").toLowerCase().includes(term) || (a.ci || "").toLowerCase().includes(term);
    });
  }, [alumnosParaSelect, diagSearch]);

  const materiasFilteredForSelect = useMemo(() => {
    return availableMaterias.filter((m: string) => {
      if (!diagSearchMateria.trim()) return true;
      return m.toLowerCase().includes(diagSearchMateria.toLowerCase());
    });
  }, [availableMaterias, diagSearchMateria]);

  const exportExcel = () => {
    if (notasFiltered.length === 0) return toast.info("No hay calificaciones para exportar");
    const rows = notasFiltered.map(n => {
      const base: any = {
        Cédula: n.alumnos?.ci,
        Nombre: n.alumnos?.nombre,
        Materia: n.materia,
        "Promedio Final": n.promedio,
        Estado: n.estado
      };
      
      const matConf = appCfg.materias.find((m:any) => m.nombre === n.materia);
      const evalsArr = matConf ? matConf.evaluaciones : [4,4,4];
      
      lapsoCols.forEach(l => {
        const evals = evalsArr[l - 1] || 4;
        for(let s=0; s<evals; s++) {
          base[`L${l} E${s+1}`] = (n[`t${l}_sub`] || [])[s] || "";
        }
      });
      return base;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Calificaciones");
    XLSX.writeFile(wb, `Calificaciones_Filtro_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const downloadTemplate = () => {
    const base: any = { Cédula: "12345678", Materia: "NombreMateria" };
    lapsoCols.forEach(l => {
      // Create max 10 columns for visibility
      for(let s=0; s<10; s++) {
        base[`L${l} E${s+1}`] = "";
      }
    });
    const ws = XLSX.utils.json_to_sheet([base]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    XLSX.writeFile(wb, "Plantilla_Importar_Notas.xlsx");
  };

  const importExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wsname]);
        
        let successCount = 0;
        let notFoundCount = 0;

        for (const row of rows) {
          const ciStr = String(row.Cédula || "").trim();
          const materiaStr = String(row.Materia || "").trim();
          if (!ciStr || !materiaStr) continue;

          const alumnoMatch = alumnos.find(a => String(a.ci).trim() === ciStr);
          if (!alumnoMatch) {
            notFoundCount++;
            continue;
          }

          const matConfig = appCfg.materias.find((m: any) => m.nombre === materiaStr);
          const evalsArr = matConfig ? matConfig.evaluaciones : [4,4,4];
          
          const getSub = (l: number) => {
             const evals = evalsArr[l - 1] || 4;
             const arr = [];
             for(let i=0; i<evals; i++) {
                const val = row[`L${l} E${i+1}`];
                arr.push(val !== undefined && val !== "" ? val : null);
             }
             return arr;
          };

          const t1_sub = getSub(1);
          const t2_sub = getSub(2);
          const t3_sub = getSub(3);
          
          const t1 = calcTramo(t1_sub);
          const t2 = calcTramo(t2_sub);
          const t3 = calcTramo(t3_sub);

          const sumLapsos = t1 + t2 + t3;
          const promDefinitivo = (sumLapsos / appCfg.lapsos_count).toFixed(2);
          const promNum = parseFloat(promDefinitivo);
          const estado = promNum >= 10 
            ? "Aprobado" 
            : (appCfg.lapso_activo === appCfg.lapsos_count ? "Reprobado" : "Pendiente");

          const payload: any = {
            id: generateId(),
            alumno_id: alumnoMatch.id,
            materia: materiaStr,
            t1_sub: JSON.stringify(t1_sub), 
            t2_sub: JSON.stringify(t2_sub), 
            t3_sub: JSON.stringify(t3_sub),
            tramo1: t1, tramo2: t2, tramo3: t3,
            promedio: promNum,
            estado
          };

          const existing = notas.find(n => String(n.alumno_id) === String(alumnoMatch.id) && n.materia === materiaStr);
          if (existing) {
            await notasApi.update(existing.id, { ...payload, id: existing.id });
          } else {
            await notasApi.save(payload);
          }
          successCount++;
        }

        toast.success(`Importadas/Actualizadas ${successCount} notas`);
        if (notFoundCount > 0) toast.warning(`${notFoundCount} filas ignoradas por cédula no encontrada`);
        logAudit(profile?.nombre || "Sistema", roles[0] || "admin", "Importación Masiva de Notas", `Se importaron/actualizaron ${successCount} notas por Excel.`);
        queryClient.invalidateQueries({ queryKey: ["notas"] });
      } catch (err: any) {
        toast.error(translateError(err));
      }
    };
    reader.readAsBinaryString(file);
  };


  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calificaciones</h1>
          <p className="text-muted-foreground">Registra, filtra por sección y gestiona las sub-notas. Lapso Activo: {appCfg.lapso_activo}</p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap items-end gap-2">
            
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={downloadTemplate}><FileSpreadsheet className="h-4 w-4 mr-1"/> Plantilla</Button>
              <div className="relative">
                <Input type="file" accept=".xlsx, .xls" className="absolute inset-0 opacity-0 cursor-pointer" onChange={importExcel} />
                <Button variant="outline" size="sm"><Upload className="h-4 w-4 mr-1"/> Importar</Button>
              </div>
              <Button variant="outline" size="sm" onClick={exportExcel}><Download className="h-4 w-4 mr-1"/> Exportar</Button>
            <div className="flex flex-wrap items-center gap-4 bg-muted/40 p-2 px-3 rounded-lg border border-primary/20 shadow-sm">
              <div className="flex items-center gap-2">
                <Switch 
                  id="switch-consultas"
                  checked={!!appCfg?.consultas_habilitadas} 
                  onCheckedChange={(v) => updateAppConfig("consultas_habilitadas", v)} 
                />
                <Label htmlFor="switch-consultas" className="text-xs cursor-pointer font-bold text-primary">Consultas Activas</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  id="switch-publicaciones"
                  checked={!!appCfg?.publicaciones_habilitadas} 
                  onCheckedChange={(v) => updateAppConfig("publicaciones_habilitadas", v)} 
                />
                <Label htmlFor="switch-publicaciones" className="text-xs cursor-pointer font-bold text-primary">Publicación Telegram</Label>
              </div>
            </div>

            </div>

            {isRoot && (
              <Button variant="outline" size="sm" onClick={() => { setShowAudit((s) => { const next = !s; if (next) queryClient.invalidateQueries({ queryKey: ["audit"] }); return next; }); }}>
                <History className="h-4 w-4 mr-1" /> {showAudit ? "Ocultar" : "Ver"} auditoría
              </Button>
            )}
          </div>
        )}
      </header>

      {isStaff && (
        <Card className="p-4 shadow-[var(--shadow-soft)] bg-muted/40">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2 font-semibold text-primary mr-2"><Filter className="h-5 w-5"/> Filtros de Sección</div>
            <div className="w-40">
              <Label className="text-xs">Curso / Año</Label>
              <Select value={filtroGrado} onValueChange={setFiltroGrado}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todos</SelectItem>
                  {GRADOS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-32">
              <Label className="text-xs">Sección</Label>
              <Select value={filtroSeccion} onValueChange={setFiltroSeccion}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todos</SelectItem>
                  {SECCIONES.map((s) => <SelectItem key={s} value={s}>Sección {s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Label className="text-xs">Materia</Label>
              <Select value={filtroMateria} onValueChange={setFiltroMateria}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todas las Materias</SelectItem>
                  {Array.from(new Set(appCfg.materias?.map((m: any) => m.nombre))).map((m: any) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-auto flex flex-wrap gap-2 mt-2 sm:mt-0 sm:ml-auto">
              <Button onClick={() => { setEditId(null); setForm({ alumno_id: "", materia: "", t1_sub: [], t2_sub: [], t3_sub: [] }); setShowForm(true); }} className="shadow-lg flex-1 sm:flex-none justify-center">
                <Plus className="h-4 w-4 mr-1"/> Crear Calificación
              </Button>
              {isRoot && (
                <Button variant="outline" onClick={cleanDuplicates} disabled={isCleaning} className="flex-1 sm:flex-none justify-center">
                  <Eraser className="h-4 w-4 mr-2" /> {isCleaning ? "Limpiando..." : "Limpiar Duplicados"}
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30px]"></TableHead>
              <TableHead>Alumno</TableHead>
              <TableHead>Curso/Secc.</TableHead>
              <TableHead className="text-center">Telegram</TableHead>
              <TableHead className="text-center">Publicar</TableHead>
              <TableHead className="text-center">Materias</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupedNotas.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin calificaciones</TableCell></TableRow>
            )}

            {groupedNotas.map((group) => {
              const actualAlumno = alumnos.find((a: any) => String(a.id) === String(group.id));
              const hasTelegram = !!actualAlumno?.telegram_chat_id;

              return (
                <React.Fragment key={group.id}>
                  <TableRow 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleStudent(group.id)}
                  >
                    <TableCell>
                      {expandedStudents.has(group.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </TableCell>
                    <TableCell className="font-bold text-lg">{group.alumno?.nombre || "Alumno Desconocido"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{group.alumno?.grado} "{group.alumno?.seccion}"</TableCell>
                    <TableCell className="text-center">
                      {hasTelegram ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1.5 font-bold text-xs">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Vinculado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1.5 font-bold text-xs">
                          <XCircle className="h-3.5 w-3.5" /> Sin Vincular
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div onClick={(e) => e.stopPropagation()} className="inline-flex items-center justify-center">
                        <Switch 
                          checked={group.notas.some((n: any) => n.autorizado && n.publicado)}
                          onCheckedChange={(val) => publishStudentNotes(group.id, val)}
                          disabled={!appCfg?.publicaciones_habilitadas || !isAdmin}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                        {group.notas.length} {group.notas.length === 1 ? "Materia" : "Materias"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        {expandedStudents.has(group.id) ? "Ocultar detalles" : "Ver detalles"}
                      </Button>
                    </TableCell>
                  </TableRow>

                  {expandedStudents.has(group.id) && (
                    <TableRow className="bg-muted/10 border-b-2 border-primary/20">
                      <TableCell colSpan={7} className="p-0">
                        <div className="p-6 bg-gradient-to-b from-muted/30 to-background animate-in slide-in-from-top-2 duration-300">
                          
                        <div className="overflow-x-auto rounded-xl border bg-background shadow-sm">
                          <Table className="w-full">
                            <TableHeader className="bg-muted/50 border-b">
                              <TableRow>
                                <TableHead className="font-bold py-3">Materia</TableHead>
                                {lapsoCols.map((i) => <TableHead key={i} className="text-center font-bold">Lapso {i}</TableHead>)}
                                <TableHead className="text-center font-bold">Promedio</TableHead>
                                <TableHead className="text-center font-bold">Estado</TableHead>
                                <TableHead className="text-center font-bold">Autorizada</TableHead>
                                <TableHead className="text-center font-bold">Bot Telegram</TableHead>
                                {isAdmin && <TableHead className="text-right font-bold">Acciones</TableHead>}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                            {group.notas.map((n: any) => (
                              <TableRow key={n.id} className="hover:bg-muted/20">
                                <TableCell className="font-semibold">{n.materia}</TableCell>
                                {lapsoCols.map((i) => {
                                  const subs = parseSub(n[`t${i}_sub`]);
                                  const matConf = appCfg.materias.find((m: any) => m.nombre === n.materia);
                                  const evalsCount = matConf ? (matConf.evaluaciones?.[i - 1] || 4) : 4;
                                  return (
                                    <TableCell key={i} className="text-center">
                                      <div className="font-bold text-base">{n[`tramo${i}`]}</div>
                                      <div className="flex justify-center gap-1 mt-1 text-[10px] text-muted-foreground font-semibold">
                                        {Array.from({ length: evalsCount }).map((_, idx) => {
                                          const val = subs[idx] !== undefined && subs[idx] !== "" ? subs[idx] : "-";
                                          return (
                                            <span key={idx} className="px-1.5 py-0.5 bg-muted/60 text-muted-foreground rounded border border-muted-foreground/10 min-w-[20px] text-center inline-block">
                                              {val}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    </TableCell>
                                  );
                                })}
                                <TableCell className="text-center font-black text-primary">{n.promedio}</TableCell>
                                <TableCell className="text-center">
                                  <Badge variant={n.estado === "Aprobado" ? "default" : n.estado === "Reprobado" ? "destructive" : "secondary"}>
                                    {n.estado}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Switch 
                                    checked={!!n.autorizado} 
                                    onCheckedChange={() => toggleAuthorize(n.id, !!n.autorizado)}
                                    disabled={!isAdmin}
                                  />
                                </TableCell>
                                <TableCell className="text-center">
                                  {n.autorizado ? (
                                    <div className="inline-flex items-center gap-2 bg-muted/50 px-2 py-1 rounded-md border border-primary/10">
                                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Publicar</Label>
                                      <Switch 
                                        checked={!!n.publicado}
                                        onCheckedChange={() => togglePublish(n.id, !!n.publicado)}
                                        disabled={!appCfg?.publicaciones_habilitadas}
                                      />
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground italic">No autorizada</span>
                                  )}
                                </TableCell>
                                {isAdmin && (
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { 
                                        setEditId(n.id); 
                                        setForm({
                                          alumno_id: n.alumno_id, materia: n.materia,
                                          t1_sub: parseSub(n.t1_sub), t2_sub: parseSub(n.t2_sub), t3_sub: parseSub(n.t3_sub)
                                        });
                                        setShowForm(true); 
                                      }}><Pencil className="h-4 w-4" /></Button>
                                      {isRoot && (
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(n.id)}>
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                )}
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
          })}
          </TableBody>
        </Table>
        </div>
      </Card>

      <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); if(!o) { setEditId(null); setDiagSearch(""); setDiagSearchMateria(""); setForm({ alumno_id: "", materia: "", t1_sub: [], t2_sub: [], t3_sub: [] }); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Calificación" : "Nueva Calificación"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Filtrar Alumno por Año y Sección</Label>
                <div className="flex gap-2 mb-2">
                  <Select value={diagGrado} onValueChange={setDiagGrado}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Año..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Todos">Todos los años</SelectItem>
                      {GRADOS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={diagSeccion} onValueChange={setDiagSeccion}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Secc..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Todos">Todas</SelectItem>
                      {SECCIONES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Select value={form.alumno_id || undefined} onValueChange={handleAlumnoChange}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar alumno…" /></SelectTrigger>
                  <SelectContent>
                    <div className="p-2 sticky top-0 bg-background z-10 border-b mb-1">
                      <Input 
                        placeholder="Buscar alumno..." 
                        value={diagSearch} 
                        onChange={(e) => setDiagSearch(e.target.value)} 
                        onClick={(e) => e.stopPropagation()} 
                        onKeyDown={(e) => e.stopPropagation()} 
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="max-h-[200px] overflow-y-auto">
                      {alumnosFilteredForSelect.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.nombre} — {a.ci} ({a.grado} "{a.seccion}")</SelectItem>
                      ))}
                      {alumnosFilteredForSelect.length === 0 && (
                        <div className="p-2 text-xs text-muted-foreground text-center">No se encontraron alumnos</div>
                      )}
                    </div>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Materia</Label>
                <Select value={form.materia || undefined} onValueChange={handleMateriaChange} disabled={!form.alumno_id || availableMaterias.length === 0}>
                  <SelectTrigger><SelectValue placeholder={availableMaterias.length > 0 ? "Selecciona…" : "Sin materias configuradas"} /></SelectTrigger>
                  <SelectContent>
                    <div className="p-2 sticky top-0 bg-background z-10 border-b mb-1">
                      <Input 
                        placeholder="Buscar materia..." 
                        value={diagSearchMateria} 
                        onChange={(e) => setDiagSearchMateria(e.target.value)} 
                        onClick={(e) => e.stopPropagation()} 
                        onKeyDown={(e) => e.stopPropagation()} 
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="max-h-[200px] overflow-y-auto">
                      {materiasFilteredForSelect.map((m: string) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                      {materiasFilteredForSelect.length === 0 && (
                        <div className="p-2 text-xs text-muted-foreground text-center">No se encontraron materias</div>
                      )}
                    </div>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-lg font-bold">Sub-notas (Base 20) — Lapso Activo: {appCfg.lapso_activo}</Label>
              
              {!form.materia || !form.alumno_id ? (
                <div className="bg-muted/30 p-8 rounded-xl border border-dashed text-center text-muted-foreground">
                  Selecciona un Alumno y una Materia para ingresar o ver las calificaciones.
                </div>
              ) : (
                <>
                  {lapsoCols.filter(l => l <= appCfg.lapso_activo).map((lapso) => {
                    const evalsForLapso = evaluacionesArr[lapso - 1] || 4;
                const subCols = Array.from({ length: evalsForLapso }, (_, i) => i);
                return (
                <div key={lapso} className={`border p-4 rounded-xl ${lapso === appCfg.lapso_activo ? 'bg-primary/5 border-primary/30 shadow-sm' : 'bg-muted/20 opacity-70'}`}>
                  <div className="flex justify-between items-center mb-3">
                    <Label className={`font-semibold ${lapso === appCfg.lapso_activo ? 'text-primary' : ''}`}>Lapso {lapso} {lapso === appCfg.lapso_activo && "(ACTIVO)"}</Label>
                    <Badge variant="outline">Promedio: {calcTramo(form[`t${lapso}_sub`])}</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {subCols.map(subIdx => (
                      <div key={subIdx}>
                        <Label className="text-xs text-muted-foreground">Eval. {subIdx + 1}</Label>
                        <Input type="number" min="0" max="20" placeholder="Ej: 15" value={form[`t${lapso}_sub`]?.[subIdx] ?? ""} 
                          disabled={lapso !== appCfg.lapso_activo && !isRoot}
                          onChange={(e) => {
                            let val = e.target.value;
                            const num = parseFloat(val);
                            if (num > 20) {
                              toast.error("La nota máxima es 20");
                              val = "20";
                            }
                            const newSub = [...(form[`t${lapso}_sub`] || [])];
                            newSub[subIdx] = val;
                            setForm({ ...form, [`t${lapso}_sub`]: newSub });
                          }} />
                      </div>
                    ))}
                  </div>
                </div>
              )})}
              </>
            )}
            </div>
            
            {form.materia && form.alumno_id && (
              <div className="flex justify-between items-center bg-primary/10 p-4 rounded-lg">
                <span className="font-bold">Promedio Final Calculado:</span>
                <span className="text-xl font-bold text-primary">{promedio}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={save}>Guardar Calificación</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isRoot && showAudit && (
        <Card className="p-6 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2"><History className="h-4 w-4" /> Auditoría de notas</h2>
            <Button variant="ghost" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["audit"] })}>Refrescar</Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha y Hora</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Antes</TableHead>
                  <TableHead>Después</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audit.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sin registros</TableCell></TableRow>
                )}
                {audit.map((a) => {
                  const d = new Date(a.created_at);
                  
                  const getDiff = (oldV: any, newV: any) => {
                    if (!oldV) return { before: "—", after: "Registro Inicial" };
                    if (!newV) return { before: "Nota Eliminada", after: "—" };
                    
                    let b = "";
                    let n = "";
                    
                    ['t1_sub', 't2_sub', 't3_sub'].forEach((key, i) => {
                      if (JSON.stringify(oldV[key]) !== JSON.stringify(newV[key])) {
                        b += `L${i+1}: ${Array.isArray(oldV[key]) ? oldV[key].join(", ") : oldV[key] || "0"} `;
                        n += `L${i+1}: ${Array.isArray(newV[key]) ? newV[key].join(", ") : newSubStr(newV[key]) || "0"} `;
                      }
                    });

                    function newSubStr(val: any) {
                      return Array.isArray(val) ? val.join(", ") : val;
                    }
                    
                    return { before: b || "Sin cambios", after: n || "Sin cambios" };
                  };

                  const diff = getDiff(a.old_values, a.new_values);

                  return (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs">{d.toLocaleString()}</TableCell>
                      <TableCell className="font-bold text-xs">{a.actor_name || "—"}</TableCell>
                      <TableCell className="text-xs font-semibold">{a.details || a.action}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{diff.before}</TableCell>
                      <TableCell className="text-xs font-bold text-primary">{diff.after}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar calificación?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer. Se borrarán permanentemente las notas de este alumno en esta materia.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && remove(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Notas;
