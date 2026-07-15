import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// @ts-ignore: Deno environment
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const admin = createClient(url, service);

    const update = await req.json();
    console.log("--- NUEVO MENSAJE DE TELEGRAM ---");
    console.log(JSON.stringify(update, null, 2));

    if (!update.message) {
      console.log("Update sin mensaje, ignorando.");
      return new Response("ok");
    }

    const chatId = update.message.chat.id;
    const text = update.message.text?.trim() || "";

    // Obtener config del bot
    const { data: cfg, error: cfgErr } = await admin.from("bot_config").select("*").eq("id", 1).maybeSingle();
    
    if (cfgErr) {
      console.error("Error al leer config:", cfgErr);
      return new Response("error_cfg", { status: 500 });
    }

    if (!cfg || !cfg.enabled) {
      console.log("Bot desactivado en la DB o sin configurar.");
      return new Response("bot_disabled");
    }

    const sendMsg = async (msg: string) => {
      await fetch(`https://api.telegram.org/bot${cfg.telegram_token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: "HTML" }),
      });
    };

    if (text === "/start") {
      await sendMsg(
        `👋 <b>¡Hola! Bienvenido al sistema de consulta de notas.</b>\n\n` +
        `Por favor, envía tu número de <b>Cédula de Identidad</b> para consultar tus calificaciones actuales.`
      );
      return new Response("ok");
    }

    // Si es un número de cédula (o parece serlo)
    if (/^\d+$/.test(text) || (text.length > 5 && /\d/.test(text))) {
      // Buscar configuración para promedios y estado global
      const { data: appCfg } = await admin.from("app_config").select("*").eq("id", 1).maybeSingle();
      
      if (appCfg && !appCfg.publicaciones_habilitadas) {
        await sendMsg(`⚠️ El servicio de consulta vía Telegram se encuentra temporalmente desactivado.`);
        return new Response("ok");
      }

      const lapsosCount = appCfg?.lapsos_count || 3;
      const lapsoActivo = appCfg?.lapso_activo || 1;

      // Buscar alumno
      const { data: alumno } = await admin.from("alumnos").select("*").eq("ci", text).maybeSingle();

      if (!alumno) {
        await sendMsg(`❌ No se encontró ningún alumno registrado con la cédula <b>${text}</b>.`);
        return new Response("ok");
      }

      // Buscar notas publicadas
      const { data: notas } = await admin.from("notas").select("*").eq("alumno_id", alumno.id).eq("publicado", true);

      if (!notas || notas.length === 0) {
        await sendMsg(`👤 <b>${alumno.nombre}</b>\n\nAún no hay calificaciones publicadas para este alumno.`);
        return new Response("ok");
      }

      let responseText = `👤 <b>Expediente: ${alumno.nombre}</b>\n`;
      responseText += `🎓 Grado: ${alumno.grado} - ${alumno.seccion}\n`;
      responseText += `📅 Lapso Actual: ${lapsoActivo} de ${lapsosCount}\n\n`;
      responseText += `📑 <b>Calificaciones:</b>\n\n`;

      notas.forEach((n: any) => {
        // Calcular promedio del año basado en lapsos configurados
        const tramos = [n.tramo1 || 0, n.tramo2 || 0, n.tramo3 || 0].slice(0, lapsosCount);
        const suma = tramos.reduce((a, b) => a + b, 0);
        const promAnual = (suma / lapsosCount).toFixed(2);
        
        // Identificar nota del lapso actual
        const notaLapsoActual = tramos[lapsoActivo - 1] || 0;

        responseText += `📖 <b>${n.materia}</b>\n`;
        responseText += `   🔸 Lapso Actual: <b>${notaLapsoActual}</b>\n`;
        responseText += `   ✨ Promedio Anual: <b>${promAnual}</b>\n`;
        
        let detalle = "   📝 [ ";
        if (lapsosCount >= 1) detalle += `L1: ${n.tramo1 || 0} `;
        if (lapsosCount >= 2) detalle += `| L2: ${n.tramo2 || 0} `;
        if (lapsosCount >= 3) detalle += `| L3: ${n.tramo3 || 0} `;
        detalle += "]\n\n";
        
        responseText += detalle;
      });

      responseText += `<i>Nota: Solo se muestran materias autorizadas. El promedio anual es sobre los ${lapsosCount} lapsos.</i>`;

      await sendMsg(responseText);
    } else {
      await sendMsg("⚠️ No entiendo ese comando. Por favor, envía tu número de cédula para consultar notas.");
    }

    return new Response("ok");
  } catch (e) {
    console.error("Webhook Error:", e);
    return new Response("error", { status: 500 });
  }
});
