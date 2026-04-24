// Database Raw Types (Snake Case as in Supabase)
export interface Tables {
  estudiantes: {
    id: number;
    rut: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string;
    fecha_nacimiento: string | null;
    diagnostico: 'TEL Mixto' | 'TEL Expresivo';
    nivel: 'Medio Mayor' | 'NT1' | 'NT2';
    jornada: 'Mañana' | 'Tarde';
    anamnesis: boolean;
    prueba_inicial: boolean;
    nombre_apoderado: string;
    telefono_apoderado: string | null;
    activo: boolean;
    sede_id: string;
    curso_id?: string | null;
    created_at: string;
  };
  asistencia: {
    id: number;
    estudiante_id: number;
    fecha: string;
    estado: 'P' | 'A' | 'J';
    observacion: string | null;
    registrado_por: string | null;
    cerrada: boolean;
    sede_id: string;
    created_at: string;
  };
  perfiles: {
    id: string;
    email: string;
    nombre: string;
    rol: 'director' | 'secretaria' | 'docente' | 'fonoaudiologo' | 'jefe_utp';
    activo: boolean;
    sede_id: string | null;
    created_at: string;
  };
  sesiones_fono: {
    id: number;
    fecha: string;
    estudiante_id: number;
    fonoaudiologo_id: string;
    actividad_realizada: string;
    observaciones: string | null;
    nivel_fonetico: number;
    nivel_semantico: number;
    nivel_morfosintactico: number;
    nivel_pragmatico: number;
    sede_id: string;
    created_at: string;
  };
  estudiantes_documentos: {
    id: string;
    estudiante_id: number;
    nombre_archivo: string;
    url_archivo: string;
    subido_por: string | null;
    sede_id: string | null;
    created_at: string;
  };
  auditoria: {
    id: number;
    accion: string;
    entidad: string;
    entidad_id: string | null;
    usuario_id: string;
    valor_anterior: any;
    valor_nuevo: any;
    sede_id: string | null;
    created_at: string;
  };
  cursos: {
    id: string;
    nombre: string;
    nivel: string;
    profesor_jefe?: string;
    sede_id: string;
    created_at: string;
  };
}

// App Mapped Types (Camel Case as in Frontend)
export interface Estudiante extends Omit<Tables['estudiantes'], 'apellido_paterno' | 'apellido_materno' | 'fecha_nacimiento' | 'prueba_inicial' | 'nombre_apoderado' | 'telefono_apoderado' | 'sede_id'> {
  apellidoPaterno: string;
  apellidoMaterno: string;
  fechaNacimiento: string | null;
  pruebaInicial: boolean;
  nombreApoderado: string;
  telefonoApoderado: string | null;
  sedeId: string;
  curso_id?: string | null;
}

export interface Asistencia extends Omit<Tables['asistencia'], 'estudiante_id' | 'registrado_por' | 'sede_id'> {
  estudianteId: number;
  registradoPor: string;
  sedeId: string;
}

export interface Sede {
  id: string;
  nombre: string;
  direccion: string;
  rbd?: string;
}

export interface User {
  id: string;
  nombre: string;
  email: string;
  rol: Tables['perfiles']['rol'];
  activo: boolean;
  sedeId?: string | null;
}
