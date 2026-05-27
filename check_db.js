import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import fs from 'fs';

const envConfig = dotenv.parse(fs.readFileSync('.env'));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
globalThis.WebSocket = WebSocket;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const tables = ['assigned_cards', 'assigned_card_votes', 'group_cards', 'group_labels', 'label_votes', 'weekly_votes', 'group_settings'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('id').limit(1);
    if (error) {
      console.log(`Table ${t} error:`, error.message);
    } else {
      console.log(`Table ${t} exists.`);
    }
  }
}
check();
