import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../components/Toast';
import { PERMISSIONS } from '../../auth/permissions';
import { MaterialService } from '../../services/materialService';
import { SolicitudMaterial } from '../../types';
import { formatDate, formatDateTime } from '../../utils/dates';
import { ESTADOS_MATERIAL, PRIORIDADES, formatCLP } from './constants';
import Modal from '../../components/Modal';
import EntregaMaterialesModal from './EntregaMaterialesModal';
import { Check, X, MessageSquare, ShoppingCart, PackageCheck, Ban, Send, Boxes, ClipboardList } from 'lucide-react';

interface Props {
  solicitud: SolicitudMaterial;
  onClose: () => void;
}

export default function SolicitudMaterialDetalle({ solicitud, onClose }: Props) {
  const { user, can } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [comentario, setComentario] = useState('');
  const [presupuesto, setPresupuesto] = useState<string>('');
  const [entregando, setEntregando] = useState(false);

  const esPropia = solicitud.solicitanteId === user?.id;
  const estado = solicitud.estado;

  // Nadie revisa lo suyo: la regla vive en la base, esto solo evita mostrar el botón.
  const puedeRevisar = can(PERMISSIONS.REVIEW_MATERIALS) && !esPropia
    && (estado === 'pendiente' || estado === 'observada');
  const puedeComprar = can(PERMISSIONS.MANAGE_PURCHASES)
    && ['aprobada', 'en_compra', 'compra_parcial'].includes(estado);
  const puedeConfirmarEntrega = esPropia && estado === 'comprada';
  const puedeEnviar = esPropia && (estado === 'borrador' || estado === 'observada');
  const puedeCancelar = (esPropia || can(PERMISSIONS.REVIEW_MATERIALS))
    && !['entregada', 'rechazada', 'cancelada'].includes(estado);

  // Entregar desde bodega descuenta stock: lo hace quien administra la bodega,
  // nunca quien pidió. La regla vive en la RPC; esto solo oculta el botón.
  const gestionaBodega = can(PERMISSIONS.RECORD_MOVEMENT);
  const puedePreparar = gestionaBodega && estado === 'aprobada';
  const puedeEntregar = gestionaBodega
    && ['aprobada', 'preparando', 'comprada', 'compra_parcial', 'entregada_parcial'].includes(estado)
    && solicitud.items.some(i => i.pendiente > 0);

  const { data: historial = [] } = useQuery({
    queryKey: ['material-historial', solicitud.id],
    queryFn: () => MaterialService.getHistorial(solicitud.id),
  });

  function alTerminar(mensaje: string) {
    addToast(mensaje, 'success');
    queryClient.invalidateQueries({ queryKey: ['materiales'] });
    queryClient.invalidateQueries({ queryKey: ['material-historial', solicitud.id] });
    queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
    onClose();
  }

  function alFallar(err: unknown) {
    addToast(err instanceof Error ? err.message : 'No se pudo completar la acción', 'danger');
  }

  const enviar = useMutation({
    mutationFn: () => MaterialService.enviar(solicitud.id),
    onSuccess: () => alTerminar('Solicitud enviada a revisión'),
    onError: alFallar,
  });

  const revisar = useMutation({
    mutationFn: (decision: 'aprobada' | 'rechazada' | 'observada') =>
      MaterialService.revisar(solicitud.id, decision, comentario,
        presupuesto ? Number(presupuesto) : null),
    onSuccess: () => alTerminar('Solicitud revisada'),
    onError: alFallar,
  });

  const compra = useMutation({
    mutationFn: (nuevo: 'en_compra' | 'compra_parcial' | 'comprada') =>
      MaterialService.actualizarCompra(solicitud.id, nuevo, comentario),
    onSuccess: () => alTerminar('Compra actualizada'),
    onError: alFallar,
  });

  const entrega = useMutation({
    mutationFn: () => MaterialService.confirmarEntrega(solicitud.id),
    onSuccess: () => alTerminar('Entrega confirmada'),
    onError: alFallar,
  });

  const cancelar = useMutation({
    mutationFn: () => MaterialService.cancelar(solicitud.id, comentario),
    onSuccess: () => alTerminar('Solicitud cancelada'),
    onError: alFallar,
  });

  const preparar = useMutation({
    mutationFn: () => MaterialService.preparar(solicitud.id),
    onSuccess: () => alTerminar('Bodega está preparando el pedido'),
    onError: alFallar,
  });

  const trabajando = enviar.isPending || revisar.isPending || compra.isPending
    || entrega.isPending || cancelar.isPending || preparar.isPending;

  function pedirComentario(): boolean {
    if (comentario.trim()) return true;
    addToast('Escribe un comentario explicando la decisión', 'warning');
    return false;
  }

  const badge = ESTADOS_MATERIAL[estado];

  return (
    <Modal isOpen onClose={onClose} title={solicitud.titulo}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Cabecera */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="badge" style={{ background: badge.bg, color: badge.color, fontWeight: 800 }}>
            {badge.icono} {badge.label}
          </span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: PRIORIDADES[solicitud.prioridad].color }}>
            Prioridad {PRIORIDADES[solicitud.prioridad].label.toLowerCase()}
          </span>
          {solicitud.solicitanteNombre && (
            <span style={{ fontSize: '13px', color: 'var(--navy-600)' }}>· {solicitud.solicitanteNombre}</span>
          )}
          {solicitud.fechaNecesidad && (
            <span style={{ fontSize: '13px', color: 'var(--navy-600)' }}>
              · Se necesita el {formatDate(solicitud.fechaNecesidad)}
            </span>
          )}
        </div>

        {solicitud.justificacion && (
          <p style={{ fontSize: '14px', color: 'var(--navy-800)', margin: 0 }}>{solicitud.justificacion}</p>
        )}

        {/* Materiales */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '420px' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--navy-600)' }}>
                <th style={{ padding: '8px 4px' }}>Material</th>
                <th style={{ padding: '8px 4px' }}>Cantidad</th>
                <th style={{ padding: '8px 4px' }}>Entregado</th>
                <th style={{ padding: '8px 4px' }}>Estimado</th>
                <th style={{ padding: '8px 4px' }}>Real</th>
              </tr>
            </thead>
            <tbody>
              {solicitud.items.map(item => (
                <tr key={item.id} style={{ borderTop: '1px solid var(--border-medium)' }}>
                  <td style={{ padding: '8px 4px', fontWeight: 600 }}>
                    {item.nombre}
                    {item.itemId && (
                      <Boxes
                        size={13}
                        style={{ marginLeft: '6px', verticalAlign: '-2px', color: 'var(--color-success)' }}
                        aria-label="Se descuenta de bodega"
                      />
                    )}
                  </td>
                  <td style={{ padding: '8px 4px', fontVariantNumeric: 'tabular-nums' }}>
                    {item.cantidad} {item.unidad}
                  </td>
                  <td style={{ padding: '8px 4px', fontVariantNumeric: 'tabular-nums' }}>
                    {item.cantidadEntregada > 0 ? (
                      <span style={{ color: item.pendiente > 0 ? 'var(--color-warning)' : 'var(--color-success)', fontWeight: 700 }}>
                        {item.cantidadEntregada}
                        {item.pendiente > 0 && <span style={{ fontWeight: 500 }}> · faltan {item.pendiente}</span>}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td style={{ padding: '8px 4px' }}>{formatCLP(item.costoEstimado)}</td>
                  <td style={{ padding: '8px 4px' }}>{formatCLP(item.costoReal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '13px' }}>
          <div><strong>Estimado:</strong> {formatCLP(solicitud.costoEstimadoTotal)}</div>
          {solicitud.presupuestoAutorizado !== null && (
            <div><strong>Autorizado:</strong> {formatCLP(solicitud.presupuestoAutorizado)}</div>
          )}
          {solicitud.costoRealTotal > 0 && (
            <div><strong>Gastado:</strong> {formatCLP(solicitud.costoRealTotal)}</div>
          )}
        </div>

        {solicitud.comentarioRevision && (
          <div style={{
            padding: '12px 16px', borderRadius: '12px', background: 'var(--bg-main)',
            fontSize: '13px', color: 'var(--navy-800)'
          }}>
            <strong>Respuesta de la revisión:</strong> {solicitud.comentarioRevision}
          </div>
        )}

        {/* Línea de tiempo */}
        <div>
          <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--navy-600)', marginBottom: '12px' }}>
            Historial
          </h4>
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {historial.map(evento => (
              <li key={evento.id} style={{ display: 'flex', gap: '12px', fontSize: '13px' }}>
                <span aria-hidden="true" style={{ color: 'var(--gold-500)' }}>●</span>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--navy-900)' }}>
                    {ESTADOS_MATERIAL[evento.estadoNuevo as keyof typeof ESTADOS_MATERIAL]?.label || evento.estadoNuevo}
                  </div>
                  <div style={{ color: 'var(--navy-600)' }}>{formatDateTime(evento.createdAt)}</div>
                  {evento.comentario && (
                    <div style={{ color: 'var(--navy-600)', fontStyle: 'italic' }}>{evento.comentario}</div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Acciones */}
        {(puedeRevisar || puedeComprar || puedeCancelar) && (
          <div>
            <label className="form-label" htmlFor="comentario-material">
              Comentario {(puedeRevisar) && <span style={{ fontWeight: 500 }}>(obligatorio si rechazas u observas)</span>}
            </label>
            <textarea id="comentario-material" className="form-textarea" rows={2} value={comentario}
              onChange={e => setComentario(e.target.value)} placeholder="Visible para quien solicitó" />
          </div>
        )}

        {puedeRevisar && (
          <>
            <div>
              <label className="form-label" htmlFor="presupuesto-material">
                Presupuesto autorizado <span style={{ fontWeight: 500 }}>(si lo dejas vacío se usa el estimado)</span>
              </label>
              <input id="presupuesto-material" type="number" min="0" step="1" className="form-input"
                value={presupuesto} onChange={e => setPresupuesto(e.target.value)}
                placeholder={String(solicitud.costoEstimadoTotal)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button className="btn btn-outline" disabled={trabajando}
                onClick={() => pedirComentario() && revisar.mutate('rechazada')}>
                <X size={18} /> Rechazar
              </button>
              <button className="btn btn-gold" disabled={trabajando} onClick={() => revisar.mutate('aprobada')}>
                <Check size={18} /> Aprobar
              </button>
            </div>
            <button className="btn btn-ghost" style={{ width: '100%' }} disabled={trabajando}
              onClick={() => pedirComentario() && revisar.mutate('observada')}>
              <MessageSquare size={18} /> Pedir cambios sin rechazar
            </button>
          </>
        )}

        {puedeComprar && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <button className="btn btn-outline" disabled={trabajando} onClick={() => compra.mutate('en_compra')}>
              <ShoppingCart size={16} /> En compra
            </button>
            <button className="btn btn-outline" disabled={trabajando} onClick={() => compra.mutate('compra_parcial')}>
              Parcial
            </button>
            <button className="btn btn-gold" disabled={trabajando} onClick={() => compra.mutate('comprada')}>
              Comprada
            </button>
          </div>
        )}

        {puedeEnviar && (
          <button className="btn btn-gold" style={{ width: '100%' }} disabled={trabajando}
            onClick={() => enviar.mutate()}>
            <Send size={18} /> Enviar a revisión
          </button>
        )}

        {/* Entrega desde bodega: descuenta el stock de lo que está enlazado */}
        {(puedePreparar || puedeEntregar) && (
          <div style={{ display: 'grid', gap: '8px' }}>
            {puedePreparar && (
              <button className="btn btn-outline" disabled={trabajando} onClick={() => preparar.mutate()}>
                <ClipboardList size={17} /> Estoy preparando el pedido
              </button>
            )}
            {puedeEntregar && (
              <button className="btn btn-gold" disabled={trabajando} onClick={() => setEntregando(true)}>
                <Boxes size={18} /> Entregar desde bodega
              </button>
            )}
          </div>
        )}

        {puedeConfirmarEntrega && (
          <button className="btn btn-gold" style={{ width: '100%' }} disabled={trabajando}
            onClick={() => entrega.mutate()}>
            <PackageCheck size={18} /> Confirmar que recibí los materiales
          </button>
        )}

        {puedeCancelar && (
          <button className="btn btn-ghost" style={{ width: '100%' }} disabled={trabajando}
            onClick={() => cancelar.mutate()}>
            <Ban size={16} /> Cancelar solicitud
          </button>
        )}
      </div>

      {entregando && (
        <EntregaMaterialesModal
          solicitud={solicitud}
          onClose={() => setEntregando(false)}
          onEntregado={() => { setEntregando(false); alTerminar('Materiales entregados'); }}
        />
      )}
    </Modal>
  );
}
