import { supabase } from './database';
import { calculateDV } from '../utils/rut';
import { formatRut } from '../utils/rut';

const NOMBRES = ['Sofía','Matías','Valentina','Benjamín','Isidora','Martín','Catalina','Agustín','Florencia','Tomás','Antonia','Lucas','Emilia','Joaquín','Amanda','Sebastián','Maite','Felipe','Camila','Vicente','Josefa','Maximiliano','Trinidad','Diego','Fernanda','Ignacio','Isabella','Nicolás','Constanza','Gabriel'];
const AP_PATERNOS = ['González','Muñoz','Rojas','Díaz','Pérez','Soto','Contreras','Silva','Martínez','Sepülveda','Morales','Rodríguez','López','Fuentes','Hernández','García','Garrido','Bravo','Reyes','Núñez'];
const AP_MATERNOS = ['Torres','Araya','Flores','Espinoza','Valenzuela','Castillo','Tapia','Figueroa','Cortés','Jara','Vargas','Vera','Pizarro','Bustos','Salazar','Medina','Yáñez','Carrasco','Sandoval','Cáceres'];

function randomFrom(arr) { return arr[Math.floor(Math.random()*arr.length)]; }
function randomRut() {
  const body = Math.floor(Math.random()*(25000000-5000000)+5000000).toString();
  const dv = calculateDV(body);
  return formatRut(body+dv);
}
function randomDate(yearStart,yearEnd) {
  const y = Math.floor(Math.random()*(yearEnd-yearStart)+yearStart);
  const m = Math.floor(Math.random()*12)+1;
  const d = Math.floor(Math.random()*28)+1;
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

export async function seedDatabase() {
  // Check if students already exist
  const { count, error: countError } = await supabase
    .from('estudiantes')
    .select('*', { count: 'exact', head: true });
  
  if (countError) {
    console.error('Error checking existing students:', countError);
    return false;
  }
  
  if (count > 0) return false;

  const niveles = ['Medio Mayor','NT1','NT2'];
  const jornadas = ['Mañana','Tarde'];
  const diagnosticos = ['TEL Mixto','TEL Expresivo'];
  const sedes = ['gambino', 'vascongados'];
  const allStudentsToInsert = [];

  for (const sedeId of sedes) {
    for (let i = 0; i < 15; i++) {
      allStudentsToInsert.push({
        rut: randomRut(),
        nombre: randomFrom(NOMBRES),
        apellido_paterno: randomFrom(AP_PATERNOS),
        apellido_materno: randomFrom(AP_MATERNOS),
        fecha_nacimiento: randomDate(2019,2022),
        diagnostico: randomFrom(diagnosticos),
        nivel: niveles[i % 3],
        jornada: jornadas[i % 2],
        anamnesis: Math.random() > 0.2,
        prueba_inicial: Math.random() > 0.3,
        nombre_apoderado: `${randomFrom(NOMBRES)} ${randomFrom(AP_PATERNOS)}`,
        telefono_apoderado: `+56 9 ${Math.floor(Math.random()*9000+1000)} ${Math.floor(Math.random()*9000+1000)}`,
        activo: true,
        fecha_ingreso: new Date().toISOString(),
        sede_id: sedeId,
      });
    }
  }

  const { data: insertedStudents, error: insertError } = await supabase
    .from('estudiantes')
    .insert(allStudentsToInsert)
    .select();

  if (insertError) {
    console.error('Error inserting students:', insertError);
    return false;
  }

  // Generate some attendance for the past 5 school days
  const attendanceRecords = [];
  for (let dayOffset = 1; dayOffset <= 5; dayOffset++) {
    const d = new Date();
    d.setDate(d.getDate() - dayOffset);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const dateStr = d.toISOString().split('T')[0];
    
    for (const st of insertedStudents) {
      const r = Math.random();
      attendanceRecords.push({
        estudiante_id: st.id,
        fecha: dateStr,
        estado: r < 0.85 ? 'P' : r < 0.95 ? 'A' : 'J',
        observacion: '',
        registrado_por: 'Docente Semilla',
        cerrada: true,
        sede_id: st.sede_id,
      });
    }
  }
  
  if (attendanceRecords.length > 0) {
    const { error: attError } = await supabase.from('asistencia').insert(attendanceRecords);
    if (attError) console.error('Error inserting attendance:', attError);
  }

  return true;
}
