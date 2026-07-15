import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  console.log("Function admin-create-user invoked:", req.method);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin/root
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) return json({ error: "No autenticado" }, 401);
    
    const { data: rolesData } = await userClient.from("user_roles").select("role").eq("user_id", caller.id);
    const callerRoles = (rolesData ?? []).map((r: any) => r.role);
    const isRoot = callerRoles.includes("root");
    const isAdmin = callerRoles.includes("admin") || isRoot;
    const isOwner = caller.email === "rayber@local.app";

    if (!isAdmin) {
      return json({ error: "No tienes permisos para crear usuarios" }, 403);
    }

    const body = await req.json();
    const { username, nombre, role, ci } = body as {
      username: string; nombre: string; role: "root" | "admin" | "docente" | "student"; ci?: string;
    };

    if (role === "root" && !isOwner) {
      return json({ error: "Solo el dueño del sistema puede crear usuarios Root" }, 403);
    }
    if (!username || !nombre || !role) return json({ error: "Faltan datos" }, 400);

    // Password is mandatory for all roles. For students, it's the CI.
    let password: string = body.password;
    if (role === "student") {
      if (!ci) return json({ error: "La cédula es obligatoria para estudiantes" }, 400);
      password = ci;
    }
    if (!password || password.length < 6) {
      return json({ error: "La contraseña es obligatoria (mínimo 6 caracteres)" }, 400);
    }

    const admin = createClient(url, service);
    const email = `${username.toLowerCase()}@local.app`;
    console.log("Creando usuario:", email, "con rol:", role);
    
    // Check if user already exists (only if CI is provided)
    if (ci && ci.trim() !== "") {
      const { data: existing, error: checkErr } = await admin.from("profiles").select("id").eq("ci", ci).maybeSingle();
      if (checkErr) console.error("Error checking CI:", checkErr);
      if (existing) {
        console.log("CI duplicada detectada:", ci);
        return json({ error: "Ya existe un usuario con esa cédula (CI)" }, 400);
      }
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { nombre, username, ci },
    });
    
    if (createErr) {
      console.error("Error en auth.admin.createUser:", createErr);
      if (createErr.message.includes("already registered")) return json({ error: "El nombre de usuario ya está en uso" }, 400);
      return json({ error: `Error de Auth: ${createErr.message}` }, 400);
    }

    console.log("Usuario creado en Auth, asignando rol...");

    // Force the correct role
    await admin.from("user_roles").delete().eq("user_id", created.user.id);
    const { error: roleErr } = await admin.from("user_roles").insert({ user_id: created.user.id, role });
    
    if (roleErr) {
      console.error("Error en asignación de rol:", roleErr);
      return json({ error: `Error asignando rol: ${roleErr.message}` }, 400);
    }

    console.log("Rol asignado con éxito");

    if (role === "student" && ci) {
      console.log("Creando registro de alumno...");
      const { error: alumErr } = await admin.from("alumnos").upsert(
        { user_id: created.user.id, nombre, ci },
        { onConflict: "ci" },
      );
      if (alumErr) console.error("Error creando alumno:", alumErr);
    }

    return json({ ok: true, user_id: created.user.id });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, "content-type": "application/json" },
  });
}