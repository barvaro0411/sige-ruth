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
import { Plus, Calendar, TrendingUp, Edit, Activity, Sparkles, Search, User } from 'lucide-react';
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

const PRESET_ACTIVIDADES = [
  'Discriminación auditiva fonemas',
  'Conciencia fonológica silábica',
  'Estructuración sintáctica (S-V-O)',
  'Vocabulario y campos semánticos',
  'Praxias bucofonatorias y articulación',
  'Uso pragmático y toma de turnos',
  'Comprensión de narraciones orales',
  'Memoria auditiva secuencial',
];

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
  const [filtroAlumnoId, setFiltroAlumnoId] = useState('');
  const [busquedaTexto, setBusquedaTexto] = useState('');

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

  const agregarPreset = (preset: string) => {
    setDescripcionActividad(prev => {
      const limpia = prev.trim();
      if (!limpia) return preset;
      if (limpia.includes(preset)) return limpia;
      return `${limpia}, ${preset}`;
    });
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

  // Filtrado de sesiones
  const sesionesFiltradas = historialSesiones.filter(s => {
    const cumpleMes = mesSeleccionado === -1 || new Date(`${s.fecha}T12:00:00`).getMonth() === mesSeleccionado;
    const cumpleAlumno = !filtroAlumnoId || s.estudiante_id.toString() === filtroAlumnoId;
    const est = s.estudiante;
    const nombreCompleto = est ? `${est.nombre} ${est.apellidoPaterno} ${est.apellidoMaterno || ''}`.toLowerCase() : '';
    const cumpleBusqueda = !busquedaTexto || 
      nombreCompleto.includes(busquedaTexto.toLowerCase()) || 
      s.actividad_realizada.toLowerCase().includes(busquedaTexto.toLowerCase());

    return cumpleMes && cumpleAlumno && cumpleBusqueda;
  });

  const sesionesMesActual = historialSesiones.filter(s => new Date(`${s.fecha}T12:00:00`).getMonth() === new Date().getMonth());
  const totalIntervenciones = sesionesMesActual.length;
  const estudiantesAtendidos = new Set(sesionesMesActual.map(s => s.estudiante_id)).size;

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
            <span className="stat-label">Intervenciones ({getMonthName(new Date().getMonth())})</span>
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
            <span className="stat-label">Alumnos Atendidos este Mes</span>
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
        <div className="card-header" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--navy-900)' }}>Registro de Intervenciones Clínicas</h3>
              <p className="text-muted" style={{ fontSize: '13px' }}>Historial clínico de sesiones y avance por estudiante</p>
            </div>
          </div>

          {/* Barra de Filtros Rápidos */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Buscador de Alumno o Actividad */}
            <div className="search-container" style={{ flex: '1 1 220px' }}>
              <Search size={16} className="search-icon" />
              <input
                className="search-input"
                placeholder="Buscar por estudiante o actividad…"
                value={busquedaTexto}
                onChange={e => setBusquedaTexto(e.target.value)}
              />
            </div>

            {/* Selector de Alumno */}
            <select 
              className="form-select"
              style={{ flex: '0 1 200px' }}
              value={filtroAlumnoId}
              onChange={e => setFiltroAlumnoId(e.target.value)}
              aria-label="Filtrar por estudiante"
            >
              <option value="">Todos los estudiantes</option>
              {listadoEstudiantes.map(e => (
                <option key={e.id} value={e.id}>{e.nombre} {e.apellidoPaterno}</option>
              ))}
            </select>

            {/* Selector de Mes */}
            <select 
              className="form-select" 
              style={{ flex: '0 1 170px' }}
              value={mesSeleccionado}
              onChange={e => setMesSeleccionado(parseInt(e.target.value, 10))}
              aria-label="Filtrar por mes"
            >
              <option value={-1}>Todo el año</option>
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i} value={i}>{getMonthName(i)}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '110px' }}>Fecha</th>
                <th>Estudiante</th>
                <th>Niveles Evaluados</th>
                <th>Actividad Realizada</th>
                <th style={{ textAlign: 'right', minWidth: '130px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sesionesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No se encontraron sesiones con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                sesionesFiltradas.map(s => {
                  const est = s.estudiante;
                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 700, fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>{s.fecha}</td>
                      <td>
                        <div style={{ fontWeight: 800, color: 'var(--navy-900)' }}>{est ? `${est.nombre} ${est.apellidoPaterno}` : 'Alumno no asignado'}</div>
                        <div className="text-muted" style={{ fontSize: '11.5px', fontWeight: 600 }}>{est?.nivel || ''}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          <span title="Fonético" className={`badge ${s.nivel_fonetico === 3 ? 'badge-success' : s.nivel_fonetico === 2 ? 'badge-warning' : 'badge-danger'}`}>F: {s.nivel_fonetico}</span>
                          <span title="Semántico" className={`badge ${s.nivel_semantico === 3 ? 'badge-success' : s.nivel_semantico === 2 ? 'badge-warning' : 'badge-danger'}`}>S: {s.nivel_semantico}</span>
                          <span title="Morfosintáctico" className={`badge ${s.nivel_morfosintactico === 3 ? 'badge-success' : s.nivel_morfosintactico === 2 ? 'badge-warning' : 'badge-danger'}`}>M: {s.nivel_morfosintactico}</span>
                          <span title="Pragmático" className={`badge ${s.nivel_pragmatico === 3 ? 'badge-success' : s.nivel_pragmatico === 2 ? 'badge-warning' : 'badge-danger'}`}>P: {s.nivel_pragmatico}</span>
                        </div>
                      </td>
                      <td style={{ maxWidth: '320px', fontSize: '13px' }}>
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
                          {s.actividad_realizada}
                        </div>
                        {s.observaciones && (
                          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.observaciones}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                          {est && (
                            <button 
                              type="button"
                              className="btn btn-ghost btn-sm" 
                              title="Ver Evolución Gráfica"
                              onClick={() => setAlumnoParaEvolucion(est)}
                            >
                              <TrendingUp size={16} /> <span style={{ fontSize: '12px' }}>Evolución</span>
                            </button>
                          )}
                          {can(PERMISSIONS.RECORD_SESSIONS) && (
                            <button 
                              type="button"
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
        size="lg"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="grid grid-2" style={{ gap: '14px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="fono-fecha">Fecha de Intervención</label>
              <input 
                id="fono-fecha"
                type="date" 
                className="form-input" 
                value={fechaSesion} 
                max={getToday()}
                onChange={e => setFechaSesion(e.target.value)} 
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="fono-estudiante">Estudiante *</label>
              <select 
                id="fono-estudiante"
                className="form-select" 
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
            <label className="form-label">Evaluación de Niveles del Lenguaje *</label>
            <div className="grid grid-2" style={{ gap: '12px' }}>
              {NIVELES_EVALUACION.map(n => (
                <div key={n.id} style={{ background: 'var(--bg-main)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '8px', color: 'var(--navy-900)' }}>{n.label}</div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {ESCALA_EVALUACION.map(esc => (
                      <button
                        key={esc.valor}
                        type="button"
                        style={{
                          flex: 1, padding: '6px 4px', fontSize: '11.5px', fontWeight: 700, borderRadius: '8px',
                          border: `1.5px solid ${nivelesLogrados[n.id] === esc.valor ? esc.color : 'var(--border-medium)'}`,
                          background: nivelesLogrados[n.id] === esc.valor ? esc.color : 'white',
                          color: nivelesLogrados[n.id] === esc.valor ? 'white' : 'var(--text-primary)',
                          cursor: 'pointer',
                          transition: 'all var(--transition-fast)'
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

          {/* Actividad Realizada + Chips de Autocompletado */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" htmlFor="fono-actividad" style={{ margin: 0 }}>Actividad Realizada *</label>
              <span style={{ fontSize: '11.5px', color: 'var(--gold-700)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Sparkles size={13} /> Plantillas rápidas
              </span>
            </div>

            {/* Chips de Actividades Frecuentes */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {PRESET_ACTIVIDADES.map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => agregarPreset(preset)}
                  style={{
                    fontSize: '11.5px', fontWeight: 600, padding: '4px 9px', borderRadius: '14px',
                    background: descripcionActividad.includes(preset) ? 'var(--gold-100)' : 'var(--bg-main)',
                    color: descripcionActividad.includes(preset) ? 'var(--gold-800)' : 'var(--navy-700)',
                    border: `1px solid ${descripcionActividad.includes(preset) ? 'var(--gold-400)' : 'var(--border-medium)'}`,
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                  title="Clic para agregar a la actividad"
                >
                  + {preset}
                </button>
              ))}
            </div>

            <textarea 
              id="fono-actividad"
              className="form-textarea" 
              rows={3} 
              placeholder="Describe el trabajo fonético, fonológico o semántico ejecutado…"
              value={descripcionActividad}
              onChange={e => setDescripcionActividad(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="fono-notas">Observaciones Adicionales (Opcional)</label>
            <input 
              id="fono-notas"
              type="text" 
              className="form-input" 
              placeholder="Conducta, nivel de fatiga, recomendaciones al docente o apoderado…"
              value={notasAdicionales}
              onChange={e => setNotasAdicionales(e.target.value)}
            />
          </div>

          <div className="modal-footer-sticky" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" className="btn btn-outline" onClick={limpiarForm}>
              Cancelar
            </button>
            <button type="button" className="btn btn-gold" onClick={guardarSesion} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Guardando…' : 'Guardar Sesión'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Gráfico de Evolución del Alumno */}
      <Modal
        isOpen={!!alumnoParaEvolucion}
        onClose={() => setAlumnoParaEvolucion(null)}
        title={alumnoParaEvolucion ? `Evolución Fonoaudiológica: ${alumnoParaEvolucion.nombre} ${alumnoParaEvolucion.apellidoPaterno}` : ''}
        size="lg"
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

