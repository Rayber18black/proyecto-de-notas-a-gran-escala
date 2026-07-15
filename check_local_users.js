import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbFile = path.join(__dirname, 'local_db.db');
const db = new Database(dbFile);

console.log("Checking local database for Rayber...");

const rayberProfile = db.prepare('SELECT * FROM profiles WHERE nombre LIKE ? OR ci = ?').get('%Rayber%', 'ROOT');
console.log("Profile:", rayberProfile);

if (rayberProfile) {
    const roles = db.prepare('SELECT * FROM user_roles WHERE user_id = ?').all(rayberProfile.id);
    console.log("Roles:", roles);
} else {
    console.log("Rayber profile not found in local database.");
}

const allUsers = db.prepare('SELECT * FROM profiles').all();
console.log("\nAll local profiles:", allUsers);

const allRoles = db.prepare('SELECT * FROM user_roles').all();
console.log("All local roles:", allRoles);
