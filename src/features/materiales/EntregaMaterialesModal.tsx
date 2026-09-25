import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PackageCheck, AlertTriangle, Boxes } from 'lucide-react';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { EntregaItem, MaterialService } from '../../services/materialService';
import { InventarioService } from '../../services/inventarioService';
import { SolicitudMaterial } from '../../types';
import { descripcionCaja, nombreUnidad, permiteFracciones, validarCantidadEntrega } from '../../utils/presentaciones';

interface Props {
  solicitud: SolicitudMaterial;
  onClose: () => void;
  onEntregado: () => void;
}

/**
 * Entrega desde bodega.
 *
 * Parte con lo que falta de cada material ya escrito: lo normal es entregar
 * todo, y quien entrega solo corrige lo que no alcanzó. Si un material está
 * enlazado a un producto de bodega, al confirmar se descuenta el stock; si no,
 * solo queda registrado que se entregó.
 */
export default function EntregaMaterialesModal({ solicitud, onClose, onEntregado }: Props) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const inventario = useQuery({
    queryKey: ['inventario', solicitud.sedeId],
    queryFn: () => InventarioService.getProductos(solicitud.sedeId),
  });
  const productosPorId = useMemo(
    () => new Map((inventario.data ?? []).map(p => [p.id, p])),
    [inventario.data]
  );

  const pendientes = useMemo(
    () => solicitud.items.filter(i => i.pendiente> 0),
    [solicitud.items]
  );

  const [cantidades, setCantidades] = useState<Record<number, string>>(
    () => Object.fromEntries(pendientes.map(i => [
      i.id, String(i.cantidadCajas > 0 && i.unidadesPorCajaSolicitada
        ? i.pendiente / i.unidadesPorCajaSolicitada : i.pendiente),
    ]))
  );

  function cantidadBase(item: SolicitudMaterial['items'][number]): number {
    const cantidad = Number(cantidades[item.id]) || 0;
    return item.cantidadCajas > 0 && item.unidadesPorCajaSolicitada
      ? cantidad * item.unidadesPorCajaSolicitada : cantidad;
  }

  const entregar = useMutation({
    mutationFn: (entregas: EntregaItem[]) => MaterialService.entregar(solicitud.id, entregas),
    onSuccess: () => {
      addToast('Entrega registrada y stock descontado', 'success');
      queryClient.invalidateQueries({ queryKey: ['materiales'] });
      queryClient.invalidateQueries({ queryKey: ['inventario'] });
      queryClient.invalidateQueries({ queryKey: ['material-historial', solicitud.id] });
      onEntregado();
    },
    onError: (e: Error) => setError(e.message),
  });

  const seleccionadas = pendientes
    .map(i => ({ itemId: i.id, cantidad: cantidadBase(i) }))
    .filter(e => e.cantidad > 0);

  const entregaCompleta = pendientes.every(
    i => cantidadBase(i) >= i.pendiente
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    setError('');

    const invalida = pendientes
      .map(i => ({ nombre: i.nombre, motivo: validarCantidadEntrega(
        cantidades[i.id] ?? '', i.pendiente, i.unidad,
        i.cantidadCajas > 0 ? i.unidadesPorCajaSolicitada : null
      ) }))
      .find(resultado => resultado.motivo);
    if (invalida) {
      setError(`${invalida.nombre}: ${invalida.motivo}`);
      return;
    }
    const cajaSinContar = pendientes.find(i => i.cantidadCajas > 0 && cantidadBase(i) > 0
      && productosPorId.get(i.itemId ?? -1)?.empaqueVerificado === false);
    if (cajaSinContar) {
      setError(`${cajaSinContar.nombre}: confirma primero las cajas cerradas en Bodega y stock.`);
      return;
    }
    const cajaInsuficiente = pendientes.find(i => {
      const producto = productosPorId.get(i.itemId ?? -1);
      return i.cantidadCajas > 0 && cantidadBase(i) > 0 && producto?.empaqueVerificado
        && cantidadBase(i) / (i.unidadesPorCajaSolicitada ?? 1) > (producto.cajasCerradas ?? 0);
    });
    if (cajaInsuficiente) {
      setError(`${cajaInsuficiente.nombre}: no hay suficientes cajas cerradas. Puedes entregar menos y dejar el resto pendiente.`);
      return;
    }
    if (seleccionadas.length === 0) {
      setError('Indica cuánto entregas de al menos un material.');
      return;
    }
    entregar.mutate(seleccionadas);
  }

  return (
    <Modal isOpen onClose={onClose} title="Entregar materiales" size="lg">
      <form onSubmit={submit}>
        {error && <div className="login-error mb-4" role="alert">{error}</div>}

        <p className="text-muted text-base mb-4">
          Escribe cuánto entregas de cada material. Los que están en bodega descuentan
          el stock automáticamente. Si no alcanza para alguno, no se entrega nada y
          nada queda descontado.
        </p>
        {inventario.isError && <div className="alerta alerta-warning mb-4" role="status">
          No se pudo consultar el desglose actual de cajas. La base igualmente comprobará el stock al confirmar.
        </div>}

        <div className="flex flex-col gap-2">
          {pendientes.map(item => {
            const producto = item.itemId ? productosPorId.get(item.itemId) : null;
            const esCaja = item.cantidadCajas > 0 && !!item.unidadesPorCajaSolicitada;
            const valor = cantidadBase(item);
            const excede = valor > item.pendiente;
            const factor = item.unidadesPorCajaSolicitada ?? 1;
            return (
              <div
                key={item.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
                  padding: '14px 16px', borderRadius: 'var(--radius-md)',
                  border: `1px solid ${excede ? 'var(--color-danger)' : 'var(--border-medium)'}`,
                  background: excede ? 'var(--color-danger-soft)' : 'var(--bg-card)',
                }}
              >
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <div className="font-bold text-base flex items-center gap-2">
                    {item.nombre}
                    {item.itemId
                      ? <Boxes size={14} style={{ color: 'var(--color-success)' }} aria-label="Descuenta de bodega" />
                      : null}
                  </div>
                  <div className="text-sm text-muted">
                    Pidió {esCaja
                      ? `${descripcionCaja(item.cantidadCajas, factor, item.unidad)} (${item.cantidad} ${nombreUnidad(item.unidad, item.cantidad)})`
                      : `${item.cantidad} ${nombreUnidad(item.unidad, item.cantidad)}`}
                    {item.cantidadEntregada > 0 && <> · ya recibió {esCaja
                      ? `${item.cantidadEntregada / factor} ${nombreUnidad('caja', item.cantidadEntregada / factor)}`
                      : `${item.cantidadEntregada} ${nombreUnidad(item.unidad, item.cantidadEntregada)}`}</>}
                    {' '}· <strong>faltan {esCaja
                      ? `${item.pendiente / factor} ${nombreUnidad('caja', item.pendiente / factor)}`
                      : `${item.pendiente} ${nombreUnidad(item.unidad, item.pendiente)}`}</strong>
                    {!item.itemId && ' · no está en bodega'}
                  </div>
                  {esCaja && <div className="text-sm text-warning">
                    {producto && !producto.empaqueVerificado
                      ? 'Confirma primero las cajas cerradas en Bodega y stock.'
                      : producto?.empaqueVerificado && Number(cantidades[item.id]) > (producto.cajasCerradas ?? 0)
                        ? `Solo hay ${producto.cajasCerradas} cajas cerradas. Entrega menos o espera reposición.`
                        : 'Comprueba que las cajas estén completas antes de confirmar.'}
                  </div>}
                  {producto?.unidadesPorCaja && (
                    <div className="delivery-stock-breakdown">
                      Stock total: {producto.stockActual} {nombreUnidad(producto.unidad, producto.stockActual)}
                      {producto.empaqueVerificado
                        ? ` · ${producto.cajasCerradas} cajas cerradas · ${producto.unidadesCajaAbierta} en caja abierta · ${producto.unidadesSueltas} sueltos`
                        : ' · Presentación física por confirmar en Bodega'}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="form-label" htmlFor={`entrega-${item.id}`}>
                    Entregar
                  </label>
                  <input
                    id={`entrega-${item.id}`}
                    type="number" min="0" max={esCaja ? item.pendiente / factor : item.pendiente}
                    step={esCaja || !permiteFracciones(item.unidad) ? '1' : '0.01'}
                    className="form-input"
                    style={{ width: '110px', minHeight: '42px' }}
                    value={cantidades[item.id] ?? ''}
                    onChange={e => setCantidades(prev => ({ ...prev, [item.id]: e.target.value }))}
                    disabled={entregar.isPending}
 />
                  <span className="text-sm text-secondary">{esCaja ? 'cajas' : nombreUnidad(item.unidad, Number(cantidades[item.id]) || 0)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {!entregaCompleta && seleccionadas.length> 0 && (
          <div className="alerta alerta-warning alerta-bloque mt-4">
            <AlertTriangle size={17} aria-hidden="true" />
            <span className="text-sm font-semibold">
              La solicitud quedará como «entregada en parte». Lo que falte se puede
              entregar después, cuando llegue.
            </span>
          </div>
        )}

        <div className="modal-footer-sticky">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={entregar.isPending}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-gold" disabled={entregar.isPending || seleccionadas.length === 0}>
            <PackageCheck size={18} />
            {entregar.isPending ? 'Entregando…' : entregaCompleta ? 'Entregar todo' : 'Entregar lo disponible'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
