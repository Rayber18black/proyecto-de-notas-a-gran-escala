import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  console.log("Function admin-delete-user invoked:", req.method);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) return json({ error: "No autenticado" }, 401);
    const { data: rolesData } = await userClient.from("user_roles").select("role").eq("user_id", caller.id);
    const callerRoles = (rolesData ?? []).map((r: any) => r.role);
    
    if (!callerRoles.includes("root") && !callerRoles.includes("admin")) {
      return json({ error: "No tienes permisos para eliminar usuarios" }, 403);
    }

    const { user_id } = await req.json();
    if (!user_id) {
      return json({ error: "El ID del usuario es obligatorio" }, 400);
    }

    const admin = createClient(url, service);
    
    // Primero, obtener los datos del usuario para evitar borrar a la cuenta rayber principal
    const { data: targetUser, error: getErr } = await admin.auth.admin.getUserById(user_id);
    if (getErr || !targetUser?.user) {
      return json({ error: "Usuario no encontrado en el sistema de autenticación" }, 404);
    }

    if (targetUser.user.email === "rayber@local.app") {
      return json({ error: "No se puede eliminar la cuenta del dueño del sistema" }, 403);
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(user_id);
    if (delErr) return json({ error: `Error de Supabase: ${delErr.message}` }, 400);
    
    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
}
