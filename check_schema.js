import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Try to read .env file for credentials
const envFile = fs.readFileSync('.env', 'utf-8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL="?([^"\s]+)"?/);
const keyMatch = envFile.match(/VITE_SUPABASE_PUBLISHABLE_KEY="?([^"\s]+)"?/);

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1]);
  console.log("Checking app_config...");
  const { data: config, error: configError } = await supabase.from('app_config').select('*').limit(1).maybeSingle();
  if (configError) console.error("Error app_config:", configError);
  else console.log("app_config:", JSON.stringify(config, null, 2));

  console.log("\nChecking notas columns...");
  const { data: notas, error: notasError } = await supabase.from('notas').select('*').limit(1);
  if (notasError) console.error("Error notas:", notasError);
  else if (notas && notas.length > 0) console.log("notas sample:", JSON.stringify(notas[0], null, 2));
  else console.log("No notas found to check columns");
} else {
  console.log("No env variables found");
}
