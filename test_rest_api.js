import axios from 'axios';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const url = envFile.match(/VITE_SUPABASE_URL="?([^"\s]+)"?/)?.[1];
const key = envFile.match(/SUPABASE_SERVICE_ROLE_KEY="?([^"\s]+)"?/)?.[1];

if (url && key) {
  try {
    console.log("Testing REST API access...");
    const res = await axios.get(`${url}/rest/v1/alumnos?select=id&limit=1`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    console.log("REST API Result:", res.data);
  } catch (err) {
    console.error("REST API Error:", err.response ? JSON.stringify(err.response.data) : err.message);
  }
}
