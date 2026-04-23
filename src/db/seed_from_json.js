import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Manual .env parser
function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        process.env[key] = value;
      }
    }
  } catch (err) {
    console.error('Error loading .env file:', err);
  }
}

loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase Service Role Key in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function splitName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return { paterno: parts[0] || '', materno: '', nombres: '' };
  return {
    paterno: parts[0],
    materno: parts[1],
    nombres: parts.slice(2).join(' ')
  };
}

async function seedSede(jsonPath, sedeId) {
  const dataPath = path.resolve(process.cwd(), jsonPath);
  if (!fs.existsSync(dataPath)) return;
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  console.log(`Seeding data for ${sedeId} from ${jsonPath}...`);

  // 1. Insert Cursos
  const cursosToInsert = data.cursos.map(c => {
    let nivel = 'Medio Mayor';
    if (c.nivel.includes('Transición 1')) nivel = 'NT1';
    if (c.nivel.includes('Transición 2')) nivel = 'NT2';

    return {
      id: c.curso_id,
      nombre: c.nivel.replace('Nivel ', ''),
      nivel: nivel,
      profesor_jefe: c.profesor_jefe,
      sede_id: sedeId
    };
  });

  const { error: cursoError } = await supabase.from('cursos').upsert(cursosToInsert);
  if (cursoError) console.error(`Error seeding cursos (${sedeId}):`, cursoError.message);

  // 2. Insert Estudiantes
  const seenRuts = new Set();
  const estudiantesToInsert = data.estudiantes
    .map(e => {
      const cleanRut = e.run.replace(/\./g, '').replace(/-/g, '').toUpperCase();
      if (seenRuts.has(cleanRut)) return null;
      seenRuts.add(cleanRut);

      const { paterno, materno, nombres } = splitName(e.nombre);
      let nivel = 'Medio Mayor';
      if (e.curso_id.includes('TRANS_1')) nivel = 'NT1';
      if (e.curso_id.includes('TRANS_2')) nivel = 'NT2';

      return {
        rut: cleanRut,
        nombre: nombres,
        apellido_paterno: paterno,
        apellido_materno: materno,
        nivel: nivel,
        curso_id: e.curso_id,
        sede_id: sedeId,
        activo: !e.obs.includes('RET.')
      };
    })
    .filter(Boolean);

  const { error: estError } = await supabase.from('estudiantes').upsert(estudiantesToInsert, { onConflict: 'rut' });
  if (estError) {
    console.error(`Error seeding estudiantes (${sedeId}):`, JSON.stringify(estError, null, 2));
  } else {
    console.log(`Successfully seeded ${sedeId}.`);
  }
}

async function run() {
  await seedSede('src/db/students_data.json', 'vascongados');
  await seedSede('src/db/students_gambino.json', 'gambino');
}

run().catch(console.error);
