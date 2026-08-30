import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight, Clock, Laptop, MapPin, Plus, TriangleAlert, Undo2,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '../../auth/permissions';
import { useSede } from '../../auth/SedeContext';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { ETIQUETA_ESTADO_RECURSO, PrestamoService } from '../../services/prestamoService';
import { UsuarioService } from '../../services/usuarioService';
import { EstadoRecurso, Prestamo, Recurso } from '../../types';
import { formatDate, getToday } from '../../utils/dates';

type Pestana = 'afuera' | 'equipos' | 'devueltos';

const CLASE_ESTADO: Record<EstadoRecurso, string> = {
  disponible: 'badge-success',
  prestado: 'badge-warning',
  mantencion: 'badge-info',
  no_disponible: 'badge-danger',
};

/** Plazo por defecto: una semana. Es lo que dura un préstamo en la práctica. */
function enUnaSemana(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

const RECURSO_VACIO = {
  nombre: '', tipo: '', descripcion: '', codigo: '', ubicacion: '',
};

/**
 * Préstamos de equipos.
 *
 * El problema real no es prestar: es acordarse de quién lo tiene. Por eso la
 * pestaña que se abre primero es «Afuera», ordenada por vencimiento, y los
 * atrasados van arriba y en rojo.
 *
 * Prestar y recibir lo hace quien administra la bodega. Ver quién tiene qué lo
 * puede hacer cualquiera de la sede: si necesitas el proyector, tienes que
 * saber a quién pedírselo.
 */
export default function PrestamosModule() {
  const { can } = useAuth();
  const { sede } = useSede();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const administra = can(PERMISSIONS.MANAGE_LOANS);

  const [tab, setTab] = useState<Pestana>('afuera');
  const [prestando, setPrestando] = useState<Recurso | null>(null);
  const [devolviendo, setDevolviendo] = useState<Prestamo | null>(null);
  const [formRecurso, setFormRecurso] = useState<typeof RECURSO_VACIO | null>(null);
  const [error, setError] = useState('');

  const [formPrestamo, setFormPrestamo] = useState({
    prestadoA: '', fechaEntrega: getToday(), fechaDevolucionEsperada: enUnaSemana(),
    estadoAlEntregar: '', observaciones: '',
  });
  const [formDevolucion, setFormDevolucion] = useState({ fecha: getToday(), estado: '' });

  const activos = useQuery({
    queryKey: ['prestamos', 'activos', sede.id],
    queryFn: () => PrestamoService.getPrestamosActivos(sede.id),
  });
  const recursos = useQuery({
    queryKey: ['recursos', sede.id],
    queryFn: () => PrestamoService.getRecursos(sede.id),
  });
  const devueltos = useQuery({
    queryKey: ['prestamos', 'devueltos', sede.id],
    queryFn: () => PrestamoService.getPrestamosDevueltos(sede.id),
    enabled: tab === 'devueltos',
  });
  const colegas = useQuery({
    queryKey: ['colegas'],
    queryFn: UsuarioService.getColegas,
    enabled: administra,
  });

  function refrescar() {
    queryClient.invalidateQueries({ queryKey: ['prestamos'] });
    queryClient.invalidateQueries({ queryKey: ['recursos', sede.id] });
    queryClient.invalidateQueries({ queryKey: ['panel-operaciones'] });
  }

  const prestar = useMutation({
    mutationFn: async () => {
      if (!prestando) return;
      if (!formPrestamo.prestadoA) throw new Error('Elige a quién se le presta');
      await PrestamoService.prestar({
        recursoId: prestando.id,
        prestadoA: formPrestamo.prestadoA,
        fechaEntrega: formPrestamo.fechaEntrega,
        fechaDevolucionEsperada: formPrestamo.fechaDevolucionEsperada,
        estadoAlEntregar: formPrestamo.estadoAlEntregar || null,
        observaciones: formPrestamo.observaciones || null,
      });
    },
    onSuccess: () => {
      addToast('Préstamo registrado', 'success');
      setPrestando(null);
      setFormPrestamo({
        prestadoA: '', fechaEntrega: getToday(), fechaDevolucionEsperada: enUnaSemana(),
        estadoAlEntregar: '', observaciones: '',
      });
      refrescar();
    },
    onError: (e: Error) => setError(e.message),
  });

  const devolver = useMutation({
    mutationFn: async () => {
      if (!devolviendo) return;
      await PrestamoService.devolver(devolviendo.id, formDevolucion.fecha, formDevolucion.estado || null);
    },
    onSuccess: () => {
      addToast('Devolución registrada', 'success');
      setDevolviendo(null);
      setFormDevolucion({ fecha: getToday(), estado: '' });
      refrescar();
    },
    onError: (e: Error) => setError(e.message),
  });

  const crearRecurso = useMutation({
    mutationFn: (datos: typeof RECURSO_VACIO) => PrestamoService.crearRecurso({
      sedeId: sede.id,
      nombre: datos.nombre,
      tipo: datos.tipo || null,
      descripcion: datos.descripcion || null,
      codigo: datos.codigo || null,
      ubicacion: datos.ubicacion || null,
    }),
    onSuccess: () => { addToast('Equipo agregado', 'success'); setFormRecurso(null); refrescar(); },
    onError: (e: Error) => setError(e.message),
  });

  const cambiarEstado = useMutation({
    mutationFn: ({ id, estado }: { id: number; estado: EstadoRecurso }) =>
      PrestamoService.marcarEstado(id, estado),
    onSuccess: () => refrescar(),
    onError: (e: Error) => addToast(e.message, 'danger'),
  });

  const atrasados = useMemo(
    () => (activos.data ?? []).filter(p => p.situacion === 'atrasado').length,
    [activos.data]
  );

  const disponibles = (recursos.data ?? []).filter(r => r.estado === 'disponible');

  return (
    <div className="page-container animate-in">
      <header className="page-header">
        <div>
          <h1 className="page-title">Préstamos</h1>
          <p className="page-subtitle">Quién tiene qué, y desde cuándo. {sede.nombre}</p>
        </div>
        {administra && (
          <button className="btn btn-outline" onClick={() => { setFormRecurso(RECURSO_VACIO); setError(''); }}>
            <Plus size={18} /> Agregar equipo
          </button>
        )}
      </header>

      {atrasados > 0 && (
        <div
          style={{
            display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '18px',
            padding: '12px 14px', borderRadius: 'var(--radius-md)',
            background: 'var(--color-danger-soft)', color: 'var(--color-danger)',
            fontWeight: 700, fontSize: '13.5px',
          }}
        >
          <TriangleAlert size={18} />
          {atrasados} equipo{atrasados === 1 ? '' : 's'} pasado{atrasados === 1 ? '' : 's'} de plazo
        </div>
      )}

      <div className="tabs" style={{ marginBottom: '20px' }}>
        <button className={`tab ${tab === 'afuera' ? 'active' : ''}`} onClick={() => setTab('afuera')}>
          Afuera ahora
        </button>
        <button className={`tab ${tab === 'equipos' ? 'active' : ''}`} onClick={() => setTab('equipos')}>
          Equipos
        </button>
        <button className={`tab ${tab === 'devueltos' ? 'active' : ''}`} onClick={() => setTab('devueltos')}>
          Devueltos
        </button>
      </div>

      {tab === 'afuera' && (
        activos.isLoading ? <div className="skeleton" style={{ height: 300 }} />
        : (activos.data ?? []).length === 0 ? (
          <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <ArrowLeftRight size={44} style={{ color: 'var(--text-muted)', marginBottom: '14px' }} />
            <h3 style={{ marginBottom: '6px' }}>No hay nada prestado</h3>
            <p className="text-muted">Todos los equipos están en su lugar.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {(activos.data ?? []).map(p => (
              <FilaPrestamo
                key={p.id} prestamo={p} administra={administra}
                onDevolver={() => { setDevolviendo(p); setError(''); }}
              />
            ))}
          </div>
        )
      )}

      {tab === 'equipos' && (
        recursos.isLoading ? <div className="skeleton" style={{ height: 300 }} />
        : (recursos.data ?? []).length === 0 ? (
          <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <Laptop size={44} style={{ color: 'var(--text-muted)', marginBottom: '14px' }} />
            <h3 style={{ marginBottom: '6px' }}>Todavía no hay equipos cargados</h3>
            <p className="text-muted">Notebooks, proyectores, parlantes: lo que se presta y vuelve.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {(recursos.data ?? []).map(r => (
              <article key={r.id} className="card" style={{ padding: '14px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '15px' }}>{r.nombre}</strong>
                    <span className={`badge ${CLASE_ESTADO[r.estado]}`}>
                      {ETIQUETA_ESTADO_RECURSO[r.estado]}
                    </span>
                  </div>
                  <div className="text-muted" style={{ fontSize: '12.5px', marginTop: '4px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {r.codigo && <span>Código {r.codigo}</span>}
                    {r.tipo && <span>{r.tipo}</span>}
                    {r.ubicacion && (
                      <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <MapPin size={12} /> {r.ubicacion}
                      </span>
                    )}
                  </div>
                </div>

                {administra && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {r.estado === 'disponible' && (
                      <button className="btn btn-gold btn-sm" onClick={() => { setPrestando(r); setError(''); }}>
                        <ArrowLeftRight size={15} /> Prestar
                      </button>
                    )}
                    {r.estado === 'disponible' && (
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => cambiarEstado.mutate({ id: r.id, estado: 'mantencion' })}
                      >
                        A mantención
                      </button>
                    )}
                    {(r.estado === 'mantencion' || r.estado === 'no_disponible') && (
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => cambiarEstado.mutate({ id: r.id, estado: 'disponible' })}
                      >
                        Volver a disponible
                      </button>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )
      )}

      {tab === 'devueltos' && (
        devueltos.isLoading ? <div className="skeleton" style={{ height: 300 }} />
        : (devueltos.data ?? []).length === 0 ? (
          <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <Undo2 size={44} style={{ color: 'var(--text-muted)', marginBottom: '14px' }} />
            <h3 style={{ marginBottom: '6px' }}>Todavía no hay devoluciones</h3>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {(devueltos.data ?? []).map(p => (
              <FilaPrestamo key={p.id} prestamo={p} administra={false} onDevolver={() => {}} />
            ))}
          </div>
        )
      )}

      {/* Prestar */}
      {prestando && (
        <Modal
          isOpen onClose={() => setPrestando(null)} title={`Prestar: ${prestando.nombre}`}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setPrestando(null)}>Cancelar</button>
              <button className="btn btn-gold" disabled={prestar.isPending} onClick={() => { setError(''); prestar.mutate(); }}>
                Registrar préstamo
              </button>
            </>
          }
        >
          <div style={{ display: 'grid', gap: '14px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="prest-quien">¿A quién?</label>
              <select
                id="prest-quien" className="form-input" autoFocus
                value={formPrestamo.prestadoA}
                onChange={e => setFormPrestamo({ ...formPrestamo, prestadoA: e.target.value })}
              >
                <option value="">Elige a la persona</option>
                {(colegas.data ?? []).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="prest-desde">Se lleva el</label>
                <input
                  id="prest-desde" type="date" className="form-input"
                  value={formPrestamo.fechaEntrega}
                  onChange={e => setFormPrestamo({ ...formPrestamo, fechaEntrega: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="prest-hasta">Lo devuelve el</label>
                <input
                  id="prest-hasta" type="date" className="form-input"
                  value={formPrestamo.fechaDevolucionEsperada}
                  onChange={e => setFormPrestamo({ ...formPrestamo, fechaDevolucionEsperada: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="prest-estado">¿Cómo va el equipo? (opcional)</label>
              <input
                id="prest-estado" className="form-input"
                placeholder="Con cargador y funda"
                value={formPrestamo.estadoAlEntregar}
                onChange={e => setFormPrestamo({ ...formPrestamo, estadoAlEntregar: e.target.value })}
              />
              <p className="text-muted" style={{ fontSize: '12px', marginTop: '6px' }}>
                Anotarlo ahora evita la discusión de después.
              </p>
            </div>
            {error && <p style={{ color: 'var(--color-danger)', fontSize: '13px', margin: 0 }}>{error}</p>}
          </div>
        </Modal>
      )}

      {/* Devolver */}
      {devolviendo && (
        <Modal
          isOpen onClose={() => setDevolviendo(null)} title={`Recibir: ${devolviendo.recurso}`}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setDevolviendo(null)}>Cancelar</button>
              <button className="btn btn-gold" disabled={devolver.isPending} onClick={() => { setError(''); devolver.mutate(); }}>
                <Undo2 size={17} /> Registrar devolución
              </button>
            </>
          }
        >
          <div style={{ display: 'grid', gap: '14px' }}>
            <p className="text-muted" style={{ margin: 0, fontSize: '13.5px' }}>
              Lo tenía {devolviendo.prestadoANombre} desde el {formatDate(devolviendo.fechaEntrega)}.
              {devolviendo.estadoAlEntregar && ` Se entregó: ${devolviendo.estadoAlEntregar}.`}
            </p>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="dev-fecha">¿Cuándo volvió?</label>
              <input
                id="dev-fecha" type="date" className="form-input"
                value={formDevolucion.fecha}
                onChange={e => setFormDevolucion({ ...formDevolucion, fecha: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="dev-estado">¿Cómo volvió? (opcional)</label>
              <input
                id="dev-estado" className="form-input"
                placeholder="Sin el cargador"
                value={formDevolucion.estado}
                onChange={e => setFormDevolucion({ ...formDevolucion, estado: e.target.value })}
              />
            </div>
            {error && <p style={{ color: 'var(--color-danger)', fontSize: '13px', margin: 0 }}>{error}</p>}
          </div>
        </Modal>
      )}

      {/* Nuevo equipo */}
      {formRecurso && (
        <Modal
          isOpen onClose={() => setFormRecurso(null)} title="Agregar equipo"
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setFormRecurso(null)}>Cancelar</button>
              <button
                className="btn btn-gold" disabled={crearRecurso.isPending}
                onClick={() => {
                  setError('');
                  if (formRecurso.nombre.trim().length < 2) { setError('Ponle un nombre'); return; }
                  crearRecurso.mutate(formRecurso);
                }}
              >
                Agregar
              </button>
            </>
          }
        >
          <div style={{ display: 'grid', gap: '14px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="rec-nombre">Nombre</label>
              <input
                id="rec-nombre" className="form-input" autoFocus
                placeholder="Notebook Lenovo sala 2"
                value={formRecurso.nombre}
                onChange={e => setFormRecurso({ ...formRecurso, nombre: e.target.value })}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="rec-tipo">Tipo (opcional)</label>
                <input
                  id="rec-tipo" className="form-input" placeholder="Notebook"
                  value={formRecurso.tipo}
                  onChange={e => setFormRecurso({ ...formRecurso, tipo: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="rec-codigo">Código (opcional)</label>
                <input
                  id="rec-codigo" className="form-input" placeholder="NB-002"
                  value={formRecurso.codigo}
                  onChange={e => setFormRecurso({ ...formRecurso, codigo: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="rec-ubicacion">Dónde se guarda (opcional)</label>
              <input
                id="rec-ubicacion" className="form-input" placeholder="Armario de dirección"
                value={formRecurso.ubicacion}
                onChange={e => setFormRecurso({ ...formRecurso, ubicacion: e.target.value })}
              />
            </div>
            {error && <p style={{ color: 'var(--color-danger)', fontSize: '13px', margin: 0 }}>{error}</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}

function FilaPrestamo({
  prestamo, administra, onDevolver,
}: {
  prestamo: Prestamo;
  administra: boolean;
  onDevolver: () => void;
}) {
  const atrasado = prestamo.situacion === 'atrasado';
  const devuelto = prestamo.situacion === 'devuelto';

  return (
    <article
      className="card"
      style={{
        padding: '14px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap',
        borderLeft: `4px solid ${atrasado ? 'var(--color-danger)' : devuelto ? 'var(--border-medium)' : 'var(--color-gold)'}`,
        opacity: devuelto ? 0.75 : 1,
      }}
    >
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '15px' }}>{prestamo.recurso}</strong>
          {prestamo.codigo && <span className="badge">{prestamo.codigo}</span>}
          {atrasado && <span className="badge badge-danger">Atrasado</span>}
        </div>
        <div className="text-muted" style={{ fontSize: '12.5px', marginTop: '4px' }}>
          {prestamo.prestadoANombre} · desde el {formatDate(prestamo.fechaEntrega)}
        </div>
        <div
          style={{
            fontSize: '12.5px', marginTop: '4px', display: 'flex', gap: '5px', alignItems: 'center',
            color: atrasado ? 'var(--color-danger)' : 'var(--text-muted)',
            fontWeight: atrasado ? 700 : 400,
          }}
        >
          <Clock size={13} />
          {devuelto
            ? `Devuelto el ${formatDate(prestamo.fechaDevolucionReal!)}`
            : atrasado
              ? `${Math.abs(prestamo.diasRestantes)} día${Math.abs(prestamo.diasRestantes) === 1 ? '' : 's'} de atraso`
              : `Vence el ${formatDate(prestamo.fechaDevolucionEsperada)}`}
        </div>
        {devuelto && prestamo.estadoAlDevolver && (
          <div className="text-muted" style={{ fontSize: '12px', marginTop: '4px' }}>
            Volvió: {prestamo.estadoAlDevolver}
          </div>
        )}
      </div>

      {administra && !devuelto && (
        <button className="btn btn-outline btn-sm" onClick={onDevolver}>
          <Undo2 size={15} /> Recibir
        </button>
      )}
    </article>
  );
}
