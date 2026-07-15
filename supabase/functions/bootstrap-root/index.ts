import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  
  const email = "rayber@local.app";
  const password = "adminrayber123";
  
  try {
    // 1. Buscar si el usuario ya existe por email (más eficiente que listUsers)
    const { data: { users }, error: listErr } = await admin.auth.admin.listUsers();
    if (listErr) throw listErr;
    
    const found = users.find(u => u.email === email);
    
    if (found) {
      console.log(`User ${email} found, ensuring password and role...`);
      // Actualizar contraseña y asegurar que esté confirmado
      const { error: updErr } = await admin.auth.admin.updateUserById(found.id, { 
        password,
        email_confirm: true 
      });
      if (updErr) throw updErr;
      
      // Asegurar rol root
      const { error: roleErr } = await admin.from("user_roles").upsert(
        { user_id: found.id, role: "root" },
        { onConflict: "user_id,role" }
      );
      if (roleErr) throw roleErr;
      
      return new Response(JSON.stringify({ ok: true, status: "updated" }), {
        headers: { ...cors, "content-type": "application/json" },
      });
    }

    // 2. Si no existe, crearlo
    console.log(`User ${email} not found, creating...`);
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre: "Rayber", username: "rayber" },
    });
    
    if (createErr) throw createErr;

    // 3. Asignar rol root
    const { error: insErr } = await admin.from("user_roles").insert({ 
      user_id: created.user.id, 
      role: "root" 
    });
    if (insErr) throw insErr;

    return new Response(JSON.stringify({ ok: true, status: "created" }), {
      headers: { ...cors, "content-type": "application/json" },
    });
  } catch (err: any) {
    console.error("Bootstrap error:", err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      status: 500,
      headers: { ...cors, "content-type": "application/json" },
    });
  }
});