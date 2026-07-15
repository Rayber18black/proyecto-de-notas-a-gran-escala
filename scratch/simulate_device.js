import axios from 'axios';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbFile = path.join(__dirname, '../local_db.db');

async function runTest() {
  try {
    const db = new Database(dbFile);
    const config = db.prepare('SELECT android_api_key FROM app_config WHERE id = 1').get();
    db.close();

    if (!config || !config.android_api_key) {
      console.error('❌ No se encontró una clave API en la base de datos.');
      return;
    }

    const apiKey = config.android_api_key;
    console.log(`Clave API obtenida: ${apiKey}`);

    // 1. Simular la petición de sincronización desde el celular
    console.log('\n--- Enviando petición de sincronización de Android ---');
    const syncRes = await axios.get('http://localhost:8080/api/android/sync', {
      headers: {
        'x-device-id': 'simulated-pixel-8-pro',
        'x-device-name': 'Pixel 8 Pro Rayber',
        'x-device-model': 'Google Pixel 8 Pro',
        'x-device-os': 'Android 14 (API 34)',
        'Authorization': `Bearer ${apiKey}`
      }
    });

    console.log(`✅ Sincronización exitosa. Estado: ${syncRes.status}`);
    console.log(`Alumnos recibidos: ${syncRes.data.alumnos.length}`);
    console.log(`Notas recibidas: ${syncRes.data.notas.length}`);

    // 2. Consultar la lista de dispositivos registrados para el dashboard
    console.log('\n--- Consultando lista de dispositivos en el Dashboard ---');
    const devicesRes = await axios.get('http://localhost:8080/api/config/devices');
    console.log('Dispositivos Conectados en DB:', JSON.stringify(devicesRes.data, null, 2));

    const simulatedDeviceExists = devicesRes.data.some(d => d.device_id === 'simulated-pixel-8-pro');
    if (simulatedDeviceExists) {
      console.log('\n🎉 ¡PRUEBA COMPLETADA CON ÉXITO! El dispositivo simulado se registró correctamente en el Dashboard.');
    } else {
      console.error('\n❌ Error: El dispositivo simulado no aparece en el listado.');
    }

  } catch (err) {
    console.error('❌ Error ejecutando la simulación:', err.response ? err.response.data : err.message);
  }
}

runTest();
