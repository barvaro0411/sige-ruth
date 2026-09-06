import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Camera, CheckCircle2, Lock, MapPin, User2, Wrench } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '../../auth/permissions';
import { useSede } from '../../auth/SedeContext';
import { useToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import { AdjuntoService } from '../../services/adjuntoService';
import {
  ETIQUETA_ESTADO, ETIQUETA_PRIORIDAD, MantencionService, SIGUIENTES_ESTADOS,
} from '../../services/mantencionService';
import { UsuarioService } from '../../services/usuarioService';
import { EstadoMantencion, Mantencion } from '../../types';
import { formatDate, formatDateTime } from '../../utils/dates';

const MONEDA = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

/**
 * Detalle de una incidencia: qué se reportó, en qué va y qué se puede hacer
 * ahora. Las acciones que se muestran son las que la base va a aceptar — el
 * resto no aparece, y si igual llegara, el trigger la rechaza.
 */
export default function MantencionDetalle({
  mantencion, onCerrar,
}: {
  mantencion: Mantencion;
  onCerrar: () => void;
}) {
  const { user, can } = useAuth();
  const { sede } = useSede();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const gestiona = can(PERMISSIONS.MANAGE_MAINTENANCE);
  const esReportante = user?.id === mantencion.reportadoPor;
  const cerradaDefinitiva = mantencion.estado === 'cerrada' || mantencion.estado === 'cancelada';

  const [trabajo, setTrabajo] = useState('');
  const [costo, setCosto] = useState('');
  const [proveedor, setProveedor] = useState(mantencion.proveedor ?? '');
  const [resolviendo, setResolviendo] = useState(false);
  const [error, setError] = useState('');

  const historial = useQuery({
    queryKey: ['mantencion-historial', mantencion.id],
    queryFn: () => MantencionService.getHistorial(mantencion.id),
  });

  const adjuntos = useQuery({
    queryKey: ['mantencion-adjuntos', mantencion.id],
    queryFn: () => AdjuntoService.getPorOrigen('mantencion', mantencion.id),
  });

  const colegas = useQuery({
    queryKey: ['colegas'],
    queryFn: UsuarioService.getColegas,
    enabled: gestiona,
  });

  function refrescar() {
    queryClient.invalidateQueries({ queryKey: ['mantenciones'] });
    queryClient.invalidateQueries({ queryKey: ['mantencion-historial', mantencion.id] });
    queryClient.invalidateQueries({ queryKey: ['panel-operaciones'] });
  }

  const accion = useMutation({
    mutationFn: async (fn: () => Promise<void>) => fn(),
    onSuccess: () => { refrescar(); setError(''); },
    onError: (e: Error) => setError(e.message),
  });

  const subirFoto = useMutation({
    mutationFn: async (archivo: File) => {
      if (!user) throw new Error('Sesión no disponible');
      await AdjuntoService.subir(archivo, {
        origen: 'mantencion',
        origenId: mantencion.id,
        sedeId: mantencion.sedeId || sede.id,
        subidoPor: user.id,
        // Antes de resolver es «cómo estaba»; después, «cómo quedó».
        momento: mantencion.estado === 'resuelta' ? 'despues' : 'antes',
      });
    },
    onSuccess: () => {
      addToast('Foto agregada', 'success');
      queryClient.invalidateQueries({ queryKey: ['mantencion-adjuntos', mantencion.id] });
    },
    onError: (e: Error) => addToast(e.message, 'danger'),
  });

  function resolver() {
    setError('');
    if (trabajo.trim().length < 3) {
      setError('Describe qué se hizo para poder resolverla'); return;
    }
    const monto = costo.trim() === '' ? null : Number(costo);
    if (monto !== null && (Number.isNaN(monto) || monto < 0)) {
      setError('El costo tiene que ser un número'); return;
    }
    accion.mutate(async () => {
      await MantencionService.resolver(mantencion.id, trabajo, monto, proveedor);
      setResolviendo(false);
      addToast('Mantención resuelta', 'success');
    });
  }

  const siguientes = SIGUIENTES_ESTADOS[mantencion.estado] ?? [];

  return (
    <Modal isOpen onClose={onCerrar} title={mantencion.lugar} size="lg">
      <div className="grid gap-5">
        {/* Encabezado */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="badge badge-navy">{ETIQUETA_ESTADO[mantencion.estado]}</span>
          <span className={`badge ${mantencion.prioridad === 'urgente' ? 'badge-danger'
            : mantencion.prioridad === 'alta' ? 'badge-warning' : 'badge-info'}`}>
            {ETIQUETA_PRIORIDAD[mantencion.prioridad]}
          </span>
          {mantencion.categoria && <span className="badge">{mantencion.categoria}</span>}
        </div>

        <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.55 }}>{mantencion.descripcion}</p>

        <div className="text-muted text-sm grid gap-1">
          <span className="flex gap-1 items-center">
            <User2 size={14} /> Reportó {mantencion.reportadoPorNombre ?? 'alguien del equipo'} · {formatDateTime(mantencion.createdAt)}
          </span>
          {mantencion.asignadoANombre && (
            <span className="flex gap-1 items-center">
              <Wrench size={14} /> A cargo: {mantencion.asignadoANombre}
            </span>
          )}
          {mantencion.fechaProgramada && (
            <span className="flex gap-1 items-center">
              <MapPin size={14} /> Programada para el {formatDate(mantencion.fechaProgramada)}
            </span>
          )}
        </div>

        {/* Fotos */}
        {(adjuntos.data ?? []).length> 0 && (
          <section>
            <h4 className="text-sm mb-2">Fotos</h4>
            <div className="flex gap-2 flex-wrap">
              {(adjuntos.data ?? []).map(a => (
                <figure key={a.id}>
                  <img
                    src={a.url} alt={a.nombreArchivo}
                    style={{
                      width: 132, height: 132, objectFit: 'cover',
                      borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)',
                    }}
 />
                  <figcaption className="text-muted text-xs mt-1">
                    {a.momento === 'despues' ? 'Cómo quedó' : 'Cómo estaba'}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {!cerradaDefinitiva && (gestiona || esReportante) && (
          <label className="btn btn-outline btn-sm justify-self-start cursor-pointer">
            <Camera size={16} /> Agregar foto
            <input
              type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) subirFoto.mutate(f); }}
 />
          </label>
        )}

        {/* Resolución registrada */}
        {mantencion.trabajoRealizado && (
          <section style={{
            padding: '14px', borderRadius: 'var(--radius-md)',
            background: 'var(--color-success-soft)', border: '1px solid var(--border-light)',
          }}>
            <h4 className="text-sm mb-1">Qué se hizo</h4>
            <p className="text-base">{mantencion.trabajoRealizado}</p>
            {(mantencion.costo !== null || mantencion.proveedor) && (
              <p className="text-muted text-sm mt-2">
                {mantencion.proveedor && <>{mantencion.proveedor}</>}
                {mantencion.proveedor && mantencion.costo !== null && ' · '}
                {mantencion.costo !== null && MONEDA.format(mantencion.costo)}
              </p>
            )}
          </section>
        )}

        {/* Acciones de gestión */}
        {gestiona && !cerradaDefinitiva && (
          <section className="grid gap-3">
            {siguientes.length> 0 && (
              <div className="form-group">
                <label className="form-label" htmlFor="mant-estado">Mover a</label>
                <select
                  id="mant-estado" className="form-input" value=""
                  onChange={e => {
                    const destino = e.target.value as EstadoMantencion;
                    if (destino) accion.mutate(() => MantencionService.cambiarEstado(mantencion.id, destino));
                  }}
                >
                  <option value="">Elegir estado…</option>
                  {siguientes.map(s => <option key={s} value={s}>{ETIQUETA_ESTADO[s]}</option>)}
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="mant-asignado">A cargo de</label>
              <select
                id="mant-asignado" className="form-input"
                value={mantencion.asignadoA ?? ''}
                onChange={e => accion.mutate(() =>
                  MantencionService.ajustar(mantencion.id, { asignadoA: e.target.value || null })
                )}
              >
                <option value="">Sin asignar</option>
                {(colegas.data ?? []).map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="mant-fecha">Programar para</label>
              <input
                id="mant-fecha" type="date" className="form-input"
                value={mantencion.fechaProgramada ?? ''}
                onChange={e => accion.mutate(() =>
                  MantencionService.ajustar(mantencion.id, { fechaProgramada: e.target.value || null })
                )}
 />
            </div>

            {mantencion.estado !== 'resuelta' && !resolviendo && (
              <button className="btn btn-gold" onClick={() => setResolviendo(true)}>
                <CheckCircle2 size={17} /> Marcar como resuelta
              </button>
            )}

            {resolviendo && (
              <div className="grid gap-2 p-3 rounded-md border">
                <div className="form-group">
                  <label className="form-label" htmlFor="mant-trabajo">¿Qué se hizo?</label>
                  <textarea
                    id="mant-trabajo" className="form-textarea" rows={2} autoFocus
                    placeholder="Se cambió el flexible y la llave"
                    value={trabajo} onChange={e => setTrabajo(e.target.value)}
 />
                </div>
                <div className="grid grid-2 gap-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="mant-costo">Costo (opcional)</label>
                    <input
                      id="mant-costo" className="form-input" inputMode="numeric"
                      placeholder="0" value={costo} onChange={e => setCosto(e.target.value)}
 />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="mant-proveedor">Quién lo hizo</label>
                    <input
                      id="mant-proveedor" className="form-input"
                      placeholder="Gasfíter, o el nombre del taller"
                      value={proveedor} onChange={e => setProveedor(e.target.value)}
 />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-outline" onClick={() => setResolviendo(false)}>Cancelar</button>
                  <button className="btn btn-gold" onClick={resolver} disabled={accion.isPending}>
                    Guardar resolución
                  </button>
                </div>
              </div>
            )}

            {mantencion.estado === 'resuelta' && (
              <button
                className="btn btn-outline"
                onClick={() => accion.mutate(async () => {
                  await MantencionService.cerrar(mantencion.id);
                  addToast('Mantención cerrada', 'success');
                  onCerrar();
                })}
              >
                <Lock size={17} /> Cerrar definitivamente
              </button>
            )}
          </section>
        )}

        {/* Cancelar: quien reportó también puede, si se equivocó */}
        {!cerradaDefinitiva && (gestiona || esReportante) && (
          <button
            className="btn btn-ghost text-danger justify-self-start"

onClick={() => accion.mutate(async () => {
              await MantencionService.cancelar(mantencion.id);
              addToast('Reporte cancelado', 'info');
              onCerrar();
            })}
          >
            <Ban size={16} /> Cancelar este reporte
          </button>
        )}

        {error && <p className="text-danger text-sm">{error}</p>}

        {/* Historial */}
        <section>
          <h4 className="text-sm mb-2">Historial</h4>
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '10px' }}>
            {(historial.data ?? []).map(evento => (
              <li key={evento.id} className="flex gap-2 text-sm">
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0,
                  background: 'var(--color-gold)',
                }} />
                <div>
                  <div className="font-bold">
                    {ETIQUETA_ESTADO[evento.estadoNuevo as EstadoMantencion] ?? evento.estadoNuevo}
                  </div>
                  <div className="text-muted text-sm">
                    {formatDateTime(evento.createdAt)}
                  </div>
                  {evento.comentario && (
                    <div className="text-sm">{evento.comentario}</div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </Modal>
  );
}
