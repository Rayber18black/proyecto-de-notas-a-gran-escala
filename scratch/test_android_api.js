import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbFile = path.join(__dirname, '../local_db.db');

try {
  console.log(`Abriendo base de datos: ${dbFile}`);
  const db = new Database(dbFile);

  // 1. Verificar tabla api_connected_devices
  console.log('\n--- Verificando api_connected_devices ---');
  const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='api_connected_devices'").get();
  if (tableCheck) {
    console.log('✅ La tabla api_connected_devices existe con éxito.');
  } else {
    console.error('❌ La tabla api_connected_devices NO existe.');
  }

  // 2. Verificar columnas en app_config
  console.log('\n--- Verificando columnas en app_config ---');
  const pragma = db.prepare("PRAGMA table_info(app_config)").all();
  const columns = pragma.map(col => col.name);
  
  const expectedCols = ['aes_encryption_enabled', 'aes_encryption_key', 'android_api_key', 'api_public_url'];
  expectedCols.forEach(col => {
    if (columns.includes(col)) {
      console.log(`✅ La columna ${col} existe en app_config.`);
    } else {
      console.error(`❌ La columna ${col} NO existe en app_config.`);
    }
  });

  // 3. Verificar que se haya generado la API Key
  console.log('\n--- Verificando datos de app_config ---');
  const config = db.prepare("SELECT * FROM app_config WHERE id = 1").get();
  console.log("Configuración actual:", JSON.stringify(config, null, 2));
  
  if (config && config.android_api_key) {
    console.log(`✅ API Key actual: ${config.android_api_key}`);
  } else {
    console.error('❌ No se ha generado la API Key por defecto.');
  }

  db.close();
  console.log('\nPruebas finalizadas con éxito.');
} catch (e) {
  console.error('Error durante la verificación de la BD:', e);
}
