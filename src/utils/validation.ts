import { DIAGNOSTICOS, JORNADAS, NIVELES } from '../config/constants';
import { validateRut } from './rut';

export type ValidationErrors<T extends string = string> = Partial<Record<T, string>>;

export interface ValidationResult<T extends string = string> {
  valid: boolean;
  errors: ValidationErrors<T>;
}

type EstudianteField =
  | 'rut'
  | 'nombre'
  | 'apellido_paterno'
  | 'apellido_materno'
  | 'fecha_nacimiento'
  | 'diagnostico'
  | 'nivel'
  | 'jornada'
  | 'nombre_apoderado'
  | 'telefono_apoderado';

type FonoField =
  | 'fecha'
  | 'estudiante_id'
  | 'actividad_realizada'
  | 'nivel_fonetico'
  | 'nivel_semantico'
  | 'nivel_morfosintactico'
  | 'nivel_pragmatico';

function isBlank(value: unknown) {
  return typeof value !== 'string' || value.trim().length === 0;
}

function isValidDateInput(value: string) {
  if (isBlank(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function isFutureDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date > today;
}

function isOneOf<T extends readonly string[]>(value: string, allowed: T) {
  return (allowed as readonly string[]).includes(value);
}

function isValidScore(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 3;
}

export function validateEstudianteForm(payload: Record<string, any>): ValidationResult<EstudianteField> {
  const errors: ValidationErrors<EstudianteField> = {};

  if (isBlank(payload.rut) || !validateRut(payload.rut)) {
    errors.rut = 'Ingrese un RUT valido.';
  }
  if (isBlank(payload.nombre)) errors.nombre = 'Ingrese el nombre.';
  if (isBlank(payload.apellido_paterno)) errors.apellido_paterno = 'Ingrese el apellido paterno.';
  if (payload.fecha_nacimiento) {
    if (!isValidDateInput(payload.fecha_nacimiento)) errors.fecha_nacimiento = 'Ingrese una fecha valida.';
    if (isFutureDate(payload.fecha_nacimiento)) errors.fecha_nacimiento = 'La fecha no puede ser futura.';
  }
  if (!isOneOf(payload.nivel, NIVELES)) errors.nivel = 'Seleccione un nivel valido.';
  if (!isOneOf(payload.jornada, JORNADAS)) errors.jornada = 'Seleccione una jornada valida.';
  if (!isOneOf(payload.diagnostico, DIAGNOSTICOS)) errors.diagnostico = 'Seleccione un diagnostico valido.';
  if (isBlank(payload.nombre_apoderado)) errors.nombre_apoderado = 'Ingrese el nombre del apoderado.';
  if (payload.telefono_apoderado && !/^[+\d\s()-]{8,20}$/.test(payload.telefono_apoderado)) {
    errors.telefono_apoderado = 'Ingrese un telefono valido.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateFonoSesion(payload: Record<string, any>): ValidationResult<FonoField> {
  const errors: ValidationErrors<FonoField> = {};

  if (!isValidDateInput(payload.fecha)) errors.fecha = 'Ingrese una fecha valida.';
  if (!Number.isInteger(payload.estudiante_id) || payload.estudiante_id <= 0) {
    errors.estudiante_id = 'Seleccione un estudiante.';
  }
  if (isBlank(payload.actividad_realizada)) {
    errors.actividad_realizada = 'Describa la actividad realizada.';
  }
  if (!isValidScore(payload.nivel_fonetico)) errors.nivel_fonetico = 'Evalúe el nivel fonetico.';
  if (!isValidScore(payload.nivel_semantico)) errors.nivel_semantico = 'Evalúe el nivel semantico.';
  if (!isValidScore(payload.nivel_morfosintactico)) errors.nivel_morfosintactico = 'Evalúe el nivel morfosintactico.';
  if (!isValidScore(payload.nivel_pragmatico)) errors.nivel_pragmatico = 'Evalúe el nivel pragmatico.';

  return { valid: Object.keys(errors).length === 0, errors };
}
