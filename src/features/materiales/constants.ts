import { EstadoMaterial, PrioridadMaterial } from '../../types';

/**
 * El estado nunca se comunica solo con color: cada badge lleva etiqueta e ícono,
 * para que se entienda en blanco y negro o con daltonismo.
 */
export const ESTADOS_MATERIAL: Record<EstadoMaterial, {
  label: string; color: string; bg: string; icono: string;
}> = {
  borrador:       { label: 'Borrador',        color: 'var(--navy-600)',      bg: 'var(--bg-main)',              icono: '✎' },
  pendiente:      { label: 'Por revisar',     color: 'var(--gold-600)',      bg: 'var(--gold-50)',              icono: '⏳' },
  observada:      { label: 'Con observaciones', color: 'var(--color-info)',  bg: 'var(--color-info-soft)',      icono: '↩' },
  aprobada:       { label: 'Aprobada',        color: 'var(--color-success)', bg: 'var(--color-success-soft)',   icono: '✓' },
  rechazada:      { label: 'Rechazada',       color: 'var(--color-danger)',  bg: 'var(--color-danger-soft)',    icono: '✕' },
  en_compra:      { label: 'En compra',       color: 'var(--color-info)',    bg: 'var(--color-info-soft)',      icono: '🛒' },
  compra_parcial: { label: 'Compra parcial',  color: 'var(--color-warning)', bg: 'var(--color-warning-soft)',   icono: '◐' },
  comprada:       { label: 'Comprada',        color: 'var(--color-success)', bg: 'var(--color-success-soft)',   icono: '📦' },
  preparando:     { label: 'Preparando',      color: 'var(--color-info)',    bg: 'var(--color-info-soft)',      icono: '🧺' },
  entregada_parcial: { label: 'Entregada en parte', color: 'var(--color-warning)', bg: 'var(--color-warning-soft)', icono: '◐' },
  entregada:      { label: 'Entregada',       color: 'var(--navy-900)',      bg: 'var(--color-navy-soft)',      icono: '✓✓' },
  cancelada:      { label: 'Cancelada',       color: 'var(--navy-600)',      bg: 'var(--bg-main)',              icono: '—' },
};

export const PRIORIDADES: Record<PrioridadMaterial, { label: string; color: string }> = {
  baja:    { label: 'Baja',    color: 'var(--navy-600)' },
  normal:  { label: 'Normal',  color: 'var(--navy-800)' },
  alta:    { label: 'Alta',    color: 'var(--color-warning)' },
  urgente: { label: 'Urgente', color: 'var(--color-danger)' },
};

export const UNIDADES = ['unidad', 'caja', 'paquete', 'resma', 'set', 'kg', 'litro', 'metro'] as const;

export function formatCLP(monto: number | null): string {
  if (monto === null || Number.isNaN(monto)) return '—';
  return monto.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
}

/** Una solicitud está atrasada si pasó su fecha de necesidad y sigue abierta. */
export function estaAtrasada(fechaNecesidad: string | null, estado: EstadoMaterial): boolean {
  if (!fechaNecesidad) return false;
  const abierta: EstadoMaterial[] = [
    'pendiente', 'observada', 'aprobada', 'en_compra', 'compra_parcial',
    'preparando', 'entregada_parcial',
  ];
  if (!abierta.includes(estado)) return false;
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
  return fechaNecesidad < hoy;
}
