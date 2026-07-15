import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Search, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { translateError } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { TelegramButton } from "@/components/telegram-button";

import { publicApi } from "@/lib/api";

const Consulta = () => {
  const [nombre, setNombre] = useState("");
  const [ci, setCi] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<any[] | null>(null);
  const [alumno, setAlumno] = useState<any | null>(null);
  const [lapsoActivo, setLapsoActivo] = useState<number>(1);

  const buscar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !ci.trim()) return toast.error("Ingresa nombre y cédula");
    
    setLoading(true);
    setResultados(null);
    setAlumno(null);

    try {
      const data = await publicApi.consulta(nombre.trim(), ci.trim());
      setAlumno(data.alumno);
      setResultados(data.notas);
      setLapsoActivo(data.lapso_activo || 1);
      
      if (data.notas.length === 0) {
        toast.info("Aún no tienes calificaciones autorizadas para mostrar.");
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || "Error al realizar la consulta";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl space-y-6">
        <header className="flex items-center justify-between">
          <Link to="/auth" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Volver al inicio
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-primary" />
              <span className="font-bold hidden sm:inline">Sistema de Notas</span>
            </div>
            <div className="flex items-center gap-2">
              <TelegramButton />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <Card className="p-6 md:p-8 shadow-[var(--shadow-soft)] border-t-4 border-t-primary">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black tracking-tight mb-2">Consulta de Calificaciones</h1>
            <p className="text-muted-foreground">Ingresa tus datos registrados para ver tus resultados académicos.</p>
          </div>

          <form onSubmit={buscar} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end max-w-2xl mx-auto">
            <div className="space-y-2">
              <Label htmlFor="nombre">Tu primer nombre</Label>
              <Input 
                id="nombre" 
                placeholder="Ej: Juan" 
                value={nombre} 
                onChange={(e) => setNombre(e.target.value)} 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ci">Número de Cédula</Label>
              <Input 
                id="ci" 
                placeholder="Ej: 12345678" 
                value={ci} 
                onChange={(e) => setCi(e.target.value)} 
                required 
              />
            </div>
            <Button type="submit" className="w-full h-10 font-bold" disabled={loading}>
              {loading ? "Buscando..." : <><Search className="h-4 w-4 mr-2" /> Consultar</>}
            </Button>
          </form>
        </Card>

        {alumno && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="overflow-hidden shadow-lg border-primary/20">
              <div className="bg-primary/5 p-6 border-b">
                <div className="flex flex-wrap justify-between items-center gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-primary">{alumno.nombre}</h2>
                    <p className="text-muted-foreground text-sm">Cédula: {alumno.ci} | Grado: {alumno.grado} | Sección: {alumno.seccion}</p>
                  </div>
                  <Badge variant="outline" className="text-lg py-1 px-4 border-primary/30 text-primary">
                    Calificaciones Autorizadas
                  </Badge>
                </div>
              </div>
              
              <div className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="font-bold py-4 pl-6 text-foreground w-1/3">Materia</TableHead>
                      <TableHead className="font-bold text-center text-foreground w-2/3">
                        Evaluaciones y Promedio (Lapso {lapsoActivo})
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resultados && resultados.length > 0 ? (
                      resultados.map((n) => {
                        let notaLapso = "—";
                        let subNotasStr = "[]";
                        
                        if (lapsoActivo === 1) { notaLapso = n.tramo1 || "—"; subNotasStr = n.t1_sub; }
                        if (lapsoActivo === 2) { notaLapso = n.tramo2 || "—"; subNotasStr = n.t2_sub; }
                        if (lapsoActivo === 3) { notaLapso = n.tramo3 || "—"; subNotasStr = n.t3_sub; }
                        
                        let subNotas: any[] = [];
                        try { subNotas = JSON.parse(subNotasStr || "[]"); } catch (e) {}
                        
                        return (
                          <TableRow key={n.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="font-semibold py-4 pl-6">{n.materia}</TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-4">
                                {subNotas.length > 0 && (
                                  <div className="flex flex-wrap gap-2 justify-center mr-4">
                                    {subNotas.map((s, idx) => (
                                      <div key={idx} className="flex flex-col items-center">
                                        <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">E{idx + 1}</span>
                                        <span className="text-sm font-semibold border bg-background px-2 py-0.5 rounded shadow-sm">
                                          {s !== null && s !== "" ? s : "—"}
                                        </span>
                                      </div>
                                    ))}
                                    <div className="mx-2 text-muted-foreground flex items-center">➔</div>
                                  </div>
                                )}
                                <div className="flex flex-col items-center">
                                  <span className="text-[9px] text-primary uppercase tracking-widest font-bold">Promedio</span>
                                  <span className="font-black text-primary text-xl bg-primary/10 px-3 py-1 rounded-md">{notaLapso}</span>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="py-12 text-center text-muted-foreground italic">
                          {loading ? "Cargando resultados..." : "No hay notas disponibles para este estudiante."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="bg-muted/20 p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  Nota: Solo se muestran las calificaciones que han sido debidamente autorizadas por la coordinación.
                </p>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Consulta;
