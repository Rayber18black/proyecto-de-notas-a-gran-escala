import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserPlus, KeyRound, Trash2, Pencil } from "lucide-react";
import { translateError } from "@/lib/utils";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/lib/api";

const ROLES = ["root", "admin", "docente"] as const;

const Usuarios = () => {
  const { isRoot, isOwner } = useAuth();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ username: "", nombre: "", role: "docente", ci: "", password: "" });
  
  // Estados para diálogos
  const [pwUser, setPwUser] = useState<any | null>(null);
  const [newPw, setNewPw] = useState("");
  const [deleteUser, setDeleteUser] = useState<any | null>(null);

  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.list,
    refetchInterval: 10000,
  });

  const users = useMemo(() => {
    if (!usersData) return [];
    const { profiles = [], roles: rolesList = [] } = usersData;
    // Filtrar para no mostrar a Rayber (protección extra)
    return profiles
      .filter((p: any) => p.username?.toLowerCase() !== "rayber")
      .map((p: any) => ({
        ...p,
        roles: rolesList.filter((r: any) => r.user_id === p.id).map((r: any) => r.role),
      }));
  }, [usersData]);

  const saveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.password || form.password.length < 6) {
      return toast.error("La contraseña debe tener al menos 6 caracteres");
    }
    setBusy(true);
    try {
      await usersApi.create(form);
      toast.success("Usuario creado localmente");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setForm({ username: "", nombre: "", role: "docente", ci: "", password: "" });
    } catch (e: any) {
      toast.error(translateError(e));
    } finally {
      setBusy(false);
    }
  };

  const setRole = async (userId: string, role: string) => {
    try {
      await usersApi.setRole(userId, role);
      toast.success("Rol actualizado");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (e: any) {
      toast.error("Error al actualizar rol: " + e.message);
    }
  };

  const resetPassword = async () => {
    if (!pwUser || !newPw || newPw.length < 6) return toast.error("Mínimo 6 caracteres");
    setBusy(true);
    try {
      await usersApi.resetPassword(pwUser.id, newPw);
      toast.success("Contraseña actualizada localmente");
      setPwUser(null); setNewPw("");
    } catch (e: any) {
      toast.error(translateError(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteUser) return;
    setBusy(true);
    try {
      await usersApi.delete(deleteUser.id);
      toast.success("Usuario eliminado");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDeleteUser(null);
    } catch (e: any) {
      toast.error("Error al eliminar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Usuarios del Sistema</h1>
        <p className="text-muted-foreground">Administración local de accesos.</p>
      </header>

      {(isRoot || isOwner) && (
        <Card className="p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Crear nuevo usuario
          </h2>
          <form onSubmit={saveUser} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
              <Label>Nombre completo</Label>
              <Input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div>
              <Label>Usuario</Label>
              <Input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} />
            </div>
            <div>
              <Label>Cédula</Label>
              <Input required value={form.ci} onChange={(e) => setForm({ ...form, ci: e.target.value })} />
            </div>
            <div>
              <Label>Rol</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {isOwner && <SelectItem value="root">Root (Máximo)</SelectItem>}
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="docente">Docente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contraseña</Label>
              <Input required type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="md:col-start-5">
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Creando..." : "Crear Usuario"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Cédula</TableHead>
              <TableHead>Rol actual</TableHead>
              <TableHead>Cambiar rol</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.nombre}</TableCell>
                <TableCell>{u.username}</TableCell>
                <TableCell>{u.ci ?? "—"}</TableCell>
                <TableCell className="uppercase text-sm font-semibold text-primary">
                  {u.roles[0] ?? "Sin Rol"}
                </TableCell>
                <TableCell>
                  <Select value={u.roles[0]} onValueChange={(v) => setRole(u.id, v)}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.filter(r => isOwner || r !== "root").map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setPwUser(u); setNewPw(""); }}>
                      <KeyRound className="h-4 w-4 mr-1" /> Clave
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setDeleteUser(u)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Diálogos */}
      <Dialog open={!!pwUser} onOpenChange={(o) => !o && setPwUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cambiar contraseña — {pwUser?.nombre}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Nueva contraseña</Label>
            <Input type="text" minLength={6} value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwUser(null)}>Cancelar</Button>
            <Button onClick={resetPassword} disabled={busy}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteUser} onOpenChange={(o) => !o && setDeleteUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eliminar usuario</DialogTitle></DialogHeader>
          <div className="py-4">
            <p>¿Estás seguro de que deseas eliminar permanentemente a <strong>{deleteUser?.nombre}</strong>?</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUser(null)} disabled={busy}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={busy}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Usuarios;
