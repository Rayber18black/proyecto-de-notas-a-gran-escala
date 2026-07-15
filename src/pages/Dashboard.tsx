import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Users, BookOpen, CheckCircle2, AlertCircle, Clock, Shield, UserCog, GraduationCap, User, Trophy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { alumnosApi, notasApi, usersApi, configApi } from "@/lib/api";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const Dashboard = () => {
  const { profile, roles } = useAuth();
  
  const { data: alumnosData = [] } = useQuery({
    queryKey: ["alumnos"],
    queryFn: alumnosApi.list,
  });

  const { data: notasData = [] } = useQuery({
    queryKey: ["notas"],
    queryFn: notasApi.list,
  });

  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.list,
  });

  const { data: appConfig } = useQuery({
    queryKey: ["config"],
    queryFn: configApi.get,
  });

  const stats = useMemo(() => {
    const list = notasData;
    const activeAlumnos = alumnosData.filter((a: any) => a.grado !== "Egresado");
    return {
      alumnos: activeAlumnos.length,
      notas: list.length,
      aprobados: list.filter((n: any) => n.estado === "Aprobado").length,
      reprobados: list.filter((n: any) => n.estado === "Reprobado").length,
      pendientes: list.filter((n: any) => n.estado === "Pendiente").length,
    };
  }, [alumnosData, notasData]);

  const roleCounts = useMemo(() => {
    const counts = { root: 0, admin: 0, docente: 0, student: 0 } as any;
    if (usersData?.roles) {
      usersData.roles.forEach((r: any) => { if (counts[r.role] !== undefined) counts[r.role]++; });
    }
    // Excluir la cuenta del dueño 'rayber' de las estadísticas si es posible
    if (counts.root > 0) counts.root--;
    return counts;
  }, [usersData]);

  const [selectedGrado, setSelectedGrado] = useState<string>("Todos");
  const [showReprobados, setShowReprobados] = useState(false);
  const [showAlumnosStats, setShowAlumnosStats] = useState(false);
  const [showMissingGrades, setShowMissingGrades] = useState(false);

  const missingGradesDetails = useMemo(() => {
    if (!appConfig?.materias_por_grado) return [];
    
    let mpg = {} as any;
    try {
      mpg = typeof appConfig.materias_por_grado === 'string' 
        ? JSON.parse(appConfig.materias_por_grado) 
        : appConfig.materias_por_grado;
    } catch(e) { return []; }

    const activeLapso = appConfig.lapso_activo || 1;
    const activeAlumnos = alumnosData.filter((a: any) => a.grado !== "Egresado");
    
    const missing: any[] = [];
    const normalize = (s: string) => (s || "").trim().toLowerCase().replace(/°/g, '').replace(/\s+/g, ' ');

    let materias: any[] = [];
    if (mpg && mpg.version === 2) {
      materias = mpg.materias || [];
    } else if (mpg) {
      const legacyMap: any = mpg;
      Object.keys(legacyMap).forEach((g) => {
        legacyMap[g].forEach((m: string) => {
          if (!materias.find(item => item.nombre === m)) {
            const gs = Object.keys(legacyMap).filter(k => legacyMap[k].includes(m));
            materias.push({ nombre: m, grados: gs });
          }
        });
      });
    }

    activeAlumnos.forEach((alumno: any) => {
      const gNormal = normalize(alumno.grado);
      // Obtener materias asociadas a este grado con su estructura completa
      const materiasDelGrado = materias.filter((m: any) => 
        m.grados && m.grados.map(normalize).includes(gNormal)
      );
      
      if (materiasDelGrado.length === 0) {
        return;
      }

      const materiasFaltantes = materiasDelGrado.map((mObj: any) => {
        const mName = mObj.nombre;
        const evalsArr = mObj.evaluaciones || [4, 4, 4];
        const expected = evalsArr[activeLapso - 1] || 4;

        // Buscar si existe un registro de notas para este alumno y materia
        const nota = notasData.find((n: any) => 
          String(n.alumno_id) === String(alumno.id) && 
          normalize(n.materia) === normalize(mName)
        );

        if (!nota) {
          return {
            materia: mName,
            faltantesCount: expected,
            totalCount: expected
          };
        }

        // Si tiene registro, verificar cuántas evaluaciones tiene cargadas
        const subStr = nota[`t${activeLapso}_sub`];
        let subs: any[] = [];
        if (subStr) {
          if (Array.isArray(subStr)) {
            subs = subStr;
          } else {
            try { subs = JSON.parse(subStr); } catch(e) {}
          }
        }
        
        const validSubs = subs.filter(v => v !== null && v !== undefined && String(v).trim() !== "");
        const faltantesCount = Math.max(0, expected - validSubs.length);

        if (faltantesCount > 0) {
          return {
            materia: mName,
            faltantesCount,
            totalCount: expected
          };
        }

        return null;
      }).filter(Boolean);

      if (materiasFaltantes.length > 0) {
        missing.push({
          id: alumno.id,
          alumno: alumno.nombre,
          grado: alumno.grado,
          seccion: alumno.seccion,
          faltantes: materiasFaltantes
        });
      }
    });

    return missing.sort((a, b) => a.alumno.localeCompare(b.alumno));
  }, [alumnosData, notasData, appConfig]);

  const demographicStats = useMemo(() => {
    const activeAlumnos = alumnosData.filter((a: any) => a.grado !== "Egresado");
    const stats: any = {
      total: activeAlumnos.length,
      hombres: activeAlumnos.filter((a: any) => (a.genero || "Hombre") === "Hombre").length,
      mujeres: activeAlumnos.filter((a: any) => a.genero === "Mujer").length,
      porGrado: {},
      porSeccion: {}
    };

    activeAlumnos.forEach((a: any) => {
      const g = a.grado || "Sin Grado";
      const s = a.seccion || "S/S";
      
      if (!stats.porGrado[g]) stats.porGrado[g] = { total: 0, hombres: 0, mujeres: 0 };
      stats.porGrado[g].total++;
      if ((a.genero || "Hombre") === "Hombre") stats.porGrado[g].hombres++;
      else stats.porGrado[g].mujeres++;

      const secKey = `${g} - Sección ${s}`;
      if (!stats.porSeccion[secKey]) stats.porSeccion[secKey] = { total: 0, hombres: 0, mujeres: 0 };
      stats.porSeccion[secKey].total++;
      if ((a.genero || "Hombre") === "Hombre") stats.porSeccion[secKey].hombres++;
      else stats.porSeccion[secKey].mujeres++;
    });

    return stats;
  }, [alumnosData]);

  const reprobadosDetails = useMemo(() => {
    return notasData
      .filter((n: any) => n.estado === "Reprobado")
      .map((n: any) => {
        const al = alumnosData.find((a: any) => String(a.id) === String(n.alumno_id)) || {};
        return {
          id: n.id,
          nombre: al.nombre || "Desconocido",
          grado: al.grado || "Desconocido",
          materia: n.materia,
          promedio: n.promedio
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [alumnosData, notasData]);

  const items = [
    { label: "Total alumnos", value: stats.alumnos, icon: Users, color: "text-primary" },
    { label: "Calificaciones", value: stats.notas, icon: BookOpen, color: "text-foreground" },
    { label: "Aprobados", value: stats.aprobados, icon: CheckCircle2, color: "text-success" },
    { label: "Reprobados", value: stats.reprobados, icon: AlertCircle, color: "text-destructive" },
    { label: "Pendientes", value: stats.pendientes, icon: Clock, color: "text-warning" },
  ];

  const roleItems = [
    { key: "root", label: "Root", icon: Shield, count: roleCounts.root, desc: "Control total del sistema" },
    { key: "admin", label: "Admin", icon: UserCog, count: roleCounts.admin, desc: "Gestión de alumnos y notas" },
    { key: "docente", label: "Docente", icon: GraduationCap, count: roleCounts.docente, desc: "Registro de calificaciones" },
    { key: "student", label: "Estudiante", icon: User, count: roleCounts.student, desc: "Consulta de notas propias" },
  ];
  const myRole = roles[0] ?? "student";

  const pieData = [
    { name: "Aprobados", value: stats.aprobados, color: "#10b981" },
    { name: "Reprobados", value: stats.reprobados, color: "#ef4444" },
    { name: "Pendientes", value: stats.pendientes, color: "#f59e0b" },
  ].filter(d => d.value > 0);

  const barData = useMemo(() => {
    const counts: Record<string, number> = {};
    alumnosData.forEach(a => {
      if (a.grado && a.grado !== "Egresado") {
        counts[a.grado] = (counts[a.grado] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, cantidad]) => ({ name, cantidad }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [alumnosData]);

  const top5Alumnos = useMemo(() => {
    // Filtrar alumnos
    const filtered = selectedGrado === "Todos" 
      ? alumnosData.filter(a => a.grado !== "Egresado")
      : alumnosData.filter(a => a.grado === selectedGrado);

    // Calcular promedio general de cada alumno
    const averages = filtered.map(a => {
      const notasAlumno = notasData.filter(n => n.alumno_id === a.id);
      if (notasAlumno.length === 0) return { ...a, promedio: 0 };
      
      const sum = notasAlumno.reduce((acc, curr) => acc + (Number(curr.promedio) || 0), 0);
      const avg = sum / notasAlumno.length;
      return { ...a, promedio: avg.toFixed(2) };
    }).filter(a => Number(a.promedio) > 0);

    return averages.sort((a, b) => Number(b.promedio) - Number(a.promedio)).slice(0, 5);
  }, [alumnosData, notasData, selectedGrado]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">
          {(profile?.nombre?.toLowerCase() || "").includes("rayber")
            ? "¡Bienvenido devuelta, mi señor Rayber! 👑" 
            : `Hola, ${profile?.nombre?.split(" ")[0] || "Usuario"} 👋, ¡bienvenido a Gestión de Notas!`}
        </h1>
        <p className="text-muted-foreground mt-1">
          {(profile?.nombre?.toLowerCase() || "").includes("rayber")
            ? "Aquí tienes un resumen general de la plataforma."
            : "Resumen general de la plataforma educativa."}
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {items.map((it) => (
          <Card 
            key={it.label} 
            className={`p-5 shadow-[var(--shadow-soft)] cursor-pointer transition-all hover:scale-[1.02] border-transparent hover:border-primary/50 ${it.label === "Reprobados" ? "hover:border-destructive" : ""}`}
            onClick={() => {
              if (it.label === "Reprobados") setShowReprobados(true);
              if (it.label === "Total alumnos") setShowAlumnosStats(true);
              if (it.label === "Calificaciones") setShowMissingGrades(true);
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{it.label}</span>
              <it.icon className={`h-5 w-5 ${it.color}`} />
            </div>
            <p className="text-3xl font-bold mt-3">{it.value}</p>
          </Card>
        ))}
      </div>

      <Dialog open={showAlumnosStats} onOpenChange={setShowAlumnosStats}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary text-xl">
              <Users className="h-6 w-6" /> 
              Estadísticas Demográficas de Alumnos
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <Card className="p-4 bg-primary/5 border-primary/20">
              <p className="text-sm text-muted-foreground">Total Inscritos</p>
              <p className="text-3xl font-bold">{demographicStats.total}</p>
            </Card>
            <Card className="p-4 bg-blue-500/5 border-blue-500/20">
              <p className="text-sm text-blue-600 font-semibold">Hombres</p>
              <p className="text-3xl font-bold text-blue-700">{demographicStats.hombres}</p>
            </Card>
            <Card className="p-4 bg-pink-500/5 border-pink-500/20">
              <p className="text-sm text-pink-600 font-semibold">Mujeres</p>
              <p className="text-3xl font-bold text-pink-700">{demographicStats.mujeres}</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
            <div>
              <h4 className="font-bold mb-4 flex items-center gap-2 border-b pb-2">
                <GraduationCap className="h-5 w-5" /> Por Grado / Año
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Grado</TableHead>
                    <TableHead className="text-center">H</TableHead>
                    <TableHead className="text-center">M</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(demographicStats.porGrado).sort().map(([grado, s]: any) => (
                    <TableRow key={grado}>
                      <TableCell className="font-medium">{grado}</TableCell>
                      <TableCell className="text-center text-blue-600">{s.hombres}</TableCell>
                      <TableCell className="text-center text-pink-600">{s.mujeres}</TableCell>
                      <TableCell className="text-right font-bold">{s.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div>
              <h4 className="font-bold mb-4 flex items-center gap-2 border-b pb-2">
                <BookOpen className="h-5 w-5" /> Por Sección
              </h4>
              <div className="max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sección</TableHead>
                      <TableHead className="text-center">H</TableHead>
                      <TableHead className="text-center">M</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(demographicStats.porSeccion).sort().map(([sec, s]: any) => (
                      <TableRow key={sec}>
                        <TableCell className="text-sm">{sec}</TableCell>
                        <TableCell className="text-center text-blue-600">{s.hombres}</TableCell>
                        <TableCell className="text-center text-pink-600">{s.mujeres}</TableCell>
                        <TableCell className="text-right font-semibold">{s.total}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showMissingGrades} onOpenChange={setShowMissingGrades}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning text-xl">
              <Clock className="h-6 w-6" /> 
              Alumnos con Notas Faltantes (Lapso {appConfig?.lapso_activo || 1})
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-4">
            {missingGradesDetails.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground font-medium">¡Al día! Todos los alumnos tienen sus notas cargadas.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estudiante</TableHead>
                    <TableHead>Grado / Sección</TableHead>
                    <TableHead>Materias Pendientes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {missingGradesDetails.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-semibold align-top py-4">{m.alumno}</TableCell>
                      <TableCell className="align-top py-4 text-muted-foreground">{m.grado} - {m.seccion}</TableCell>
                      <TableCell className="py-4">
                        <div className="flex flex-wrap gap-2">
                          {m.faltantes.map((f: any) => (
                            <span 
                              key={f.materia} 
                              className="text-[10px] px-2.5 py-1 rounded-full bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/20 dark:border-amber-500/30 shadow-sm font-semibold flex items-center gap-2 hover:bg-amber-500/15 dark:hover:bg-amber-500/25 transition-colors"
                            >
                              <span className="uppercase tracking-wider text-amber-800 dark:text-amber-200">{f.materia}</span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/20 dark:bg-amber-500/35 font-extrabold text-amber-900 dark:text-amber-100">
                                Falta{f.faltantesCount === 1 ? "" : "n"} {f.faltantesCount} de {f.totalCount}
                              </span>
                            </span>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showReprobados} onOpenChange={setShowReprobados}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" /> 
              Listado de Alumnos Reprobados
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-4 pr-2">
            {reprobadosDetails.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No hay alumnos reprobados.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estudiante</TableHead>
                    <TableHead>Grado/Año</TableHead>
                    <TableHead>Materia</TableHead>
                    <TableHead className="text-right">Promedio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reprobadosDetails.map((r, i) => (
                    <TableRow key={r.id || i}>
                      <TableCell className="font-medium">{r.nombre}</TableCell>
                      <TableCell>{r.grado}</TableCell>
                      <TableCell>{r.materia}</TableCell>
                      <TableCell className="text-right font-bold text-destructive">{r.promedio}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-6">
          <h3 className="font-semibold mb-4 text-lg">Resumen Académico Global</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 text-sm">
            {pieData.map(d => (
              <div key={d.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></div>
                <span className="text-muted-foreground">{d.name}: {d.value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4 text-lg">Estudiantes por Grado/Año</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip cursor={{fill: 'transparent'}} />
                <Bar dataKey="cantidad" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <div className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            <h3 className="font-semibold text-lg">Top 5 Excelencia Académica</h3>
          </div>
          <div className="w-full sm:w-48 mt-4 sm:mt-0">
            <Select value={selectedGrado} onValueChange={setSelectedGrado}>
              <SelectTrigger><SelectValue placeholder="Filtrar por grado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos los grados</SelectItem>
                {Array.from(new Set(alumnosData.map((a: any) => a.grado))).filter(Boolean).sort().map((g: any) => (
                  <SelectItem key={String(g)} value={String(g)}>{String(g)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px] text-center">Puesto</TableHead>
                <TableHead>Estudiante</TableHead>
                <TableHead>Grado/Año</TableHead>
                <TableHead className="text-right">Promedio General</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {top5Alumnos.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No hay suficientes calificaciones registradas</TableCell></TableRow>
              ) : (
                top5Alumnos.map((a, i) => (
                  <TableRow key={a.id} className={i === 0 ? "bg-yellow-500/10" : ""}>
                    <TableCell className="text-center font-bold">{i + 1}</TableCell>
                    <TableCell className="font-medium">{a.nombre}</TableCell>
                    <TableCell>{a.grado}</TableCell>
                    <TableCell className="text-right font-bold text-primary">{a.promedio}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

    </div>
  );
};

export default Dashboard;