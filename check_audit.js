import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const url = envFile.match(/VITE_SUPABASE_URL="(.*)"/)[1];
const key = envFile.match(/VITE_SUPABASE_PUBLISHABLE_KEY="(.*)"/)[1];

const supabase = createClient(url, key);

supabase.from('notas_audit').select('*').limit(5).then(res => {
  console.log(JSON.stringify(res.data, null, 2));
});
