import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';
import axios from 'axios';
import cron from 'node-cron';
import crypto from 'crypto';
import localtunnel from 'localtunnel';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 8080;
const dbFile = path.join(__dirname, 'local_db.db');
const db = new Database(dbFile);

// --- 1. Inicialización de la Base de Datos ---
db.exec(`
  CREATE TABLE IF NOT EXISTS alumnos (
    id TEXT PRIMARY KEY,
    nombre TEXT,
    ci TEXT UNIQUE,
    nacimiento TEXT,
    grado TEXT,
    seccion TEXT,
    direccion TEXT,
    sangre TEXT,
    alergias TEXT,
    condiciones TEXT,
    rep_nombre TEXT,
    rep_parentesco TEXT,
    rep_telefono TEXT,
    rep_email TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    dirty INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS notas (
    id TEXT PRIMARY KEY,
    alumno_id TEXT,
    materia TEXT,
    tramo1 REAL DEFAULT 0,
    tramo2 REAL DEFAULT 0,
    tramo3 REAL DEFAULT 0,
    t1_sub TEXT,
    t2_sub TEXT,
    t3_sub TEXT,
    promedio REAL DEFAULT 0,
    estado TEXT,
    autorizado INTEGER DEFAULT 0,
    publicado INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    dirty INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS app_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    lapsos_count INTEGER DEFAULT 3,
    lapso_activo INTEGER DEFAULT 1,
    materias_por_grado TEXT,
    acceso_movil INTEGER DEFAULT 1,
    consultas_habilitadas INTEGER DEFAULT 1,
    publicaciones_habilitadas INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    dirty INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    password TEXT,
    nombre TEXT,
    ci TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    dirty INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS notas_audit (
    id TEXT PRIMARY KEY,
    nota_id TEXT,
    alumno_id TEXT,
    action TEXT NOT NULL,
    changed_by TEXT,
    changed_by_name TEXT,
    old_values TEXT,
    new_values TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    dirty INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS user_roles (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    role TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    dirty INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS bot_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    telegram_token TEXT,
    telegram_chat_id TEXT,
    enabled INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    dirty INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS owner_delegations (
    user_id TEXT PRIMARY KEY,
    can_manage_roles INTEGER DEFAULT 0,
    can_delete_audit INTEGER DEFAULT 0,
    can_config_system INTEGER DEFAULT 0,
    can_export_backups INTEGER DEFAULT 0,
    p_doc_1 INTEGER DEFAULT 0,
    p_doc_3 INTEGER DEFAULT 0,
    p_adm_2 INTEGER DEFAULT 0,
    p_adm_3 INTEGER DEFAULT 0,
    p_adm_4 INTEGER DEFAULT 0,
    p_adm_5 INTEGER DEFAULT 0,
    p_adm_6 INTEGER DEFAULT 0,
    p_rot_2 INTEGER DEFAULT 0,
    p_rot_3 INTEGER DEFAULT 0,
    p_rot_4 INTEGER DEFAULT 0,
    p_rot_5 INTEGER DEFAULT 0,
    p_rot_6 INTEGER DEFAULT 0,
    p_rot_7 INTEGER DEFAULT 0,
    p_own_2 INTEGER DEFAULT 0,
    p_own_4 INTEGER DEFAULT 0,
    p_own_5 INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    dirty INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS sugerencias (
    id TEXT PRIMARY KEY,
    chat_id TEXT,
    nombre TEXT,
    mensaje TEXT,
    foto_path TEXT,
    video_path TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS mensajes_fijos (
    id TEXT PRIMARY KEY,
    titulo TEXT,
    mensaje TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS historico_notas (
    id TEXT PRIMARY KEY,
    alumno_id TEXT,
    alumno_nombre TEXT,
    alumno_ci TEXT,
    alumno_grado TEXT,
    alumno_seccion TEXT,
    materia TEXT,
    tramo1 REAL DEFAULT 0,
    tramo2 REAL DEFAULT 0,
    tramo3 REAL DEFAULT 0,
    t1_sub TEXT,
    t2_sub TEXT,
    t3_sub TEXT,
    promedio REAL DEFAULT 0,
    estado TEXT,
    anio_escolar TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// --- 1.2. Migraciones (Asegurar columnas) ---
try { db.prepare("ALTER TABLE sugerencias ADD COLUMN foto_path TEXT").run(); } catch(e) {}
try { db.prepare("ALTER TABLE sugerencias ADD COLUMN video_path TEXT").run(); } catch(e) {}
try { db.prepare("ALTER TABLE sugerencias ADD COLUMN chat_id TEXT").run(); } catch(e) {}
try { db.prepare("ALTER TABLE profiles ADD COLUMN username TEXT").run(); } catch(e) {}
try { db.prepare("ALTER TABLE profiles ADD COLUMN password TEXT").run(); } catch(e) {}
try { db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username)").run(); } catch(e) {}
try { db.prepare("ALTER TABLE app_config ADD COLUMN lapso_activo INTEGER DEFAULT 1").run(); } catch(e) {}
try { db.prepare("ALTER TABLE app_config ADD COLUMN materias_por_grado TEXT").run(); } catch(e) {}
try { db.prepare("ALTER TABLE app_config ADD COLUMN acceso_movil INTEGER DEFAULT 1").run(); } catch(e) {}
try { db.prepare("ALTER TABLE app_config ADD COLUMN consultas_habilitadas INTEGER DEFAULT 1").run(); } catch(e) {}
try { db.prepare("ALTER TABLE app_config ADD COLUMN publicaciones_habilitadas INTEGER DEFAULT 0").run(); } catch(e) {}
try { db.prepare("ALTER TABLE alumnos ADD COLUMN telegram_chat_id TEXT").run(); } catch(e) {}

// Asegurar que las columnas nuevas existan en alumnos
try { db.prepare("ALTER TABLE alumnos ADD COLUMN genero TEXT").run(); } catch(e) {}

// Asegurar columnas de API y Cifrado en app_config
try { db.prepare("ALTER TABLE app_config ADD COLUMN aes_encryption_enabled INTEGER DEFAULT 0").run(); } catch(e) {}
try { db.prepare("ALTER TABLE app_config ADD COLUMN aes_encryption_key TEXT DEFAULT ''").run(); } catch(e) {}
try { db.prepare("ALTER TABLE app_config ADD COLUMN android_api_key TEXT").run(); } catch(e) {}
try { db.prepare("ALTER TABLE app_config ADD COLUMN api_public_url TEXT DEFAULT ''").run(); } catch(e) {}

// Crear tabla de dispositivos conectados si no existe
db.exec(`
  CREATE TABLE IF NOT EXISTS api_connected_devices (
    id TEXT PRIMARY KEY,
    device_id TEXT UNIQUE,
    device_name TEXT,
    device_model TEXT,
    os_version TEXT,
    ip_address TEXT,
    last_active TEXT DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// Generar clave API por defecto si está vacía al iniciar
try {
  const cfg = db.prepare('SELECT android_api_key FROM app_config WHERE id = 1').get();
  if (cfg && !cfg.android_api_key) {
    const newApiKey = 'gn_' + crypto.randomBytes(16).toString('hex');
    db.prepare('UPDATE app_config SET android_api_key = ? WHERE id = 1').run(newApiKey);
    console.log('[API] Clave API inicial de Android generada con éxito.');
  }
} catch (e) {
  console.error('[API] Error generando clave API por defecto:', e.message);
}

// --- 1.3. Datos Iniciales ---
db.exec(`
  INSERT OR IGNORE INTO app_config (id, lapsos_count) VALUES (1, 3);
  INSERT OR IGNORE INTO bot_config (id, enabled) VALUES (1, 0);
  
  -- Asegurar que el usuario rayber existe si la tabla está vacía
  INSERT OR IGNORE INTO profiles (id, username, password, nombre, ci, dirty) 
  VALUES ('rayber-static-id', 'rayber', 'adminrayber123', 'Rayber (Admin)', 'ROOT', 1);
  
  INSERT OR IGNORE INTO user_roles (id, user_id, role, dirty)
  VALUES ('rayber-role-static-id', 'rayber-static-id', 'root', 1);

  -- Anonimizar auditorías pasadas del Owner
  UPDATE notas_audit SET changed_by_name = 'Sistema' WHERE LOWER(changed_by_name) = 'rayber';
`);

// --- 2. Middlewares ---
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'apikey']
}));
app.use(bodyParser.json());

// --- 3. API Routes ---

// --- Notas y Alumnos (Manejados arriba o en secciones específicas) ---


app.get('/api/alumnos', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM alumnos ORDER BY nombre ASC').all();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/alumnos', (req, res) => {
  try {
    const { id, ...data } = req.body;
    if (!id) return res.status(400).json({ error: 'ID de alumno requerido' });

    const existing = db.prepare('SELECT grado FROM alumnos WHERE id = ?').get(id);
    if (existing && existing.grado === 'Egresado') {
      return res.status(400).json({ error: 'No se puede modificar un alumno con estado Egresado' });
    }
    if (!existing && data.grado === 'Egresado') {
      return res.status(400).json({ error: 'No se puede registrar un alumno directamente con el estado Egresado' });
    }

    // Lista de columnas permitidas en la tabla alumnos para evitar errores SQL
    const allowedCols = [
      'nombre', 'ci', 'nacimiento', 'grado', 'seccion', 'direccion', 
      'sangre', 'alergias', 'condiciones', 
      'rep_nombre', 'rep_parentesco', 'rep_telefono', 'rep_email', 
      'genero', 'updated_at'
    ];

    const filteredData = {};
    Object.keys(data).forEach(key => {
      if (allowedCols.includes(key)) {
        filteredData[key] = data[key];
      }
    });

    const cols = Object.keys(filteredData);
    const placeholders = cols.map(() => '?').join(', ');
    const setClause = cols.map(c => `${c} = EXCLUDED.${c}`).join(', ');
    
    const sql = `
      INSERT INTO alumnos (id, ${cols.join(', ')}, dirty) 
      VALUES (?, ${placeholders}, 1)
      ON CONFLICT(id) DO UPDATE SET ${setClause}, dirty = 1
    `;
    
    db.prepare(sql).run(id, ...Object.values(filteredData));
    res.json({ success: true });
  } catch (error) {
    console.error('[SERVER ERROR] Error al guardar alumno:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/alumnos/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM alumnos WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Notas
app.get('/api/notas', (req, res) => {
  const rows = db.prepare(`
    SELECT n.*, a.nombre as alumno_nombre, a.ci as alumno_ci, a.grado as alumno_grado, a.seccion as alumno_seccion
    FROM notas n
    LEFT JOIN alumnos a ON n.alumno_id = a.id
    ORDER BY n.created_at DESC
  `).all();
  res.json(rows);
});

app.post('/api/notas', (req, res) => {
  const { id, ...data } = req.body;

  if (data.alumno_id) {
    const alumno = db.prepare('SELECT grado FROM alumnos WHERE id = ?').get(data.alumno_id);
    if (alumno && alumno.grado === 'Egresado') {
      return res.status(400).json({ error: 'No se pueden registrar ni modificar calificaciones de un alumno Egresado' });
    }
  }

  // Convertir arrays a JSON si vienen como tales
  if (data.t1_sub && typeof data.t1_sub !== 'string') data.t1_sub = JSON.stringify(data.t1_sub);
  if (data.t2_sub && typeof data.t2_sub !== 'string') data.t2_sub = JSON.stringify(data.t2_sub);
  if (data.t3_sub && typeof data.t3_sub !== 'string') data.t3_sub = JSON.stringify(data.t3_sub);

  const cols = Object.keys(data);
  const placeholders = cols.map(() => '?').join(', ');
  const setClause = cols.map(c => `${c} = EXCLUDED.${c}`).join(', ');
  
  const sql = `
    INSERT INTO notas (id, ${cols.join(', ')}, dirty) 
    VALUES (?, ${placeholders}, 1)
    ON CONFLICT(id) DO UPDATE SET ${setClause}, dirty = 1
  `;
  db.prepare(sql).run(id, ...Object.values(data));
  res.json({ success: true });
});

app.patch('/api/notas/:id', (req, res) => {
  const data = req.body;

  const nota = db.prepare('SELECT alumno_id FROM notas WHERE id = ?').get(req.params.id);
  if (nota) {
    const alumno = db.prepare('SELECT grado FROM alumnos WHERE id = ?').get(nota.alumno_id);
    if (alumno && alumno.grado === 'Egresado') {
      return res.status(400).json({ error: 'No se pueden registrar ni modificar calificaciones de un alumno Egresado' });
    }
  }

  const cols = Object.keys(data);
  const setClause = cols.map(c => `${c} = ?`).join(', ');
  const sql = `UPDATE notas SET ${setClause}, dirty = 1 WHERE id = ?`;
  db.prepare(sql).run(...Object.values(data), req.params.id);
  res.json({ success: true });
});

app.delete('/api/notas/:id', (req, res) => {
  console.log(`[API] Intentando eliminar nota ID: ${req.params.id}`);
  const result = db.prepare('DELETE FROM notas WHERE id = ?').run(req.params.id);
  console.log(`[API] Resultado eliminación: ${result.changes} filas afectadas`);
  res.json({ success: true });
});

app.delete('/api/notas-all', (req, res) => {
  console.log(`[API] Iniciando proceso de archivado y cierre (Fin de año)`);
  
  // Calcular el año escolar dinámicamente según la fecha actual
  const d = new Date();
  const month = d.getMonth() + 1; // 1-12
  const year = d.getFullYear();
  let anioEscolar = "";
  if (month >= 9 && month <= 12) {
    anioEscolar = `${year}-${year + 1}`;
  } else {
    anioEscolar = `${year - 1}-${year}`;
  }

  try {
    db.transaction(() => {
      // 1. Obtener todas las notas activas junto con los datos de sus alumnos en ese momento
      const activeNotas = db.prepare(`
        SELECT 
          n.*,
          a.nombre AS alumno_nombre,
          a.ci AS alumno_ci,
          a.grado AS alumno_grado,
          a.seccion AS alumno_seccion
        FROM notas n
        LEFT JOIN alumnos a ON n.alumno_id = a.id
      `).all();

      console.log(`[API-FinDeAno] Encontradas ${activeNotas.length} notas activas para archivar en el período ${anioEscolar}.`);

      // 2. Guardar cada nota en la tabla historico_notas
      const insertStmt = db.prepare(`
        INSERT INTO historico_notas (
          id, alumno_id, alumno_nombre, alumno_ci, alumno_grado, alumno_seccion,
          materia, tramo1, tramo2, tramo3, t1_sub, t2_sub, t3_sub, promedio, estado, anio_escolar
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const n of activeNotas) {
        insertStmt.run(
          crypto.randomUUID(), // ID único de registro histórico
          n.alumno_id,
          n.alumno_nombre || "Desconocido",
          n.alumno_ci || "N/A",
          n.alumno_grado || "N/A",
          n.alumno_seccion || "",
          n.materia,
          n.tramo1 || 0,
          n.tramo2 || 0,
          n.tramo3 || 0,
          n.t1_sub || null,
          n.t2_sub || null,
          n.t3_sub || null,
          n.promedio || 0,
          n.estado || "Pendiente",
          anioEscolar
        );
      }

      // 3. Borrar las notas activas de la tabla para reiniciar el año
      const deleteResult = db.prepare('DELETE FROM notas').run();
      console.log(`[API-FinDeAno] ¡Éxito! ${activeNotas.length} notas archivadas de forma duradera y ${deleteResult.changes} notas activas eliminadas.`);
    })();

    res.json({ success: true, archivedCount: true, anio_escolar: anioEscolar });
  } catch (error) {
    console.error("[API-FinDeAno] Error durante el proceso de cierre y archivado de notas:", error);
    res.status(500).json({ error: 'Error interno al archivar las notas en el histórico local: ' + error.message });
  }
});

app.get('/api/historico-notas', (req, res) => {
  console.log('[API] Obteniendo notas históricas');
  try {
    const rows = db.prepare('SELECT * FROM historico_notas ORDER BY anio_escolar DESC, alumno_nombre, materia').all();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener notas del histórico: ' + error.message });
  }
});

app.get('/api/users', (req, res) => {
  const profiles = db.prepare('SELECT * FROM profiles').all();
  const roles = db.prepare('SELECT * FROM user_roles').all();
  res.json({ profiles, roles });
});

app.get('/api/users/:id', (req, res) => {
  const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(req.params.id);
  const roles = db.prepare('SELECT role FROM user_roles WHERE user_id = ?').all(req.params.id);
  res.json({ profile, roles: roles.map(r => r.role) });
});

app.post('/api/users/add-new', (req, res) => {
  const { username, nombre, ci, role, password } = req.body;
  if (!username || !nombre || !role || !password) return res.status(400).json({ error: 'Faltan campos' });

  try {
    const userId = crypto.randomUUID();
    db.transaction(() => {
      db.prepare('INSERT INTO profiles (id, username, password, nombre, ci, dirty) VALUES (?, ?, ?, ?, ?, 1)')
        .run(userId, username.toLowerCase().trim(), password, nombre, ci || null);
      db.prepare('INSERT INTO user_roles (id, user_id, role, dirty) VALUES (?, ?, ?, 1)')
        .run(crypto.randomUUID(), userId, role);
    })();
    res.json({ success: true, id: userId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users/role', (req, res) => {
  const { userId, role } = req.body;
  if (!userId || !role) return res.status(400).json({ error: 'Faltan datos' });
  try {
    db.transaction(() => {
      db.prepare('DELETE FROM user_roles WHERE user_id = ?').run(userId);
      db.prepare('INSERT INTO user_roles (id, user_id, role, dirty) VALUES (?, ?, ?, 1)')
        .run(crypto.randomUUID(), userId, role);
    })();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/users/profile/:id', (req, res) => {
  const data = req.body;
  const cols = Object.keys(data);
  const setClause = cols.map(c => `${c} = ?`).join(', ');
  db.prepare(`UPDATE profiles SET ${setClause}, dirty = 1 WHERE id = ?`).run(...Object.values(data), req.params.id);
  res.json({ success: true });
});

app.post('/api/users/password/:id', (req, res) => {
  const { password } = req.body;
  db.prepare('UPDATE profiles SET password = ?, dirty = 1 WHERE id = ?').run(password, req.params.id);
  res.json({ success: true });
});

app.delete('/api/users/:id', (req, res) => {
  try {
    db.transaction(() => {
      db.prepare('DELETE FROM user_roles WHERE user_id = ?').run(req.params.id);
      db.prepare('DELETE FROM owner_delegations WHERE user_id = ?').run(req.params.id);
      db.prepare('DELETE FROM profiles WHERE id = ?').run(req.params.id);
    })();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM profiles WHERE username = ? AND password = ?').get(username, password);
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });
  
  const roles = db.prepare('SELECT role FROM user_roles WHERE user_id = ?').all(user.id);
  res.json({ user, roles: roles.map(r => r.role) });
});

// Audit
app.get('/api/audit', (req, res) => {
  const rows = db.prepare('SELECT * FROM notas_audit ORDER BY created_at DESC LIMIT 200').all();
  res.json(rows);
});

app.post('/api/audit', (req, res) => {
  const { id, ...data } = req.body;
  
  // Anonimizar al Owner (Rayber es el fantasma del sistema)
  if (data.changed_by_name && data.changed_by_name.toLowerCase().includes('rayber')) {
    data.changed_by_name = 'Sistema';
  }

  if (data.old_values && typeof data.old_values !== 'string') data.old_values = JSON.stringify(data.old_values);
  if (data.new_values && typeof data.new_values !== 'string') data.new_values = JSON.stringify(data.new_values);
  
  const cols = Object.keys(data);
  const placeholders = cols.map(() => '?').join(', ');
  const sql = `INSERT INTO notas_audit (id, ${cols.join(', ')}, dirty) VALUES (?, ${placeholders}, 1)`;
  db.prepare(sql).run(id || crypto.randomUUID(), ...Object.values(data));
  res.json({ success: true });
});

// Config
app.get('/api/config', (req, res) => {
  const cfg = db.prepare('SELECT * FROM app_config WHERE id = 1').get() || {};
  cfg.local_ip = getLocalIp();
  res.json(cfg);
});

app.patch('/api/config', (req, res) => {
  try {
    const data = req.body;
    const values = Object.values(data).map(v => typeof v === 'boolean' ? (v ? 1 : 0) : v);
    const cols = Object.keys(data);
    const setClause = cols.map(c => `${c} = ?`).join(', ');
    const sql = `UPDATE app_config SET ${setClause}, dirty = 1 WHERE id = 1`;
    db.prepare(sql).run(...values);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Middleware para verificar API Key de Android ---
function androidApiAuth(req, res, next) {
  console.log('[API Debug] androidApiAuth interceptó petición a:', req.url);
  console.log('[API Debug] Headers:', JSON.stringify(req.headers));
  let apiKey = req.headers['x-api-key'] || req.query.api_key;
  if (!apiKey && req.headers['authorization']) {
    const parts = req.headers['authorization'].split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      apiKey = parts[1];
    }
  }

  console.log('[API Debug] Clave API recibida:', apiKey);

  if (!apiKey) {
    console.log('[API Debug] Clave API no provista.');
    return res.status(401).json({ error: 'Clave API no proporcionada' });
  }

  const cfg = db.prepare('SELECT android_api_key FROM app_config WHERE id = 1').get();
  if (!cfg || cfg.android_api_key !== apiKey) {
    console.log('[API Debug] Clave API inválida o no coincide. Config key:', cfg?.android_api_key);
    return res.status(403).json({ error: 'Clave API inválida o no autorizada' });
  }

  // Extraer información del dispositivo y registrar/actualizar conexión
  const deviceId = req.headers['x-device-id'];
  const deviceName = req.headers['x-device-name'] || req.headers['x-device-model'] || 'Dispositivo Android';
  const deviceModel = req.headers['x-device-model'] || '';
  const osVersion = req.headers['x-device-os'] || 'Android';
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  if (deviceId) {
    try {
      db.prepare(`
        INSERT INTO api_connected_devices (id, device_id, device_name, device_model, os_version, ip_address, last_active)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(device_id) DO UPDATE SET
          device_name = EXCLUDED.device_name,
          device_model = EXCLUDED.device_model,
          os_version = EXCLUDED.os_version,
          ip_address = EXCLUDED.ip_address,
          last_active = CURRENT_TIMESTAMP
      `).run(crypto.randomUUID(), deviceId, deviceName, deviceModel, osVersion, ipAddress);
    } catch (e) {
      console.error('[API] Error registrando dispositivo:', e.message);
    }
  } else {
    // Si no tiene X-Device-Id, creamos un identificador basado en User-Agent + IP
    const userAgent = req.headers['user-agent'] || 'AndroidApp';
    const fallbackId = crypto.createHash('md5').update(userAgent + ipAddress).digest('hex');
    let parsedOS = 'Android';
    if (userAgent.includes('Android')) {
      const match = userAgent.match(/Android\s+([0-9\.]+)/);
      if (match) parsedOS = `Android ${match[1]}`;
    }
    
    try {
      db.prepare(`
        INSERT INTO api_connected_devices (id, device_id, device_name, device_model, os_version, ip_address, last_active)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(device_id) DO UPDATE SET
          ip_address = EXCLUDED.ip_address,
          last_active = CURRENT_TIMESTAMP
      `).run(crypto.randomUUID(), fallbackId, 'Aplicación Móvil', 'Genérico', parsedOS, ipAddress);
    } catch (e) {
      // Ignorar
    }
  }

  console.log('[API Debug] Auth exitosa, procediendo a next()...');
  next();
}

// --- API Android Endpoints (Secured by API Key) ---

app.get('/api/android/sync', androidApiAuth, (req, res) => {
  console.log('[API Debug] Entró en endpoint /api/android/sync');
  try {
    const alumnos = db.prepare('SELECT * FROM alumnos ORDER BY nombre ASC').all();
    const notas = db.prepare(`
      SELECT n.*, a.nombre as alumno_nombre, a.ci as alumno_ci, a.grado as alumno_grado, a.seccion as alumno_seccion
      FROM notas n
      LEFT JOIN alumnos a ON n.alumno_id = a.id
      ORDER BY n.created_at DESC
    `).all();
    const config = db.prepare('SELECT id, lapsos_count, lapso_activo, materias_por_grado, aes_encryption_enabled, aes_encryption_key, api_public_url FROM app_config WHERE id = 1').get() || {};
    
    res.json({
      success: true,
      alumnos,
      notas,
      config
    });
  } catch (error) {
    console.error('[API Debug] Error en /api/android/sync:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/android/alumnos', androidApiAuth, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM alumnos ORDER BY nombre ASC').all();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/android/notas', androidApiAuth, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT n.*, a.nombre as alumno_nombre, a.ci as alumno_ci, a.grado as alumno_grado, a.seccion as alumno_seccion
      FROM notas n
      LEFT JOIN alumnos a ON n.alumno_id = a.id
      ORDER BY n.created_at DESC
    `).all();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/android/config', androidApiAuth, (req, res) => {
  try {
    const cfg = db.prepare('SELECT id, lapsos_count, lapso_activo, materias_por_grado, aes_encryption_enabled, aes_encryption_key, api_public_url FROM app_config WHERE id = 1').get() || {};
    res.json(cfg);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- API Admin & Config endpoints for API and Devices ---

app.post('/api/config/regenerate-key', (req, res) => {
  try {
    const newApiKey = 'gn_' + crypto.randomBytes(16).toString('hex');
    db.prepare('UPDATE app_config SET android_api_key = ?, dirty = 1 WHERE id = 1').run(newApiKey);
    res.json({ success: true, api_key: newApiKey });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/config/devices', (req, res) => {
  try {
    // Retornamos todos los dispositivos y calculamos el estado "Online/Offline" basado en si la última actividad fue hace menos de 5 minutos (300 segundos)
    const rows = db.prepare('SELECT * FROM api_connected_devices ORDER BY last_active DESC').all();
    const now = new Date();
    
    const devices = rows.map(device => {
      // Parsear last_active (SQLite CURRENT_TIMESTAMP en UTC es el formato 'YYYY-MM-DD HH:MM:SS')
      const lastActiveDate = new Date(device.last_active + ' UTC');
      const diffMs = now.getTime() - lastActiveDate.getTime();
      const diffSec = diffMs / 1000;
      
      return {
        ...device,
        status: diffSec < 300 ? 'Online' : 'Offline'
      };
    });
    
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/config/devices/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM api_connected_devices WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Student Lookup (Public for LAN)
app.get('/api/consulta', (req, res) => {
  const { nombre, ci } = req.query;
  if (!nombre || !ci) return res.status(400).json({ error: 'Faltan datos' });

  const cfg = db.prepare('SELECT consultas_habilitadas, lapso_activo FROM app_config WHERE id = 1').get();
  if (cfg && !cfg.consultas_habilitadas) {
    return res.status(403).json({ error: 'El sistema de consultas está desactivado' });
  }

  const alumno = db.prepare('SELECT * FROM alumnos WHERE nombre LIKE ? AND ci = ?').get(`%${nombre}%`, ci);
  if (!alumno) return res.status(404).json({ error: 'Estudiante no encontrado' });

  const notas = db.prepare('SELECT * FROM notas WHERE alumno_id = ? AND autorizado = 1 ORDER BY materia').all(alumno.id);
  res.json({ alumno, notas, lapso_activo: cfg.lapso_activo });
});

// Bot Config
app.get('/api/bot', (req, res) => {
  const bot = db.prepare('SELECT * FROM bot_config WHERE id = 1').get();
  res.json(bot);
});

app.patch('/api/bot', (req, res) => {
  const data = req.body;
  const values = Object.values(data).map(v => typeof v === 'boolean' ? (v ? 1 : 0) : v);
  const cols = Object.keys(data);
  const setClause = cols.map(c => `${c} = ?`).join(', ');
  db.prepare(`UPDATE bot_config SET ${setClause}, dirty = 1 WHERE id = 1`).run(...values);
  res.json({ success: true });
});

app.get('/api/bot-info', async (req, res) => {
  try {
    const bot = db.prepare('SELECT telegram_token, enabled FROM bot_config WHERE id = 1').get();
    if (!bot || !bot.enabled || !bot.telegram_token) {
      return res.json({ link: null });
    }
    const { data } = await axios.get(`https://api.telegram.org/bot${bot.telegram_token}/getMe`);
    if (data && data.ok) {
      res.json({ link: `https://t.me/${data.result.username}` });
    } else {
      res.json({ link: null });
    }
  } catch (e) {
    res.json({ link: null });
  }
});

// Delegations
app.get('/api/delegations', (req, res) => {
  const rows = db.prepare('SELECT * FROM owner_delegations').all();
  res.json(rows);
});

app.post('/api/delegations', (req, res) => {
  const { user_id, ...data } = req.body;
  const cols = Object.keys(data);
  const placeholders = cols.map(() => '?').join(', ');
  const setClause = cols.map(c => `${c} = EXCLUDED.${c}`).join(', ');
  
  const sql = `
    INSERT INTO owner_delegations (user_id, ${cols.join(', ')}, dirty)
    VALUES (?, ${placeholders}, 1)
    ON CONFLICT(user_id) DO UPDATE SET ${setClause}, dirty = 1
  `;
  db.prepare(sql).run(user_id, ...Object.values(data));
  res.json({ success: true });
});

// Sugerencias
app.get('/api/sugerencias', (req, res) => {
  const rows = db.prepare(`
    SELECT s.*, 
           a.ci as alumno_ci, 
           a.nombre as alumno_nombre, 
           a.grado as alumno_grado, 
           a.seccion as alumno_seccion,
           a.rep_nombre as representante
    FROM sugerencias s
    LEFT JOIN alumnos a ON s.chat_id = a.telegram_chat_id
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `).all();
  res.json(rows);
});

app.delete('/api/sugerencias/:id', (req, res) => {
  db.prepare('DELETE FROM sugerencias WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// --- 4. Motor de Telegram Local (Long Polling) ---
let botOffset = 0;
let botRunning = false;

async function startTelegramBot() {
  if (botRunning) return;
  botRunning = true;
  console.log('[Bot] Iniciando motor de Telegram local (Modo 100% Local)...');
  
  let webhookCleared = false;

  const poll = async () => {
    try {
      const config = db.prepare('SELECT * FROM bot_config WHERE id = 1').get();
      if (!config || !config.enabled || !config.telegram_token) {
        setTimeout(poll, 5000);
        return;
      }

      if (!webhookCleared) {
        // Limpiar webhook anterior (Supabase) para evitar conflicto 409
        try {
          await axios.post(`https://api.telegram.org/bot${config.telegram_token}/deleteWebhook`);
          webhookCleared = true;
          console.log('[Bot] Webhook anterior eliminado. Long Polling listo.');
        } catch (e) {
          console.error('[Bot] Error limpiando webhook:', e.message);
        }
      }

      const url = `https://api.telegram.org/bot${config.telegram_token}/getUpdates?offset=${botOffset}&timeout=30`;
      const res = await axios.get(url, { timeout: 35000 });
      
      if (res.data.ok && res.data.result.length > 0) {
        for (const update of res.data.result) {
          botOffset = update.update_id + 1;
          await handleBotUpdate(update, config);
        }
      }
    } catch (e) {
      if (e.code !== 'ECONNABORTED' && e.response?.status !== 502) {
        console.error('[Bot] Error en Long Polling:', e.response?.data || e.message);
      }
    }
    setTimeout(poll, 1000);
  };
  poll();
}

async function handleBotUpdate(update, config) {
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message.chat.id.toString();
    const data = cb.data;
    
    if (data.startsWith('anteriores_')) {
      const alumnoId = data.replace('anteriores_', '');
      const alumno = db.prepare('SELECT * FROM alumnos WHERE id = ?').get(alumnoId);
      const notas = db.prepare('SELECT * FROM notas WHERE alumno_id = ? AND autorizado = 1').all(alumnoId);
      
      if (alumno && notas.length > 0) {
        const appConfig = db.prepare('SELECT lapso_activo FROM app_config WHERE id = 1').get() || {lapso_activo: 1};
        let res = `📜 *Lapsos Anteriores: ${alumno.nombre}*\n\n`;
        notas.forEach(n => {
          res += `🔹 *${n.materia}:* `;
          let lapsosAnteriores = [];
          for (let i = 1; i < appConfig.lapso_activo; i++) {
            let subText = "";
            try {
              const subs = JSON.parse(n[`t${i}_sub`] || '[]');
              const filtered = subs.filter(v => v !== null && v !== "");
              if (filtered.length > 0) {
                subText = " `[" + filtered.join(" | ") + "]`";
              }
            } catch(e) {}
            lapsosAnteriores.push(`L${i}: ${n['tramo'+i]}${subText}`);
          }
          if (lapsosAnteriores.length > 0) {
            res += lapsosAnteriores.join('\n      ');
          } else {
            res += "No hay lapsos anteriores";
          }
          res += "\n";
        });
        await sendTelegramMsg(config.telegram_token, chatId, res);
      }
      try { await axios.post(`https://api.telegram.org/bot${config.telegram_token}/answerCallbackQuery`, { callback_query_id: cb.id }); } catch(e){}
    }
    return;
  }

  // Manejo de FOTOS
  if (update.message?.photo) {
    const msg = update.message;
    const chatId = msg.chat.id.toString();
    const photo = msg.photo[msg.photo.length - 1]; // La más grande
    const fileId = photo.file_id;

    try {
      // Obtener URL del archivo desde Telegram
      const fileRes = await axios.get(`https://api.telegram.org/bot${config.telegram_token}/getFile?file_id=${fileId}`);
      if (fileRes.data.ok) {
        const filePath = fileRes.data.result.file_path;
        const downloadUrl = `https://api.telegram.org/file/bot${config.telegram_token}/${filePath}`;
        
        // Descargar localmente
        const fileName = `sug_${Date.now()}_${path.basename(filePath)}`;
        const localPath = path.join(__dirname, 'public/uploads/sugerencias', fileName);
        
        const response = await axios({ url: downloadUrl, method: 'GET', responseType: 'stream' });
        const writer = fs.createWriteStream(localPath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });

        // Guardar en DB
        const alumno = db.prepare('SELECT nombre FROM alumnos WHERE telegram_chat_id = ? LIMIT 1').get(chatId);
        const remitente = alumno ? `Rep. de ${alumno.nombre}` : `Usuario Desconocido`;
        
        db.prepare('INSERT INTO sugerencias (id, chat_id, nombre, mensaje, foto_path) VALUES (?, ?, ?, ?, ?)')
          .run(crypto.randomUUID(), chatId, remitente, msg.caption || '(Foto sin mensaje)', `/uploads/sugerencias/${fileName}`);

        await sendTelegramMsg(config.telegram_token, chatId, "📸 ✅ *Foto recibida y guardada como sugerencia.*\nMuchas gracias por tu reporte visual. La administración ya puede verla.");
      }
    } catch (e) {
      console.error('[Bot] Error descargando foto:', e.message);
      await sendTelegramMsg(config.telegram_token, chatId, "❌ Hubo un error al procesar tu foto. Inténtalo de nuevo más tarde.");
    }
    return;
  }

  // Manejo de VIDEOS
  if (update.message?.video) {
    const msg = update.message;
    const chatId = msg.chat.id.toString();
    const fileId = msg.video.file_id;

    try {
      const fileRes = await axios.get(`https://api.telegram.org/bot${config.telegram_token}/getFile?file_id=${fileId}`);
      if (fileRes.data.ok) {
        const filePath = fileRes.data.result.file_path;
        const downloadUrl = `https://api.telegram.org/file/bot${config.telegram_token}/${filePath}`;
        
        const fileName = `sug_video_${Date.now()}_${path.basename(filePath)}`;
        const localPath = path.join(__dirname, 'public/uploads/sugerencias', fileName);
        
        const response = await axios({ url: downloadUrl, method: 'GET', responseType: 'stream' });
        const writer = fs.createWriteStream(localPath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });

        const alumno = db.prepare('SELECT nombre FROM alumnos WHERE telegram_chat_id = ? LIMIT 1').get(chatId);
        const remitente = alumno ? `Rep. de ${alumno.nombre}` : `Usuario Desconocido`;
        
        db.prepare('INSERT INTO sugerencias (id, chat_id, nombre, mensaje, video_path) VALUES (?, ?, ?, ?, ?)')
          .run(crypto.randomUUID(), chatId, remitente, msg.caption || '(Video sin mensaje)', `/uploads/sugerencias/${fileName}`);

        await sendTelegramMsg(config.telegram_token, chatId, "🎥 ✅ *Vídeo recibido y guardado como sugerencia.*\nMuchas gracias. La administración ya puede revisarlo.");
      }
    } catch (e) {
      console.error('[Bot] Error descargando video:', e.message);
      await sendTelegramMsg(config.telegram_token, chatId, "❌ Hubo un error al procesar tu vídeo.");
    }
    return;
  }

  if (!update.message || !update.message.text) return;
  const msg = update.message;
  const text = msg.text.trim();
  const chatId = msg.chat.id.toString();

  const keyboard = {
    keyboard: [
      [{ text: "📊 Mis Notas" }, { text: "🔓 Desvincular" }],
      [{ text: "❓ Ayuda" }, { text: "💡 Sugerencias" }]
    ],
    resize_keyboard: true
  };

  if (text.startsWith('/start')) {
    const isLinked = db.prepare('SELECT count(*) as count FROM alumnos WHERE telegram_chat_id = ?').get(chatId).count > 0;
    const extra = isLinked ? "" : "\n\nEnvía el número de cédula del estudiante para vincular tu cuenta.";
    await sendTelegramMsg(config.telegram_token, chatId, "👋 *Bienvenido al Sistema de Notas*\n\nPor seguridad, debes vincular tu cuenta con el estudiante." + extra, isLinked ? keyboard : null);
  } else if (text === "📊 Mis Notas") {
    const alumnos = db.prepare('SELECT * FROM alumnos WHERE telegram_chat_id = ?').all(chatId);
    if (alumnos.length === 0) {
      await sendTelegramMsg(config.telegram_token, chatId, "❌ No tienes estudiantes vinculados. Envía un número de cédula para vincular uno.");
    } else {
      for (const alumno of alumnos) {
        const notas = db.prepare('SELECT * FROM notas WHERE alumno_id = ? AND autorizado = 1').all(alumno.id);
        if (notas.length === 0) {
          await sendTelegramMsg(config.telegram_token, chatId, `👤 *Estudiante:* ${alumno.nombre}\n⚠️ No tiene notas autorizadas para publicar.`);
        } else {
          const appConfig = db.prepare('SELECT lapso_activo FROM app_config WHERE id = 1').get() || {lapso_activo: 1};
          const lapso = appConfig.lapso_activo;
          let res = `📊 *Calificaciones: ${alumno.nombre}*\n\n`;
          notas.forEach(n => {
            const isFinal = n.estado === "Aprobado" || n.estado === "Reprobado";
            const notaLapso = n[`tramo${lapso}`] !== undefined ? n[`tramo${lapso}`] : "—";
            
            // Obtener sub-notas (evaluaciones individuales) del lapso activo
            let subText = "";
            try {
              const subs = JSON.parse(n[`t${lapso}_sub`] || '[]');
              const filtered = subs.filter(v => v !== null && v !== "");
              if (filtered.length > 0) {
                subText = " `[" + filtered.join(" | ") + "]`";
              }
            } catch(e) {}

            res += `🔹 *${n.materia}:* L${lapso}: ${notaLapso}${subText}`;
            if (isFinal) {
              res += ` | Promedio: ${n.promedio.toFixed(1)} (${n.estado})`;
            }
            res += "\n";
          });
          
          let inlineKb = null;
          if (lapso > 1) {
            inlineKb = { inline_keyboard: [[{ text: "Ver Lapsos Anteriores", callback_data: `anteriores_${alumno.id}` }]] };
          }
          
          await sendTelegramMsg(config.telegram_token, chatId, res, inlineKb);
        }
      }
    }
  } else if (text === "🔓 Desvincular") {
    const result = db.prepare('UPDATE alumnos SET telegram_chat_id = NULL, dirty = 1 WHERE telegram_chat_id = ?').run(chatId);
    if (result.changes > 0) {
      await sendTelegramMsg(config.telegram_token, chatId, "🔓 *Desvinculación Exitosa*\nSe han desvinculado todos los estudiantes de esta cuenta. Ya no recibirás sus notas hasta que vuelvas a vincularlos.", { remove_keyboard: true });
    } else {
      await sendTelegramMsg(config.telegram_token, chatId, "No tenías estudiantes vinculados.");
    }
  } else if (text === "❓ Ayuda") {
    await sendTelegramMsg(config.telegram_token, chatId, "ℹ️ *Ayuda del Sistema*\n\n- *Vincular:* Envía un número de cédula.\n- *Mis Notas:* Muestra calificaciones vinculadas.\n- *Desvincular:* Elimina el vínculo de seguridad.\n- *Sugerencias:* Envía /sugerencia seguido de tu mensaje o *envía una foto directamente*.");
  } else if (text === "💡 Sugerencias") {
    await sendTelegramMsg(config.telegram_token, chatId, "📝 *Buzón de Sugerencias*\n\nPara enviar una sugerencia al colegio:\n1️⃣ Escribe `/sugerencia` seguido de tu mensaje.\n2️⃣ O simplemente **envíame una foto ahora mismo** (puedes añadirle un comentario).");
  } else if (text.startsWith('/sugerencia')) {
    const mensaje = text.replace('/sugerencia', '').trim();
    if (!mensaje) {
      await sendTelegramMsg(config.telegram_token, chatId, "⚠️ Debes escribir el mensaje después del comando.\nEjemplo: `/sugerencia Hola, mi sugerencia es...`");
    } else {
      const alumno = db.prepare('SELECT nombre FROM alumnos WHERE telegram_chat_id = ? LIMIT 1').get(chatId);
      const remitente = alumno ? `Rep. de ${alumno.nombre}` : `Usuario Desconocido`;
      db.prepare('INSERT INTO sugerencias (id, chat_id, nombre, mensaje) VALUES (?, ?, ?, ?)').run(crypto.randomUUID(), chatId, remitente, mensaje);
      await sendTelegramMsg(config.telegram_token, chatId, "✅ *Sugerencia enviada.*\nMuchas gracias por tu aporte. Ha sido enviado a la administración.");
    }
  } else if (/^\d+$/.test(text)) {
    const alumno = db.prepare('SELECT * FROM alumnos WHERE ci = ?').get(text);
    if (!alumno) {
      await sendTelegramMsg(config.telegram_token, chatId, "❌ *Estudiante no encontrado.* Verifique el número de cédula.");
    } else {
      if (alumno.telegram_chat_id && alumno.telegram_chat_id !== chatId) {
        await sendTelegramMsg(config.telegram_token, chatId, "🚫 *Acceso Denegado*\nEsta cédula ya fue vinculada a otra cuenta de Telegram por seguridad. Si esto es un error, contacte a la administración escolar.");
        return;
      }
      if (!alumno.telegram_chat_id) {
        db.prepare('UPDATE alumnos SET telegram_chat_id = ?, dirty = 1 WHERE id = ?').run(chatId, alumno.id);
        await sendTelegramMsg(config.telegram_token, chatId, "✅ *Vínculo Exitoso*\nLa cédula de " + alumno.nombre + " ha sido asegurada a esta cuenta de Telegram de forma exclusiva.", keyboard);
      } else {
        await sendTelegramMsg(config.telegram_token, chatId, "✅ Esta cédula ya está vinculada a tu cuenta.", keyboard);
      }

      const notas = db.prepare('SELECT * FROM notas WHERE alumno_id = ? AND autorizado = 1').all(alumno.id);
      if (notas.length === 0) {
        await sendTelegramMsg(config.telegram_token, chatId, `👤 *Estudiante:* ${alumno.nombre}\n⚠️ No tiene notas autorizadas para publicar.`);
      } else {
        const appConfig = db.prepare('SELECT lapso_activo FROM app_config WHERE id = 1').get() || {lapso_activo: 1};
        const lapso = appConfig.lapso_activo;
        let res = `📊 *Calificaciones: ${alumno.nombre}*\n\n`;
        notas.forEach(n => {
          const isFinal = n.estado === "Aprobado" || n.estado === "Reprobado";
          const notaLapso = n[`tramo${lapso}`] !== undefined ? n[`tramo${lapso}`] : "—";
          
          // Obtener sub-notas (evaluaciones individuales) del lapso activo
          let subText = "";
          try {
            const subs = JSON.parse(n[`t${lapso}_sub`] || '[]');
            const filtered = subs.filter(v => v !== null && v !== "");
            if (filtered.length > 0) {
              subText = " `[" + filtered.join(" | ") + "]`";
            }
          } catch(e) {}

          res += `🔹 *${n.materia}:* L${lapso}: ${notaLapso}${subText}`;
          if (isFinal) {
            res += ` | Promedio: ${n.promedio.toFixed(1)} (${n.estado})`;
          }
          res += "\n";
        });
        
        let inlineKb = null;
        if (lapso > 1) {
          inlineKb = { inline_keyboard: [[{ text: "Ver Lapsos Anteriores", callback_data: `anteriores_${alumno.id}` }]] };
        }
        
        await sendTelegramMsg(config.telegram_token, chatId, res, inlineKb);
      }
    }
  } else {
    await sendTelegramMsg(config.telegram_token, chatId, "🤔 *Comando no reconocido*\nUsa los botones del menú o envía una cédula válida.");
  }
}

async function sendTelegramMsg(token, chatId, text, reply_markup = null) {
  try {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    };
    if (reply_markup) payload.reply_markup = reply_markup;
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, payload);
  } catch (e) {
    console.error('[Bot] Error enviando mensaje:', e.message);
  }
}

// Iniciar Bot
startTelegramBot();

// Publicar Notas
app.post('/api/telegram/publish', async (req, res) => {
  const { is_test, nota_id, alumno_id } = req.body;
  const config = db.prepare('SELECT * FROM bot_config WHERE id = 1').get();
  if (!config || !config.enabled || !config.telegram_token) return res.status(400).json({ error: 'Bot no configurado' });

  try {
    if (is_test) {
      await sendTelegramMsg(config.telegram_token, config.telegram_chat_id, "🔔 *Prueba Local:* Bot funcionando al 100% sin depender de Supabase.");
      return res.json({ success: true });
    }
    
    // Publicar todas las notas autorizadas de un alumno directamente a su chat personal
    if (alumno_id) {
      const alumno = db.prepare('SELECT * FROM alumnos WHERE id = ?').get(alumno_id);
      if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });
      if (!alumno.telegram_chat_id) return res.status(400).json({ error: 'Este estudiante no tiene un Telegram vinculado' });
      
      const notas = db.prepare('SELECT * FROM notas WHERE alumno_id = ? AND autorizado = 1').all(alumno_id);
      if (notas.length === 0) return res.status(400).json({ error: 'No hay notas autorizadas para este estudiante' });
      
      const appConfig = db.prepare('SELECT lapso_activo FROM app_config WHERE id = 1').get() || {lapso_activo: 1};
      const lapso = appConfig.lapso_activo;
      let msg = `🔔 *Actualización de Calificaciones: ${alumno.nombre}*\n\n`;
      notas.forEach(n => {
        const isFinal = n.estado === "Aprobado" || n.estado === "Reprobado";
        const notaLapso = n[`tramo${lapso}`] !== undefined ? n[`tramo${lapso}`] : "—";
        
        // Obtener sub-notas (evaluaciones individuales) del lapso activo
        let subText = "";
        try {
          const subs = JSON.parse(n[`t${lapso}_sub`] || '[]');
          const filtered = subs.filter(v => v !== null && v !== "");
          if (filtered.length > 0) {
            subText = " `[" + filtered.join(" | ") + "]`";
          }
        } catch(e) {}

        msg += `🔹 *${n.materia}:* L${lapso}: ${notaLapso}${subText}`;
        if (isFinal) {
          msg += ` | Promedio: ${n.promedio.toFixed(1)} (${n.estado})`;
        }
        msg += "\n";
      });
      
      let inlineKb = null;
      if (lapso > 1) {
        inlineKb = { inline_keyboard: [[{ text: "Ver Lapsos Anteriores", callback_data: `anteriores_${alumno.id}` }]] };
      }
      
      await sendTelegramMsg(config.telegram_token, alumno.telegram_chat_id, msg, inlineKb);
      db.prepare('UPDATE notas SET publicado = 1 WHERE alumno_id = ? AND autorizado = 1').run(alumno_id);
      return res.json({ success: true });
    }

    if (nota_id) {
      const nota = db.prepare('SELECT n.*, a.nombre, a.ci FROM notas n JOIN alumnos a ON n.alumno_id = a.id WHERE n.id = ?').get(nota_id);
      if (nota) {
        const msg = `✅ *Nueva Nota Publicada*\n\n👤 *Estudiante:* ${nota.nombre}\n🆔 *CI:* ${nota.ci}\n📚 *Materia:* ${nota.materia}\n📝 *Promedio:* ${nota.promedio.toFixed(2)}`;
        await sendTelegramMsg(config.telegram_token, config.telegram_chat_id, msg);
        db.prepare('UPDATE notas SET publicado = 1 WHERE id = ?').run(nota_id);
      }
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Broadcast Segmentado
app.post('/api/telegram/broadcast', async (req, res) => {
  const { mensaje, filtro, valor } = req.body;
  if (!mensaje) return res.status(400).json({ error: 'Mensaje vacío' });

  const config = db.prepare('SELECT * FROM bot_config WHERE id = 1').get();
  if (!config || !config.enabled || !config.telegram_token) {
    return res.status(400).json({ error: 'Bot no configurado o inactivo' });
  }

  try {
    let query = 'SELECT DISTINCT telegram_chat_id FROM alumnos WHERE telegram_chat_id IS NOT NULL';
    let params = [];

    if (filtro === 'grado') {
      query += ' AND grado = ?';
      params.push(valor);
    } else if (filtro === 'seccion') {
      // Si el filtro es sección, generalmente depende también del grado, pero aquí lo haremos global o combinado
      if (valor.includes('|')) {
        const [g, s] = valor.split('|');
        query += ' AND grado = ? AND seccion = ?';
        params.push(g, s);
      } else {
        query += ' AND seccion = ?';
        params.push(valor);
      }
    } else if (filtro === 'alumno') {
      if (valor.includes(',')) {
        const ids = valor.split(',');
        query += ` AND id IN (${ids.map(() => '?').join(',')})`;
        params.push(...ids);
      } else {
        query += ' AND id = ?';
        params.push(valor);
      }
    }

    const chats = db.prepare(query).all(...params);
    let sent = 0;
    for (const chat of chats) {
      try {
        await sendTelegramMsg(config.telegram_token, chat.telegram_chat_id, `📢 *Comunicado Escolar*\n\n${mensaje}`);
        sent++;
      } catch (err) {
        console.error(`[Bot] Fallo envío a ${chat.telegram_chat_id}:`, err.message);
      }
    }
    res.json({ success: true, sent });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Responder Sugerencia
app.post('/api/telegram/reply-sugerencia', async (req, res) => {
  const { chat_id, respuesta } = req.body;
  if (!chat_id || !respuesta) return res.status(400).json({ error: 'Datos incompletos' });

  const config = db.prepare('SELECT * FROM bot_config WHERE id = 1').get();
  if (!config || !config.enabled || !config.telegram_token) {
    return res.status(400).json({ error: 'Bot inactivo' });
  }

  try {
    await sendTelegramMsg(config.telegram_token, chat_id, `✉️ *Respuesta de la Institución a su Sugerencia:*\n\n${respuesta}`);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Mensajes Fijos (Plantillas)
app.get('/api/plantillas', (req, res) => {
  try {
    const list = db.prepare('SELECT * FROM mensajes_fijos ORDER BY created_at DESC').all();
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/plantillas', (req, res) => {
  const { titulo, mensaje } = req.body;
  if (!titulo || !mensaje) return res.status(400).json({ error: 'Faltan datos' });
  try {
    db.prepare('INSERT INTO mensajes_fijos (id, titulo, mensaje) VALUES (?, ?, ?)')
      .run(crypto.randomUUID(), titulo, mensaje);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/plantillas/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM mensajes_fijos WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(express.static(path.join(__dirname, 'dist')));
app.use((req, res) => {
  if (!req.url.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    res.status(404).json({ error: 'Not Found' });
  }
});

// --- 5. Inicio del Servidor ---
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

app.listen(port, '0.0.0.0', () => {
  const ip = getLocalIp();
  console.log('========================================================');
  console.log('   SISTEMA 100% LOCAL Y AUTÓNOMO ACTIVO');
  console.log('========================================================');
  console.log(`> Acceso Local:  http://localhost:${port}`);
  console.log(`> Red LAN IP:   http://${ip}:${port}`);
  console.log(`> Base de Datos: ${dbFile}`);
  console.log('--------------------------------------------------------');
  console.log('El sistema ya NO usa Supabase. Todo se procesa aquí.');
  console.log('========================================================');

  // Habilitar túnel público automático
  async function startTunnel() {
    try {
      console.log('[Túnel] Iniciando túnel público automático...');
      const tunnel = await localtunnel({ port: 8080 });
      const publicUrl = `${tunnel.url}/api/android/sync`;
      
      // Guardar URL del túnel en la base de datos
      db.prepare('UPDATE app_config SET api_public_url = ? WHERE id = 1').run(publicUrl);
      
      console.log('========================================================');
      console.log(`   > TÚNEL INTERNET ACTIVO: ${publicUrl}`);
      console.log('========================================================');

      tunnel.on('close', () => {
        console.log('[Túnel] El túnel de internet se ha cerrado.');
      });
    } catch (e) {
      console.warn('[Túnel] No se pudo activar el túnel automático:', e.message);
    }
  }
  startTunnel();
});