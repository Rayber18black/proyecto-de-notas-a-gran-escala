import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, GraduationCap, Download, Upload, ArrowRight, CheckSquare, History } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { translateError, cn, generateId } from "@/lib/utils";
import { GRADOS, SECCIONES, ASCENSO_MAP } from "@/lib/constants";
import * as XLSX from "xlsx";
import { logAudit } from "@/utils/audit";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { alumnosApi, configApi } from "@/lib/api";

type Alumno = any;
const empty: Alumno = {
  nombre: "", ci: "", nacimiento: "", genero: "Hombre", grado: "", seccion: "", direccion: "",
  sangre: "", alergias: "", condiciones: "",
  rep_nombre: "", rep_parentesco: "", rep_telefono: "", rep_email: "",
};

const today = () => new Date().toISOString().slice(0, 10);

const calcEdad = (fecha?: string) => {
  if (!fecha) return "";
  const d = new Date(fecha); if (isNaN(d.getTime())) return "";
  const hoy = new Date();
  let e = hoy.getFullYear() - d.getFullYear();
  const m = hoy.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < d.getDate())) e--;
  return e >= 0 ? `${e} años` : "";
};

const Alumnos = () => {
  const { isAdmin, isRoot, profile, roles } = useAuth();
  const queryClient = useQueryClient();
  const [showAudit, setShowAudit] = useState(false);
  
  const { data: alumnos = [] } = useQuery({
    queryKey: ["alumnos"],
    queryFn: alumnosApi.list,
    refetchInterval: 3000,
  });

  const { data: appConfig } = useQuery({
    queryKey: ["config"],
    queryFn: configApi.get,
  });

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [showEgresados, setShowEgresados] = useState(false);
  const [form, setForm] = useState<Alumno>(empty);

  const isYearFinalized = useMemo(() => {
    if (!appConfig?.materias_por_grado) return false;
    try {
      const mpg = typeof appConfig.materias_por_grado === 'string' 
        ? JSON.parse(appConfig.materias_por_grado) 
        : appConfig.materias_por_grado;
      return !!mpg.finalizado;
    } catch(e) { return false; }
  }, [appConfig]);

  const save = async () => {
    if (!form.nombre?.trim() || !form.ci?.trim() || !form.rep_nombre?.trim() || !form.rep_telefono?.trim()) {
      return toast.error("El nombre, cédula, nombre del representante y teléfono son obligatorios");
    }
    if (form.grado === "Egresado") {
      return toast.error("No se puede registrar un alumno directamente con el estado Egresado");
    }
    const existing = alumnos.find(a => String(a.id) === String(form.id));
    if (existing?.grado === "Egresado") {
      return toast.error("No se puede modificar un alumno que ya ha egresado");
    }
    const id = form.id || generateId();
    try {
      await alumnosApi.save({ ...form, id, updated_at: new Date().toISOString() });
      toast.success("Alumno guardado");
      queryClient.invalidateQueries({ queryKey: ["alumnos"] });
      setOpen(false); setForm(empty);
    } catch (error: any) {
      toast.error("Error al guardar: " + error.message);
    }
  };

  const remove = async (id: string, nombre?: string) => {
    if (!confirm("¿Eliminar este alumno?")) return;
    try {
      await alumnosApi.delete(id);
      toast.success("Eliminado");
      queryClient.invalidateQueries({ queryKey: ["alumnos"] });
      logAudit(profile?.nombre || "Sistema", roles[0] || "admin", "Eliminación de Alumno", `ID: ${id} ${nombre || ''}`);
    } catch (error: any) {
      toast.error("Error al eliminar: " + error.message);
    }
  };

  const exportExcel = async () => {
    if (!alumnos.length) return toast.error("No hay datos");
    const ws = XLSX.utils.json_to_sheet(alumnos.map(a => ({
      Cédula: a.ci, Nombre: a.nombre, Género: a.genero || "Hombre", Grado: a.grado, Sección: a.seccion,
      Dirección: a.direccion, Representante: a.rep_nombre, Teléfono: a.rep_telefono
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Alumnos");
    XLSX.writeFile(wb, `Alumnos_${today()}.xlsx`);
  };

  const importExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        const payload = rows.map(r => ({
          id: generateId(),
          nombre: String(r.Nombre || ""),
          ci: String(r.Cédula || ""),
          genero: r.Género || r.Genero || r.Sexo || "Hombre",
          grado: r.Grado || "1° Grado",
          seccion: r.Sección || "A",
          rep_nombre: String(r.Representante || ""),
          rep_telefono: String(r.Teléfono || "")
        })).filter(r => r.nombre && r.ci && r.grado !== "Egresado");
        
        const filteredPayload = payload.filter(p => {
          const existing = alumnos.find(a => String(a.ci) === String(p.ci));
          return existing?.grado !== "Egresado";
        });
        
        for (const p of filteredPayload) await alumnosApi.save(p);
        toast.success(`Importados ${payload.length} alumnos`);
        queryClient.invalidateQueries({ queryKey: ["alumnos"] });
      } catch (err: any) {
        toast.error("Error en importación: " + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const activeAlumnos = alumnos.filter((a: any) => a.grado !== "Egresado");
  const filtered = activeAlumnos.filter((a: any) =>
    [a.nombre, a.ci, a.grado].join(" ").toLowerCase().includes(search.toLowerCase())
  );
  
  const egresados = alumnos.filter((a: any) => a.grado === "Egresado");

  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));
  const edad = useMemo(() => calcEdad(form.nacimiento), [form.nacimiento]);
  const isEditing = !!form.id;
  const nombreLocked = isEditing && !isRoot;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alumnos</h1>
          <p className="text-muted-foreground">Gestiona los expedientes de los estudiantes.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isAdmin && (
            <>
              <Button variant="outline" onClick={exportExcel}><Download className="h-4 w-4 mr-2" /> Exportar</Button>
              <div className="relative">
                <Input type="file" accept=".xlsx, .xls" className="absolute inset-0 opacity-0 cursor-pointer" onChange={importExcel} />
                <Button variant="outline"><Upload className="h-4 w-4 mr-2" /> Importar</Button>
              </div>
            </>
          )}
          <Button variant="outline" onClick={() => setShowEgresados(true)}>
            <GraduationCap className="h-4 w-4 mr-2" /> Egresados
          </Button>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Nuevo alumno</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{form.id ? "Editar" : "Nuevo"} alumno</DialogTitle></DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nombre completo * {nombreLocked && <span className="text-xs text-muted-foreground">(solo root)</span>}</Label>
                  <Input value={form.nombre ?? ""} disabled={nombreLocked} onChange={(e) => set("nombre", e.target.value)} />
                </div>
                <div><Label>Cédula *</Label><Input value={form.ci ?? ""} onChange={(e) => set("ci", e.target.value)} /></div>
                <div>
                  <Label>Fecha de nacimiento</Label>
                  <Input type="date" max={today()} value={form.nacimiento ?? ""} onChange={(e) => set("nacimiento", e.target.value)} />
                  {edad && <p className="text-xs text-muted-foreground mt-1">Edad: {edad}</p>}
                </div>
                <div>
                  <Label>Curso / Año</Label>
                  <Select value={form.grado ?? ""} onValueChange={(v) => set("grado", v)}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      {GRADOS.filter(g => g !== "Egresado").map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Sección</Label>
                  <Select value={form.seccion ?? ""} onValueChange={(v) => set("seccion", v)}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      {SECCIONES.map((s) => <SelectItem key={s} value={s}>Sección {s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Género</Label>
                  <Select value={form.genero ?? "Hombre"} onValueChange={(v) => set("genero", v)}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Hombre">Hombre</SelectItem>
                      <SelectItem value="Mujer">Mujer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Dirección</Label><Input value={form.direccion ?? ""} onChange={(e) => set("direccion", e.target.value)} /></div>
                <div>
                  <Label>Tipo de Sangre</Label>
                  <Select value={form.sangre ?? ""} onValueChange={(v) => set("sangre", v)}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Desconocido"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Alergias</Label><Input value={form.alergias ?? ""} onChange={(e) => set("alergias", e.target.value)} /></div>
                <div><Label>Condiciones</Label><Input value={form.condiciones ?? ""} onChange={(e) => set("condiciones", e.target.value)} /></div>
                <div className="md:col-span-2 border-t pt-2 mt-2"><Label className="font-bold">Datos del Representante</Label></div>
                <div><Label>Nombre Representante *</Label><Input value={form.rep_nombre ?? ""} onChange={(e) => set("rep_nombre", e.target.value)} /></div>
                <div>
                  <Label>Parentesco</Label>
                  <Select value={form.rep_parentesco ?? ""} onValueChange={(v) => set("rep_parentesco", v)}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      {["Madre", "Padre", "Abuelo(a)", "Tío(a)", "Hermano(a)", "Otro"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Teléfono *</Label><Input value={form.rep_telefono ?? ""} onChange={(e) => set("rep_telefono", e.target.value)} /></div>
                <div><Label>Email</Label><Input type="email" value={form.rep_email ?? ""} onChange={(e) => set("rep_email", e.target.value)} /></div>
              </div>
              <Button onClick={save} className="w-full mt-4">Guardar Alumno</Button>
            </DialogContent>
          </Dialog>
        </div>
      </header>
      <Input placeholder="Buscar por nombre, cédula o curso…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead><TableHead>Cédula</TableHead><TableHead>Edad</TableHead>
              <TableHead>Género</TableHead>
              <TableHead>Curso</TableHead><TableHead>Sección</TableHead>
              <TableHead>Representante</TableHead>
              {isAdmin && <TableHead className="text-right">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin alumnos</TableCell></TableRow>
            )}
            {filtered.map((a: any) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.nombre}</TableCell>
                <TableCell>{a.ci}</TableCell>
                <TableCell>{calcEdad(a.nacimiento) || "—"}</TableCell>
                <TableCell>{a.genero || "Hombre"}</TableCell>
                <TableCell>{a.grado}</TableCell>
                <TableCell>{a.seccion}</TableCell>
                <TableCell className="text-sm">{a.rep_nombre} ({a.rep_telefono})</TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => { setForm(a); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {isRoot && (
                      <Button size="icon" variant="ghost" onClick={() => remove(a.id, a.nombre)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </Card>

      <Dialog open={showEgresados} onOpenChange={setShowEgresados}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registro Histórico de Egresados</DialogTitle>
          </DialogHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead><TableHead>Cédula</TableHead>
                  <TableHead>Representante</TableHead>
                  {isAdmin && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {egresados.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No hay egresados registrados.</TableCell></TableRow>
                )}
                {egresados.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.nombre}</TableCell>
                    <TableCell>{a.ci}</TableCell>
                    <TableCell className="text-sm">{a.rep_nombre} ({a.rep_telefono})</TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        {isRoot && (
                          <Button size="icon" variant="ghost" onClick={() => remove(a.id, a.nombre)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Alumnos;