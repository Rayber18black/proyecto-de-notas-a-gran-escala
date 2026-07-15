import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { alumnosApi, notasApi, configApi, auditApi, usersApi } from "@/lib/api";
import { es } from "date-fns/locale";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Shield, Download, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const Auditoria = () => {
  const { data: auditRaw = [], isLoading: loading } = useQuery({
    queryKey: ["audit"],
    queryFn: auditApi.list,
    refetchInterval: 10000,
  });

  const logs = useMemo(() => {
    return auditRaw.map((l: any) => ({
      id: l.id,
      created_at: l.created_at,
      actor_name: l.changed_by_name || "Sistema",
      actor_role: l.changed_by || "admin",
      action: l.action + (l.new_values ? `: ${l.new_values}` : "")
    }));
  }, [auditRaw]);

  const handleBackup = async () => {
    try {
      toast.info("Generando respaldo de seguridad local... por favor espera.");
      
      const [alumnos, notas, usersData, config] = await Promise.all([
        alumnosApi.list(),
        notasApi.list(),
        usersApi.list(),
        configApi.get()
      ]);

      const { profiles, roles } = usersData;

      const wb = XLSX.utils.book_new();

      // Hoja 1: Alumnos
      const wsAlumnos = XLSX.utils.json_to_sheet(alumnos || [{ Mensaje: "Sin datos" }]);
      XLSX.utils.book_append_sheet(wb, wsAlumnos, "Alumnos");

      // Hoja 2: Notas
      const notasFormat = (notas || []).map((n: any) => ({
        Alumno: n.alumno_nombre || "Desconocido",
        Cédula: n.alumno_ci || "",
        Materia: n.materia,
        Promedio: n.promedio,
        Estado: n.estado,
        Tramo1: n.tramo1, Tramo2: n.tramo2, Tramo3: n.tramo3
      }));
      const wsNotas = XLSX.utils.json_to_sheet(notasFormat.length ? notasFormat : [{ Mensaje: "Sin datos" }]);
      XLSX.utils.book_append_sheet(wb, wsNotas, "Calificaciones");

      // Hoja 3: Usuarios (Profiles + Roles)
      const usersFormat = (profiles || []).map((p: any) => {
        const userRole = (roles || []).find((r: any) => r.user_id === p.id);
        return { Nombre: p.nombre, CI: p.ci, Rol: userRole?.role || "student" };
      });
      const wsUsers = XLSX.utils.json_to_sheet(usersFormat.length ? usersFormat : [{ Mensaje: "Sin datos" }]);
      XLSX.utils.book_append_sheet(wb, wsUsers, "Usuarios");

      // Hoja 4: Configuración
      const configFormat = config ? [{ 
        Lapso_Activo: config.lapso_activo, 
        Materias: config.materias_por_grado,
        Actualizado: config.updated_at
      }] : [{ Mensaje: "Sin configuración" }];
      const wsConfig = XLSX.utils.json_to_sheet(configFormat);
      XLSX.utils.book_append_sheet(wb, wsConfig, "Configuración");

      XLSX.writeFile(wb, `Backup_GestionNotas_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
      toast.success("Respaldo descargado exitosamente");
      
    } catch (error) {
      console.error(error);
      toast.error("Error al generar el respaldo");
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Auditoría y Respaldo</h1>
          <p className="text-muted-foreground mt-1">Supervisión de cambios y copias de seguridad del sistema.</p>
        </div>
        <Button onClick={handleBackup} className="bg-primary text-primary-foreground">
          <Download className="mr-2 h-4 w-4" /> Generar Respaldo Total (Excel)
        </Button>
      </header>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">Registro de Actividad Reciente</h3>
        </div>
        
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Fecha y Hora</TableHead>
                <TableHead>Usuario (Actor)</TableHead>
                <TableHead>Registro de Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">Cargando registros...</TableCell></TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-6">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <AlertCircle className="h-8 w-8 opacity-50" />
                      <p>No hay registros de actividad aún.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), "dd/MMM/yyyy hh:mm a", { locale: es })}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{log.actor_name}</span>
                        <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full w-max mt-1 uppercase tracking-wider">{log.actor_role}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{log.action}</TableCell>
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

export default Auditoria;
