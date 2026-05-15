import { describe, expect, it } from 'vitest';
import { validateEstudianteForm, validateFonoSesion } from './validation';

const estudianteValido = {
  rut: '12.345.678-5',
  nombre: 'Ana',
  apellido_paterno: 'Perez',
  apellido_materno: 'Rojas',
  fecha_nacimiento: '2020-03-10',
  diagnostico: 'TEL Mixto',
  nivel: 'NT1',
  jornada: 'Mañana',
  nombre_apoderado: 'Maria Rojas',
  telefono_apoderado: '+56 9 1234 5678',
};

describe('validateEstudianteForm', () => {
  it('acepta una matricula valida', () => {
    const result = validateEstudianteForm(estudianteValido);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('rechaza rut, fecha futura y catalogos invalidos', () => {
    const nextYear = new Date().getFullYear() + 1;
    const result = validateEstudianteForm({
      ...estudianteValido,
      rut: '12.345.678-9',
      fecha_nacimiento: `${nextYear}-01-01`,
      nivel: 'Basica',
      jornada: 'Noche',
      diagnostico: 'Otro',
    });

    expect(result.valid).toBe(false);
    expect(result.errors.rut).toBeTruthy();
    expect(result.errors.fecha_nacimiento).toBeTruthy();
    expect(result.errors.nivel).toBeTruthy();
    expect(result.errors.jornada).toBeTruthy();
    expect(result.errors.diagnostico).toBeTruthy();
  });

  it('rechaza telefonos con caracteres no permitidos', () => {
    const result = validateEstudianteForm({
      ...estudianteValido,
      telefono_apoderado: '<script>alert(1)</script>',
    });

    expect(result.valid).toBe(false);
    expect(result.errors.telefono_apoderado).toBeTruthy();
  });
});

describe('validateFonoSesion', () => {
  it('acepta una sesion valida', () => {
    const result = validateFonoSesion({
      fecha: '2026-05-15',
      estudiante_id: 1,
      actividad_realizada: 'Ejercicios de articulacion',
      nivel_fonetico: 1,
      nivel_semantico: 2,
      nivel_morfosintactico: 3,
      nivel_pragmatico: 1,
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('rechaza sesiones incompletas o con puntajes fuera de rango', () => {
    const result = validateFonoSesion({
      fecha: '',
      estudiante_id: 0,
      actividad_realizada: '',
      nivel_fonetico: 0,
      nivel_semantico: 4,
      nivel_morfosintactico: 2.5,
      nivel_pragmatico: 1,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.fecha).toBeTruthy();
    expect(result.errors.estudiante_id).toBeTruthy();
    expect(result.errors.actividad_realizada).toBeTruthy();
    expect(result.errors.nivel_fonetico).toBeTruthy();
    expect(result.errors.nivel_semantico).toBeTruthy();
    expect(result.errors.nivel_morfosintactico).toBeTruthy();
    expect(result.errors.nivel_pragmatico).toBeUndefined();
  });
});
