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
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const data = {
  "estudiantes": [
    {"run": "27954476-5", "nombre": "ALCINDOR TORRES THIAGO KEVIN STIVEN", "curso_id": "MED_MAYOR_A", "fecha_inc": "01/03/2026", "obs": "RET. 02/03/2026"},
    {"run": "27969785-5", "nombre": "ARISMENDI RUBIO MAXIMILIANO IGNACIO", "curso_id": "MED_MAYOR_A", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27783464-2", "nombre": "AYALA GALLARDO AGUSTINA IGNACIA", "curso_id": "MED_MAYOR_A", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27782855-3", "nombre": "CASAS TAPIA LUCAS AIVAR EMILIANO", "curso_id": "MED_MAYOR_A", "fecha_inc": "11/03/2026", "obs": ""},
    {"run": "27786319-7", "nombre": "CELEDÓN MUÑOZ AMELIA AMPARO", "curso_id": "MED_MAYOR_A", "fecha_inc": "16/03/2026", "obs": ""},
    {"run": "27781962-7", "nombre": "CORONADO SANTISTEBAN LUCAS MAURICIO ISRAEL", "curso_id": "MED_MAYOR_A", "fecha_inc": "11/03/2026", "obs": ""},
    {"run": "27759110-3", "nombre": "CUEVAS MATEO LUNA YILDARIS", "curso_id": "MED_MAYOR_A", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27859484-K", "nombre": "DUVAL MORIN DENSLEY MAX RODLY", "curso_id": "MED_MAYOR_A", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27997367-4", "nombre": "GONZALES PEDROZA YARIZA CEMRE", "curso_id": "MED_MAYOR_A", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27768205-2", "nombre": "GUERRA OLIVA VALENTINA AYALEN", "curso_id": "MED_MAYOR_A", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27893013-0", "nombre": "MEJIAS GONZALEZ DYLAN MATEO", "curso_id": "MED_MAYOR_A", "fecha_inc": "04/03/2026", "obs": ""},
    {"run": "27980501-1", "nombre": "MOSCOSO BUSTAMANTE MATIAS ALEXIS", "curso_id": "MED_MAYOR_A", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27870140-9", "nombre": "MUÑOZ CANALES ESTELA MARIA", "curso_id": "MED_MAYOR_A", "fecha_inc": "11/03/2026", "obs": ""},
    {"run": "27815824-1", "nombre": "RODRIGUEZ TARAZONA ISABELLA VICTORIA", "curso_id": "MED_MAYOR_A", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27779350-4", "nombre": "YANEZ CORNEJO MATHEO SANTIAGO", "curso_id": "MED_MAYOR_A", "fecha_inc": "11/03/2026", "obs": ""},
    {"run": "28082124-1", "nombre": "SALAS QUISPE JULIANA VALENTINA", "curso_id": "MED_MAYOR_A", "fecha_inc": "25/03/2026", "obs": ""},
    {"run": "27954476-5", "nombre": "ALCINDOR TORRES THIAGO KEVIN STIVEN", "curso_id": "MED_MAYOR_B", "fecha_inc": "02/03/2026", "obs": ""},
    {"run": "28101925-2", "nombre": "BARQUI ORTEGA MAXIMO IGNACIO", "curso_id": "MED_MAYOR_B", "fecha_inc": "18/03/2026", "obs": ""},
    {"run": "27832061-8", "nombre": "CÁCERES SILVA SEBASTIAN MATHIAS", "curso_id": "MED_MAYOR_B", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "28000005-1", "nombre": "CAMPOS JOPIA EFRAIN DONATO", "curso_id": "MED_MAYOR_B", "fecha_inc": "04/03/2026", "obs": ""},
    {"run": "27963587-6", "nombre": "CORDERO VALERA IAN JOSE", "curso_id": "MED_MAYOR_B", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27867651-K", "nombre": "DÍAZ ONFRAY JESÚS JAIR NICOLÁS", "curso_id": "MED_MAYOR_B", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27971688-4", "nombre": "GALINDO SALGADO JOSEFA AUGUSTA", "curso_id": "MED_MAYOR_B", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27877844-4", "nombre": "GALVEZ LOPEZ MARÍA JOSÉ", "curso_id": "MED_MAYOR_B", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27987915-5", "nombre": "LOBOS ÑANCUCHEO MATÍAS DEMIAN", "curso_id": "MED_MAYOR_B", "fecha_inc": "04/03/2026", "obs": ""},
    {"run": "27964641-K", "nombre": "MIRANDA ABARCA AGUSTINA ORNELLA CATALEYA", "curso_id": "MED_MAYOR_B", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27902426-5", "nombre": "MORALES CARVAJAL ALMA ESTHER FLORENCIA", "curso_id": "MED_MAYOR_B", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27775311-1", "nombre": "OCANDO BABOGREDAZ SOLIMAR VICTORIA", "curso_id": "MED_MAYOR_B", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "28090490-2", "nombre": "ORTIZ TAPIA JACOB SCOTT DARELL", "curso_id": "MED_MAYOR_B", "fecha_inc": "10/03/2026", "obs": ""},
    {"run": "28070394-K", "nombre": "ROJAS LEDESMA MAITE AYLEN", "curso_id": "MED_MAYOR_B", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27894436-0", "nombre": "SOTO VEGA EITHAN ALEXIS", "curso_id": "MED_MAYOR_B", "fecha_inc": "01/03/2026", "obs": "RET. 23/03/2026"},
    {"run": "27772775-7", "nombre": "TAPIA RUMINOT VALENTINO ALONSO", "curso_id": "MED_MAYOR_B", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27637602-0", "nombre": "CRUZ MORALES LUAN CAMILO", "curso_id": "TRANS_1_A", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27537578-0", "nombre": "DIAZ LEON JATNIEL ARMANDO", "curso_id": "TRANS_1_A", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27583676-1", "nombre": "GARCIA ANASTACIO MAIA JAZMIN", "curso_id": "TRANS_1_A", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "100845605-0", "nombre": "GOMEZ CORDERO VILKARYS LUCIANA", "curso_id": "TRANS_1_A", "fecha_inc": "04/03/2026", "obs": ""},
    {"run": "27565584-8", "nombre": "GUTIERREZ NARCISO MAYEL STEISY", "curso_id": "TRANS_1_A", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "100836339-7", "nombre": "LEON GUIA JASIM HASIER", "curso_id": "TRANS_1_A", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27595124-2", "nombre": "NARVAEZ BLAS AIXA NAHIARA", "curso_id": "TRANS_1_A", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27596878-1", "nombre": "NAVARRO BARRETO IREIDYS AINHOA", "curso_id": "TRANS_1_A", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27544528-2", "nombre": "RODRIGUEZ NARCISO DYLAN JOSEL", "curso_id": "TRANS_1_A", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27656847-7", "nombre": "SANCHEZ DOMINGUEZ JOSE PEDRO", "curso_id": "TRANS_1_A", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27664801-2", "nombre": "SANCHEZ VILLACORTA HENRRY SAMMIR", "curso_id": "TRANS_1_A", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27583971-K", "nombre": "TAPIA LEONELLI GIOVANNI ANDRES", "curso_id": "TRANS_1_A", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27703055-1", "nombre": "YVERNA FENELON MELISA", "curso_id": "TRANS_1_A", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27686025-9", "nombre": "DOMINGUEZ ESPINOZA ELIEL ESTEBAN", "curso_id": "TRANS_1_B", "fecha_inc": "04/03/2026", "obs": ""},
    {"run": "27506930-2", "nombre": "LOZANO TAPIA GABRIEL ALE JANDRO", "curso_id": "TRANS_1_B", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27660214-4", "nombre": "MALLQUI CORDOVA YARELI AINARA", "curso_id": "TRANS_1_B", "fecha_inc": "16/03/2026", "obs": ""},
    {"run": "27584198-6", "nombre": "PAVAN PAVAN ALBANY STHEFANIA", "curso_id": "TRANS_1_B", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "28867525-2", "nombre": "RODAS JACOME ASHELY SOPHIE", "curso_id": "TRANS_1_B", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "100782964-3", "nombre": "SANCHEZ HIDALGO FABIO D JESUS", "curso_id": "TRANS_1_B", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27569546-7", "nombre": "VASQUEZ DÍAZ MATILDA ISIDORA", "curso_id": "TRANS_1_B", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "100762964-4", "nombre": "AGUIRRE SANCHEZ BRUNO MATEO", "curso_id": "TRANS_2_A", "fecha_inc": "11/03/2026", "obs": ""},
    {"run": "27378833-6", "nombre": "DERISTIL DESTRA THEO LOVENS", "curso_id": "TRANS_2_A", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "100764803-7", "nombre": "FERREBUS FERNANDEZ MIA SOFHIA", "curso_id": "TRANS_2_A", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "100768347-9", "nombre": "GARCIA ROJAS GIANNA CAROLINA", "curso_id": "TRANS_2_A", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27496080-9", "nombre": "LEON CALDERON NOAH AYLEN", "curso_id": "TRANS_2_A", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "100810319-0", "nombre": "LUNA CALZINA BENJAMIN LUCIANO", "curso_id": "TRANS_2_A", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "100714812-3", "nombre": "MENDEZ PEÑA EMA LUCIA", "curso_id": "TRANS_2_A", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27303549-4", "nombre": "MINDER GALVEZ ALLISON AΖΕΝETH", "curso_id": "TRANS_2_A", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "100720972-6", "nombre": "MONTES MENDOZA CRISTINA SUJSE", "curso_id": "TRANS_2_A", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "28168891-K", "nombre": "PINTO VALLE MELEK CARLOTA", "curso_id": "TRANS_2_A", "fecha_inc": "01/03/2026", "obs": "RET. 24/03/2026"},
    {"run": "27467270-6", "nombre": "REYES PELISSIER CHLOE VICTOIRE", "curso_id": "TRANS_2_A", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "100710368-5", "nombre": "YANES GUALDRON HANNY VALENTINA", "curso_id": "TRANS_2_A", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "100725945-6", "nombre": "CAPILLO TARAZONA HELLEN DAYANA", "curso_id": "TRANS_2_B", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27316297-6", "nombre": "CHERY PIERRE CHRISTOPHER JAYSON", "curso_id": "TRANS_2_B", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27347659-8", "nombre": "GARCIA VARGAS MARTIN AMARO", "curso_id": "TRANS_2_B", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27359698-4", "nombre": "HERRERA BEDON LUCAS LEONEL", "curso_id": "TRANS_2_B", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "100793511-7", "nombre": "LOZANO GONZALES GERALD ANDRE", "curso_id": "TRANS_2_B", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27426886-7", "nombre": "MIRANDA ABARCA VALENTINO ALEXANDER", "curso_id": "TRANS_2_B", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27435946-3", "nombre": "NAZARIO PALACIOS IKER DANIEL", "curso_id": "TRANS_2_B", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27433217-4", "nombre": "OTINIANO RUIZ LUCAS VALENTIN", "curso_id": "TRANS_2_B", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27442924-0", "nombre": "PEÑA CORPORAN LUISBERI NICOL", "curso_id": "TRANS_2_B", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27335837-4", "nombre": "PÉREZ VERGARA LAUTARO ENRIQUE", "curso_id": "TRANS_2_B", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27248656-5", "nombre": "REINOSO SOTO MATIAS ALESSANDRO", "curso_id": "TRANS_2_B", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27427874-9", "nombre": "RODRÍGUEZ AREVALO PAULA ELISA", "curso_id": "TRANS_2_B", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27266914-7", "nombre": "ULLOA GARRIDO DAMIAN ALEXANDER", "curso_id": "TRANS_2_B", "fecha_inc": "01/03/2026", "obs": ""},
    {"run": "27315378-0", "nombre": "VERA VERA BALTAZAR AMARO", "curso_id": "TRANS_2_B", "fecha_inc": "01/03/2026", "obs": ""}
  ]
};

function splitName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return { paterno: parts[0] || '', materno: '', nombres: '' };
  return {
    paterno: parts[0],
    materno: parts[1],
    nombres: parts.slice(2).join(' ')
  };
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const [d, m, y] = dateStr.split('/');
  return `${y}-${m}-${d}`;
}

async function seed() {
  console.log('Seeding custom data (Simplified)...');

  // Insert Estudiantes mapping curso_id to nivel
  const estudiantesToInsert = data.estudiantes.map(e => {
    const { paterno, materno, nombres } = splitName(e.nombre);
    let nivel = 'Medio Mayor';
    if (e.curso_id.includes('TRANS_1')) nivel = 'NT1';
    if (e.curso_id.includes('TRANS_2')) nivel = 'NT2';

    return {
      rut: e.run,
      nombre: nombres,
      apellido_paterno: paterno,
      apellido_materno: materno,
      fecha_ingreso: parseDate(e.fecha_inc),
      nivel: nivel,
      sede_id: 'gambino',
      activo: !e.obs.includes('RET.')
    };
  });

  const { error: estError } = await supabase.from('estudiantes').upsert(estudiantesToInsert, { onConflict: 'rut' });
  if (estError) {
    console.error('Error seeding estudiantes:', JSON.stringify(estError, null, 2));
    return;
  }
  console.log('Estudiantes seeded successfully (Simplified).');
}

seed().catch(console.error);
