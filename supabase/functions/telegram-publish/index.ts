import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// @ts-ignore: Deno environment
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!url || !service) {
      return json({ error: "Configuración de entorno de la función incompleta (URL/ServiceRole)" }, 500);
    }

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    
    if (authError || !user) {
      return json({ error: "No autenticado o sesión inválida: " + (authError?.message || "") }, 401);
    }

    const { data: rolesData } = await userClient.from("user_roles").select("role").eq("user_id", user.id);
    const roles = (rolesData ?? []).map((r: any) => r.role);
    const isAdmin = roles.includes("root") || roles.includes("admin");
    if (!isAdmin) return json({ error: `Usuario sin permisos de administración (Roles: ${roles.join(", ")})` }, 403);

    const admin = createClient(url, service);
    const { data: cfg, error: cfgError } = await admin.from("bot_config").select("*").eq("id", 1).maybeSingle();
    
    if (cfgError) return json({ error: "Error al leer bot_config: " + cfgError.message }, 500);
    if (!cfg?.enabled) return json({ error: "El bot está desactivado en la base de datos" }, 400);
    if (!cfg.telegram_token || !cfg.telegram_chat_id) return json({ error: "Token o Chat ID no configurados en la base de datos" }, 400);

    const { nota_id, is_test } = await req.json();

    if (is_test) {
      const text = `✅ <b>¡Conexión Exitosa!</b>\nEl bot de Gestión de Notas ha sido configurado correctamente.`;
      const tgRes = await fetch(`https://api.telegram.org/bot${cfg.telegram_token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: cfg.telegram_chat_id, text, parse_mode: "HTML" }),
      });
      const tgData = await tgRes.json();
      if (!tgRes.ok || !tgData.ok) return json({ error: "Error de Telegram: " + (tgData.description || "No encontrado (Token inválido?)") }, 400);
      return json({ ok: true, message: "Mensaje de prueba enviado" });
    }

    if (!nota_id) return json({ error: "Falta nota_id" }, 400);

    // Obtener la nota inicial para saber quién es el alumno
    const { data: notaInicial } = await admin.from("notas").select("alumno_id").eq("id", nota_id).maybeSingle();
    if (!notaInicial) return json({ error: "Nota no encontrada" }, 404);

    const { data: appCfg } = await admin.from("app_config").select("*").eq("id", 1).maybeSingle();
    const lapsosCount = appCfg?.lapsos_count || 3;
    const lapsoActivo = appCfg?.lapso_activo || 1;

    // Buscar TODAS las notas autorizadas de este alumno
    const { data: notas, error: nErr } = await admin.from("notas")
      .select("*, alumnos(nombre, ci, grado, seccion)")
      .eq("alumno_id", notaInicial.alumno_id)
      .eq("autorizado", true);

    if (nErr || !notas || notas.length === 0) return json({ error: "No hay notas autorizadas para enviar" }, 400);

    const alumno = notas[0].alumnos;
    let text = `📋 <b>BOLETÍN DIGITAL DE CALIFICACIONES</b>\n`;
    text += `👤 ${alumno?.nombre} (CI: ${alumno?.ci})\n`;
    text += `🎓 ${alumno?.grado} · Sección ${alumno?.seccion}\n`;
    text += `📅 Lapso Actual: ${lapsoActivo} de ${lapsosCount}\n`;
    text += `────────────────────\n\n`;

    notas.forEach((n: any) => {
      const tramos = [n.tramo1 || 0, n.tramo2 || 0, n.tramo3 || 0].slice(0, lapsosCount);
      const suma = tramos.reduce((a, b) => a + b, 0);
      const promAnual = (suma / lapsosCount).toFixed(2);
      const notaLapsoActual = tramos[lapsoActivo - 1] || 0;

      text += `📖 <b>${n.materia}</b>\n`;
      text += `   Nota Lapso ${lapsoActivo}: <b>${notaLapsoActual}</b>\n`;
      text += `   Promedio Anual: <b>${promAnual}</b>\n`;
      text += `   [ ` + 
        (lapsosCount >= 1 ? `L1: ${n.tramo1 || 0} ` : "") +
        (lapsosCount >= 2 ? `| L2: ${n.tramo2 || 0} ` : "") +
        (lapsosCount >= 3 ? `| L3: ${n.tramo3 || 0} ` : "") +
        `]\n\n`;
    });

    text += `────────────────────\n`;
    text += `<i>Institución: Gestión Escolar Digital</i>`;

    const tgRes = await fetch(`https://api.telegram.org/bot${cfg.telegram_token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: cfg.telegram_chat_id, text, parse_mode: "HTML" }),
    });
    const tgData = await tgRes.json();
    if (!tgRes.ok || !tgData.ok) return json({ error: tgData.description || "Error de Telegram" }, 400);
    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  // Siempre devolvemos 200 para que el cliente pueda leer el cuerpo del error sin que falle la petición
  return new Response(JSON.stringify(body), { status: 200, headers: { ...cors, "content-type": "application/json" } });
}