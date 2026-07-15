import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const url = envFile.match(/VITE_SUPABASE_URL="?([^"\s]+)"?/)?.[1];
const key = envFile.match(/SUPABASE_SERVICE_ROLE_KEY="?([^"\s]+)"?/)?.[1];

if (url && key) {
  const supabase = createClient(url, key);
  const email = "rayber@local.app";
  const password = "adminrayber123";

  console.log(`Checking for user ${email}...`);
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
  
  if (listErr) {
    console.error("Error listing users:", listErr);
    process.exit(1);
  }

  const found = users.find(u => u.email === email);

  if (found) {
    console.log(`User found (ID: ${found.id}). Resetting password...`);
    const { error: updErr } = await supabase.auth.admin.updateUserById(found.id, { 
      password,
      email_confirm: true 
    });
    if (updErr) console.error("Error updating user:", updErr);
    else console.log("Password reset successful.");

    console.log("Ensuring root role in Cloud DB...");
    const { error: roleErr } = await supabase.from('user_roles').upsert({ user_id: found.id, role: 'root' }, { onConflict: 'user_id,role' });
    if (roleErr) console.error("Error setting role:", roleErr);
    else console.log("Role set to root.");

  } else {
    console.log("User not found. Creating...");
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre: "Rayber", username: "rayber" }
    });
    
    if (createErr) {
      console.error("Error creating user:", createErr);
    } else {
      console.log(`User created (ID: ${created.user.id}).`);
      console.log("Setting root role in Cloud DB...");
      const { error: roleErr } = await supabase.from('user_roles').insert({ user_id: created.user.id, role: 'root' });
      if (roleErr) console.error("Error setting role:", roleErr);
      else console.log("Role set to root.");
    }
  }
} else {
  console.log("Missing URL or Key in .env");
}
