import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PackageCheck, AlertTriangle, Boxes } from 'lucide-react';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { EntregaItem, MaterialService } from '../../services/materialService';
import { SolicitudMaterial } from '../../types';

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

  const pendientes = useMemo(
    () => solicitud.items.filter(i => i.pendiente> 0),
    [solicitud.items]
  );

  const [cantidades, setCantidades] = useState<Record<number, string>>(
    () => Object.fromEntries(pendientes.map(i => [i.id, String(i.pendiente)]))
  );

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

  const seleccionadas = useMemo(
    () => pendientes
      .map(i => ({ itemId: i.id, cantidad: Number(cantidades[i.id]) || 0 }))
      .filter(e => e.cantidad> 0),
    [pendientes, cantidades]
  );

  const entregaCompleta = pendientes.every(
    i => (Number(cantidades[i.id]) || 0)>= i.pendiente
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (seleccionadas.length === 0) {
      setError('Indica cuánto entregas de al menos un material.');
      return;
    }
    const excedida = pendientes.find(i => (Number(cantidades[i.id]) || 0)> i.pendiente);
    if (excedida) {
      setError(`De "${excedida.nombre}" solo faltan ${excedida.pendiente} ${excedida.unidad}.`);
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

        <div className="flex flex-col gap-2">
          {pendientes.map(item => {
            const valor = Number(cantidades[item.id]) || 0;
            const excede = valor> item.pendiente;
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
                    Pidió {item.cantidad} {item.unidad}
                    {item.cantidadEntregada> 0 && <> · ya recibió {item.cantidadEntregada}</>}
                    {' '}· <strong>faltan {item.pendiente}</strong>
                    {!item.itemId && ' · no está en bodega'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="form-label" htmlFor={`entrega-${item.id}`}>
                    Entregar
                  </label>
                  <input
                    id={`entrega-${item.id}`}
                    type="number" min="0" max={item.pendiente} step="0.01"
                    className="form-input"
                    style={{ width: '110px', minHeight: '42px' }}
                    value={cantidades[item.id] ?? ''}
                    onChange={e => setCantidades(prev => ({ ...prev, [item.id]: e.target.value }))}
                    disabled={entregar.isPending}
 />
                  <span className="text-sm text-secondary">{item.unidad}</span>
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

        <div className="modal-footer" style={{ padding: '20px 0 0', border: 'none' }}>
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
