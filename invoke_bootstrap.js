import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const url = envFile.match(/VITE_SUPABASE_URL="?([^"\s]+)"?/)?.[1];
const key = envFile.match(/SUPABASE_SERVICE_ROLE_KEY="?([^"\s]+)"?/)?.[1];

if (url && key) {
  const supabase = createClient(url, key);
  console.log("Invoking bootstrap-root...");
  const { data, error } = await supabase.functions.invoke('bootstrap-root');
  if (error) {
    console.error("Error invoking function:", error);
    try {
        const text = await error.context.text();
        console.error("Error text:", text);
    } catch(e) {}
  }
  else console.log("Result:", data);
} else {
  console.log("Missing URL or Key in .env");
}
