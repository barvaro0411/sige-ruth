import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Boxes, CalendarClock, CheckCircle2, ClipboardList, PackageX,
  ShoppingCart, TriangleAlert, Undo2, Wrench,
} from 'lucide-react';
import { useSede } from '../../auth/SedeContext';
import { OperacionesService } from '../../services/operacionesService';
import { GastoMensual, OrigenGasto, PanelOperaciones as Panel } from '../../types';
import { formatDate } from '../../utils/dates';

const MONEDA = new Intl.NumberFormat('es-CL', {
  style: 'currency', currency: 'CLP', maximumFractionDigits: 0,
});

const ORIGENES: OrigenGasto[] = ['materiales', 'mantenciones', 'preventivas'];

const ETIQUETA_ORIGEN: Record<OrigenGasto, string> = {
  materiales: 'Materiales',
  mantenciones: 'Mantenciones',
  preventivas: 'Preventivas',
};

function nombreMes(iso: string): string {
  // El valor viene como fecha sin hora: se fija el mediodía para que el desfase
  // de zona horaria no lo tire al mes anterior.
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-CL', {
    month: 'long', year: 'numeric',
  });
}

interface Cola {
  clave: keyof Panel;
  label: string;
  ruta: string;
  icono: typeof Wrench;
  /** Una cola urgente se pinta en rojo aunque tenga un solo caso. */
  urgente?: boolean;
}

/**
 * Las colas, en el orden en que hay que mirarlas: primero lo que bloquea a
 * alguien o es riesgo, después lo que solo es trabajo pendiente.
 */
const COLAS: Cola[] = [
  { clave: 'mantencionesUrgentes',  label: 'Mantenciones urgentes',   ruta: '/mantenciones', icono: TriangleAlert, urgente: true },
  { clave: 'preventivasVencidas',   label: 'Preventivas vencidas',    ruta: '/mantenciones', icono: CalendarClock, urgente: true },
  { clave: 'productosAgotados',     label: 'Productos agotados',      ruta: '/inventario',   icono: PackageX,      urgente: true },
  { clave: 'prestamosAtrasados',    label: 'Préstamos atrasados',     ruta: '/prestamos',    icono: Undo2,         urgente: true },
  { clave: 'materialesPorRevisar',  label: 'Solicitudes por revisar', ruta: '/materiales',   icono: ClipboardList },
  { clave: 'materialesPorComprar',  label: 'Aprobadas por comprar',   ruta: '/materiales',   icono: ShoppingCart },
  { clave: 'materialesPorEntregar', label: 'Listas para entregar',    ruta: '/materiales',   icono: Boxes },
  { clave: 'permisosPorResolver',   label: 'Permisos por resolver',   ruta: '/permisos',     icono: ClipboardList },
  { clave: 'mantencionesAbiertas',  label: 'Mantenciones abiertas',   ruta: '/mantenciones', icono: Wrench },
  { clave: 'mantencionesPorCerrar', label: 'Resueltas por cerrar',    ruta: '/mantenciones', icono: CheckCircle2 },
  { clave: 'preventivasProximas',   label: 'Preventivas próximas',    ruta: '/mantenciones', icono: CalendarClock },
  { clave: 'productosBajoMinimo',   label: 'Productos bajo mínimo',   ruta: '/inventario',   icono: PackageX },
];

/**
 * Panel de operaciones.
 *
 * Responde una sola pregunta —qué hay que atender hoy— sin obligar a abrir
 * cinco pantallas para armarla. Lo que está en cero no se muestra: un panel
 * lleno de ceros entrena a la gente a no mirarlo.
 */
export default function PanelOperaciones() {
  const { sede } = useSede();

  const panel = useQuery({
    queryKey: ['panel-operaciones', sede.id],
    queryFn: () => OperacionesService.getPanel(sede.id),
  });

  const consolidado = useQuery({
    queryKey: ['consolidado', sede.id],
    queryFn: () => OperacionesService.getConsolidado(sede.id),
  });

  const compra = useQuery({
    queryKey: ['lista-compra', sede.id],
    queryFn: () => OperacionesService.getListaCompra(sede.id),
  });

  const pendientes = useMemo(() => {
    if (!panel.data) return [];
    return COLAS
      .map(c => ({ ...c, valor: panel.data![c.clave] as number }))
      .filter(c => c.valor> 0);
  }, [panel.data]);

  const meses = useMemo(() => agruparPorMes(consolidado.data ?? []), [consolidado.data]);

  if (panel.isLoading) {
    return <div className="page-container"><div className="skeleton" style={{ height: 420 }} /></div>;
  }

  return (
    <div className="page-container animate-in">
      <header className="page-header">
        <div>
          <h1 className="page-title">Operaciones</h1>
          <p className="page-subtitle">Qué necesita atención hoy. {sede.nombre}</p>
        </div>
      </header>

      {/* Colas abiertas */}
      <section className="mb-8">
        {pendientes.length === 0 ? (
          <div className="card py-10 px-6 text-center">
            <CheckCircle2 size={44} style={{ color: 'var(--color-success)', marginBottom: '14px' }} />
            <h3 className="mb-1">No hay nada pendiente</h3>
            <p className="text-muted">
              Ninguna solicitud sin revisar, ningún producto bajo mínimo, nada roto sin atender.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid', gap: '10px',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            }}
          >
            {pendientes.map(c => (
              <Link
                key={c.clave}
                to={c.ruta}
                className="card"
                style={{
                  padding: '16px', textDecoration: 'none', color: 'inherit',
                  display: 'flex', gap: '12px', alignItems: 'center',
                  borderLeft: `4px solid ${c.urgente ? 'var(--color-danger)' : 'var(--color-gold)'}`,
                }}
              >
                <c.icono
                  size={22}
                  style={{ color: c.urgente ? 'var(--color-danger)' : 'var(--gold-600)', flexShrink: 0 }}
                  aria-hidden="true"
                />
                <div>
                  <div style={{
                    fontSize: '24px', fontWeight: 900, lineHeight: 1.1,
                    fontVariantNumeric: 'tabular-nums',
                    color: c.urgente ? 'var(--color-danger)' : 'var(--text-primary)',
                  }}>
                    {c.valor}
                  </div>
                  <div className="text-muted text-sm font-semibold">
                    {c.label}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Consolidación mensual */}
      <section className="mb-8">
        <h2 className="text-md mb-1">En qué se fue la plata</h2>
        <p className="text-muted text-sm mb-3">
          Gasto real de los últimos doce meses. Un gasto cuenta en el mes en que se cerró,
          no en el que se pidió.
        </p>

        {consolidado.isLoading ? (
          <div className="skeleton h-50" />
        ) : meses.length === 0 ? (
          <div className="card py-8 px-6 text-center">
            <p className="text-muted">
              Todavía no hay gasto registrado. Aparece acá cuando se cierre la primera
              compra o mantención con costo.
            </p>
          </div>
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Mes</th>
                  {ORIGENES.map(o => (
                    <th key={o} scope="col" className="text-right">{ETIQUETA_ORIGEN[o]}</th>
                  ))}
                  <th scope="col" className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {meses.map(m => (
                  <tr key={m.mes}>
                    <td data-label="Mes" style={{ textTransform: 'capitalize' }}>{nombreMes(m.mes)}</td>
                    {ORIGENES.map(o => (
                      <td key={o} data-label={ETIQUETA_ORIGEN[o]} className="text-right tabular">
                        {m.porOrigen[o]> 0 ? MONEDA.format(m.porOrigen[o]) : '—'}
                      </td>
                    ))}
                    <td data-label="Total" className="text-right font-extrabold tabular">
                      {MONEDA.format(m.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Lista de compra sugerida */}
      <section>
        <h2 className="text-md mb-1">Lista de compra sugerida</h2>
        <p className="text-muted text-sm mb-3">
          Lo que falta para llegar al mínimo más un mes de consumo, medido sobre las
          entregas de los últimos 90 días. Es una sugerencia, no una orden de compra.
        </p>

        {compra.isLoading ? (
          <div className="skeleton h-50" />
        ) : (compra.data ?? []).length === 0 ? (
          <div className="card py-8 px-6 text-center">
            <CheckCircle2 size={36} style={{ color: 'var(--color-success)', marginBottom: '10px' }} />
            <p className="text-muted">
              Todos los productos están sobre su mínimo. No hay nada que comprar.
            </p>
          </div>
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Producto</th>
                  <th scope="col">Categoría</th>
                  <th scope="col" className="text-right">Hay</th>
                  <th scope="col" className="text-right">Mínimo</th>
                  <th scope="col" className="text-right">Consumo mensual</th>
                  <th scope="col" className="text-right">Comprar</th>
                  <th scope="col">Última compra</th>
                </tr>
              </thead>
              <tbody>
                {(compra.data ?? []).map(p => (
                  <tr key={p.id}>
                    <td data-label="Producto">
                      <strong>{p.nombre}</strong>
                      {p.estadoStock === 'agotado' && (
                        <span className="badge badge-danger" style={{ marginLeft: 8 }}>Agotado</span>
                      )}
                    </td>
                    <td data-label="Categoría">{p.categoria}</td>
                    <td data-label="Hay" className="text-right tabular">
                      {p.stockActual}
                    </td>
                    <td data-label="Mínimo" className="text-right tabular">
                      {p.stockMinimo}
                    </td>
                    <td data-label="Consumo mensual" className="text-right tabular">
                      {p.consumoMensual> 0 ? p.consumoMensual : '—'}
                    </td>
                    <td data-label="Comprar" className="text-right font-extrabold tabular">
                      {p.sugerido} {p.unidadNombre.toLowerCase()}
                    </td>
                    <td data-label="Última compra">
                      {p.ultimaCompra ? formatDate(p.ultimaCompra) : 'Nunca'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

interface MesConsolidado {
  mes: string;
  porOrigen: Record<OrigenGasto, number>;
  total: number;
}

/** La vista devuelve una fila por mes y origen; la tabla necesita una por mes. */
function agruparPorMes(filas: GastoMensual[]): MesConsolidado[] {
  const porMes = new Map<string, MesConsolidado>();

  for (const fila of filas) {
    let entrada = porMes.get(fila.mes);
    if (!entrada) {
      entrada = { mes: fila.mes, porOrigen: { materiales: 0, mantenciones: 0, preventivas: 0 }, total: 0 };
      porMes.set(fila.mes, entrada);
    }
    entrada.porOrigen[fila.origen] += fila.total;
    entrada.total += fila.total;
  }

  return [...porMes.values()].sort((a, b) => b.mes.localeCompare(a.mes));
}
