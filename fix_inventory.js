import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnv() {
  const envPath = path.resolve(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        process.env[key] = value;
      }
    });
  }
}

loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkInventory() {
  console.log('Fetching ALL inventory to see what departments exist...');
  const { data: inventory, error } = await supabase
    .from('department_inventory')
    .select('*, items(name)');

  if (error) {
    console.error('Error fetching inventory:', error);
    return;
  }

  console.log(`Found ${inventory.length} total items in department_inventory.`);
  
  for (const item of inventory) {
    console.log(`- Dept: "${item.department}", Item: "${item.items?.name || 'Unknown'}", Qty: ${item.quantity}, ID: ${item.id}`);
  }

  // Now fix the ones that contain "Bar" in the department name (case-insensitive)
  const barItems = inventory.filter(i => i.department.toLowerCase().includes('bar'));
  
  for (const item of barItems) {
    if (!item.items) {
      console.log(`Deleting Unknown Item with ID: ${item.id}`);
      await supabase.from('department_inventory').delete().eq('id', item.id);
      continue;
    }

    const newQuantity = item.quantity / 2;
    console.log(`Fixing Item ${item.item_id} (${item.items.name}): ${item.quantity} -> ${newQuantity}`);
    
    await supabase
      .from('department_inventory')
      .update({ quantity: newQuantity })
      .eq('id', item.id);
  }

  console.log('Inventory fix complete!');
}

checkInventory();
