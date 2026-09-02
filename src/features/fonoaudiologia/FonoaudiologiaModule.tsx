import { useState, lazy, Suspense, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import { EstudianteService } from '../../services/estudianteService';
import { FonoService } from '../../services/fonoService';
import { getToday, getMonthName } from '../../utils/dates';
import { useSede } from '../../auth/SedeContext';
import { useToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import { buildIdMap } from '../../utils/mappers';
import { Plus, Calendar, TrendingUp, Edit, Activity } from 'lucide-react';
import { PERMISSIONS } from '../../auth/permissions';
import { EstudianteResumen, Tables } from '../../types';

// Mismo motivo que en el panel: el gráfico trae `recharts` consigo.
const FonoEvolutionChart = lazy(() => import('./FonoEvolutionChart'));

const ESCALA_EVALUACION = [
  { valor: 1, etiqueta: 'Inicial', color: '#F43F5E' },
  { valor: 2, etiqueta: 'En Proceso', color: '#F59E0B' },
  { valor: 3, etiqueta: 'Logrado', color: '#10B981' },
];

const NIVELES_EVALUACION = [
  { id: 'fonetico', label: 'Nivel Fonético' },
  { id: 'semantico', label: 'Nivel Semántico' },
  { id: 'morfosintactico', label: 'Nivel Morfosintáctico' },
  { id: 'pragmatico', label: 'Nivel Pragmático' },
] as const;

type NivelKey = typeof NIVELES_EVALUACION[number]['id'];

type SesionConEstudiante = Tables['sesiones_fono'] & {
  estudiante?: EstudianteResumen;
};

export default function FonoaudiologiaModule() {
  const { user, can } = useAuth();
  const { sede } = useSede();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [alumnoParaEvolucion, setAlumnoParaEvolucion] = useState<EstudianteResumen | null>(null);
  const [mesSeleccionado, setMesSeleccionado] = useState(new Date().getMonth());

  // Form State
  const [sesionEnEdicion, setSesionEnEdicion] = useState<SesionConEstudiante | null>(null);
  const [fechaSesion, setFechaSesion] = useState(getToday());
  const [idAlumnoSeleccionado, setIdAlumnoSeleccionado] = useState('');
  const [descripcionActividad, setDescripcionActividad] = useState('');
  const [notasAdicionales, setNotasAdicionales] = useState('');
  const [nivelesLogrados, setNivelesLogrados] = useState<Record<NivelKey, number>>({
    fonetico: 0,
    semantico: 0,
    morfosintactico: 0,
    pragmatico: 0,
  });

  const { data: listadoEstudiantes = [], isLoading: cargandoEstudiantes } = useQuery<EstudianteResumen[]>({
    queryKey: ['estudiantes', sede?.id],
    queryFn: () => EstudianteService.getAllBySede(sede.id),
    enabled: Boolean(sede?.id),
  });

  const { data: sesionesRaw = [], isLoading: cargandoSesiones } = useQuery<Tables['sesiones_fono'][]>({
    queryKey: ['sesiones_fono', sede?.id],
    queryFn: () => FonoService.getSesionesBySede(sede.id),
    enabled: Boolean(sede?.id),
  });

  const mapaEstudiantes = useMemo(() => buildIdMap(listadoEstudiantes), [listadoEstudiantes]);

  const historialSesiones: SesionConEstudiante[] = useMemo(() => {
    return sesionesRaw.map(s => ({
      ...s,
      estudiante: mapaEstudiantes[s.estudiante_id],
    }));
  }, [sesionesRaw, mapaEstudiantes]);

  const saveMutation = useMutation({
    mutationFn: (payload: Partial<Tables['sesiones_fono']>) => FonoService.saveSesion(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sesiones_fono', sede.id] });
      addToast('Sesión registrada correctamente', 'success');
      limpiarForm();
    },
    onError: (err: Error) => {
      if (import.meta.env.DEV) console.error(err);
      addToast('Error al guardar la sesión', 'danger');
    },
  });

  const limpiarForm = () => {
    setMostrarFormulario(false);
    setSesionEnEdicion(null);
    setFechaSesion(getToday());
    setIdAlumnoSeleccionado('');
    setDescripcionActividad('');
    setNotasAdicionales('');
    setNivelesLogrados({ fonetico: 0, semantico: 0, morfosintactico: 0, pragmatico: 0 });
  };

  const editarSesion = (s: SesionConEstudiante) => {
    setSesionEnEdicion(s);
    setFechaSesion(s.fecha);
    setIdAlumnoSeleccionado(s.estudiante_id.toString());
    setDescripcionActividad(s.actividad_realizada);
    setNotasAdicionales(s.observaciones || '');
    setNivelesLogrados({
      fonetico: s.nivel_fonetico,
      semantico: s.nivel_semantico,
      morfosintactico: s.nivel_morfosintactico,
      pragmatico: s.nivel_pragmatico,
    });
    setMostrarFormulario(true);
  };

  const guardarSesion = async () => {
    if (!user || !can(PERMISSIONS.RECORD_SESSIONS) || saveMutation.isPending) return;

    if (!fechaSesion || !idAlumnoSeleccionado || !descripcionActividad.trim()) {
      addToast('Completa la fecha, el estudiante y la actividad', 'warning');
      return;
    }
    if (fechaSesion > getToday()) {
      addToast('La fecha de la sesión no puede estar en el futuro', 'warning');
      return;
    }
    if (descripcionActividad.trim().length < 5) {
      addToast('Describe la actividad con al menos 5 caracteres', 'warning');
      return;
    }
    if (Object.values(nivelesLogrados).some(nivel => nivel < 1 || nivel > 3)) {
      addToast('Evalúa los cuatro niveles antes de guardar', 'warning');
      return;
    }

    const payload: Partial<Tables['sesiones_fono']> = {
      ...(sesionEnEdicion ? { id: sesionEnEdicion.id } : {}),
      fecha: fechaSesion,
      estudiante_id: parseInt(idAlumnoSeleccionado, 10),
      fonoaudiologo_id: user.id,
      actividad_realizada: descripcionActividad.trim(),
      observaciones: notasAdicionales.trim() || null,
      nivel_fonetico: nivelesLogrados.fonetico,
      nivel_semantico: nivelesLogrados.semantico,
      nivel_morfosintactico: nivelesLogrados.morfosintactico,
      nivel_pragmatico: nivelesLogrados.pragmatico,
      sede_id: sede.id,
    };

    saveMutation.mutate(payload);
  };

  const estaCargando = cargandoEstudiantes || cargandoSesiones;

  if (estaCargando) {
    return (
      <div className="page-container">
        <div className="skeleton" style={{ height: 400 }} />
      </div>
    );
  }

  const sesionesMes = historialSesiones.filter(s => new Date(`${s.fecha}T12:00:00`).getMonth() === mesSeleccionado);
  const totalIntervenciones = sesionesMes.length;
  const estudiantesAtendidos = new Set(sesionesMes.map(s => s.estudiante_id)).size;

  return (
    <div className="page-container animate-in">
      <header className="page-header" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="page-title">Fonoaudiología</h1>
          <p className="page-subtitle">Seguimiento clínico y avance fonoaudiológico en {sede.nombre}</p>
        </div>
        {can(PERMISSIONS.RECORD_SESSIONS) && (
          <button className="btn btn-gold" onClick={() => setMostrarFormulario(true)}>
            <Plus size={18} /> Nueva Sesión
          </button>
        )}
      </header>

      {/* KPI Cards */}
      <section className="grid grid-2" style={{ marginBottom: '32px' }}>
        <article className="card stat-card">
          <div className="stat-header">
            <span className="stat-label">Intervenciones ({getMonthName(mesSeleccionado)})</span>
            <div className="stat-icon" style={{ background: 'rgba(212, 168, 67, 0.15)', color: 'var(--color-gold)' }}>
              <Calendar size={20} />
            </div>
          </div>
          <div className="stat-value">{totalIntervenciones}</div>
          <div className="stat-footer">
            <span className="stat-desc">Sesiones individuales registradas este mes</span>
          </div>
        </article>

        <article className="card stat-card">
          <div className="stat-header">
            <span className="stat-label">Alumnos Atendidos</span>
            <div className="stat-icon" style={{ background: 'rgba(27, 42, 74, 0.1)', color: 'var(--color-navy)' }}>
              <Activity size={20} />
            </div>
          </div>
          <div className="stat-value">{estudiantesAtendidos}</div>
          <div className="stat-footer">
            <span className="stat-desc">Cobertura sobre la matrícula activa</span>
          </div>
        </article>
      </section>

      {/* Historial de Sesiones */}
      <section className="card">
        <div className="card-header" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Registro de Intervenciones Clínicas</h3>
            <p className="text-muted" style={{ fontSize: '13px' }}>Últimas sesiones fonoaudiológicas registradas</p>
          </div>
          <select 
            className="form-control" 
            style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }}
            value={mesSeleccionado}
            onChange={e => setMesSeleccionado(parseInt(e.target.value, 10))}
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i} value={i}>{getMonthName(i)}</option>
            ))}
          </select>
        </div>
        
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Estudiante</th>
                <th>Niveles Evaluados</th>
                <th>Actividad Realizada</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sesionesMes.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No hay sesiones registradas en {getMonthName(mesSeleccionado)}.
                  </td>
                </tr>
              ) : (
                sesionesMes.map(s => {
                  const est = s.estudiante;
                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600, fontSize: '13px' }}>{s.fecha}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{est ? `${est.nombre} ${est.apellidoPaterno}` : 'Alumno no asignado'}</div>
                        <div className="text-muted" style={{ fontSize: '11px' }}>{est?.nivel || ''}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <span title="Fonético" className={`badge ${s.nivel_fonetico === 3 ? 'badge-success' : s.nivel_fonetico === 2 ? 'badge-warning' : 'badge-danger'}`}>F:{s.nivel_fonetico}</span>
                          <span title="Semántico" className={`badge ${s.nivel_semantico === 3 ? 'badge-success' : s.nivel_semantico === 2 ? 'badge-warning' : 'badge-danger'}`}>S:{s.nivel_semantico}</span>
                          <span title="Morfosintáctico" className={`badge ${s.nivel_morfosintactico === 3 ? 'badge-success' : s.nivel_morfosintactico === 2 ? 'badge-warning' : 'badge-danger'}`}>M:{s.nivel_morfosintactico}</span>
                          <span title="Pragmático" className={`badge ${s.nivel_pragmatico === 3 ? 'badge-success' : s.nivel_pragmatico === 2 ? 'badge-warning' : 'badge-danger'}`}>P:{s.nivel_pragmatico}</span>
                        </div>
                      </td>
                      <td style={{ maxWidth: '300px', fontSize: '13px' }}>
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {s.actividad_realizada}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          {est && (
                            <button 
                              className="btn btn-ghost btn-sm" 
                              title="Ver Evolución"
                              onClick={() => setAlumnoParaEvolucion(est)}
                            >
                              <TrendingUp size={16} />
                            </button>
                          )}
                          {can(PERMISSIONS.RECORD_SESSIONS) && (
                            <button 
                              className="btn btn-ghost btn-sm" 
                              title="Editar Sesión"
                              onClick={() => editarSesion(s)}
                            >
                              <Edit size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal Formulario Nueva/Editar Sesión */}
      <Modal
        isOpen={mostrarFormulario}
        onClose={limpiarForm}
        title={sesionEnEdicion ? 'Editar Intervención Fonoaudiológica' : 'Nueva Intervención Fonoaudiológica'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="grid grid-2">
            <div className="form-group">
              <label className="form-label">Fecha de Intervención</label>
              <input 
                type="date" 
                className="form-control" 
                value={fechaSesion} 
                max={getToday()}
                onChange={e => setFechaSesion(e.target.value)} 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Estudiante</label>
              <select 
                className="form-control" 
                value={idAlumnoSeleccionado}
                onChange={e => setIdAlumnoSeleccionado(e.target.value)}
                disabled={!!sesionEnEdicion}
              >
                <option value="">Selecciona un estudiante...</option>
                {listadoEstudiantes.map(e => (
                  <option key={e.id} value={e.id}>{e.nombre} {e.apellidoPaterno} ({e.nivel})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Evaluación de Niveles del Lenguaje</label>
            <div className="grid grid-2" style={{ gap: '12px' }}>
              {NIVELES_EVALUACION.map(n => (
                <div key={n.id} style={{ background: 'var(--color-gray-50)', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>{n.label}</div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {ESCALA_EVALUACION.map(esc => (
                      <button
                        key={esc.valor}
                        type="button"
                        style={{
                          flex: 1, padding: '6px 4px', fontSize: '11px', fontWeight: 600, borderRadius: '6px',
                          border: `1px solid ${nivelesLogrados[n.id] === esc.valor ? esc.color : 'var(--color-gray-200)'}`,
                          background: nivelesLogrados[n.id] === esc.valor ? esc.color : 'white',
                          color: nivelesLogrados[n.id] === esc.valor ? 'white' : 'var(--text-primary)',
                          cursor: 'pointer'
                        }}
                        onClick={() => setNivelesLogrados(prev => ({ ...prev, [n.id]: esc.valor }))}
                      >
                        {esc.etiqueta}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Actividad Realizada</label>
            <textarea 
              className="form-control" 
              rows={3} 
              placeholder="Describe el trabajo fonético/fonológico o semántico ejecutado..."
              value={descripcionActividad}
              onChange={e => setDescripcionActividad(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Observaciones Adicionales (Opcional)</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Conducta, atención, recomendaciones al docente..."
              value={notasAdicionales}
              onChange={e => setNotasAdicionales(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button className="btn btn-outline" onClick={limpiarForm}>Cancelar</button>
            <button className="btn btn-gold" onClick={guardarSesion} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Guardando...' : 'Guardar Sesión'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Gráfico de Evolución del Alumno */}
      <Modal
        isOpen={!!alumnoParaEvolucion}
        onClose={() => setAlumnoParaEvolucion(null)}
        title={alumnoParaEvolucion ? `Evolución Fonoaudiológica: ${alumnoParaEvolucion.nombre} ${alumnoParaEvolucion.apellidoPaterno}` : ''}
      >
        {alumnoParaEvolucion && (
          <Suspense fallback={<div className="skeleton" style={{ height: 350 }} />}>
            <FonoEvolutionChart 
              data={historialSesiones.filter(s => s.estudiante_id === alumnoParaEvolucion.id)} 
            />
          </Suspense>
        )}
      </Modal>
    </div>
  );
}
