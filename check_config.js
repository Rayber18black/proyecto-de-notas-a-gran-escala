import Database from 'better-sqlite3';
const db = new Database('local_db.db');
const config = db.prepare('SELECT * FROM app_config WHERE id = 1').get();
console.log("APP CONFIG IN SQLITE:", JSON.stringify(config, null, 2));

const alumnosCount = db.prepare('SELECT count(*) as count FROM alumnos').get().count;
console.log("TOTAL ALUMNOS IN SQLITE:", alumnosCount);

const notasCount = db.prepare('SELECT count(*) as count FROM notas').get().count;
console.log("TOTAL NOTAS IN SQLITE:", notasCount);

if (notasCount > 0) {
  const sampleNota = db.prepare('SELECT * FROM notas LIMIT 1').get();
  console.log("SAMPLE NOTA IN SQLITE:", JSON.stringify(sampleNota, null, 2));
}

db.close();
