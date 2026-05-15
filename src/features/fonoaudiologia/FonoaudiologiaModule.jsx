import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { EstudianteService } from '../../services/estudianteService';
import { FonoService } from '../../services/fonoService';
import { getToday, getMonthName } from '../../utils/dates';
import { useSede } from '../../config/SedeContext';
import { useToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import { buildIdMap } from '../../utils/mappers';
import { 
    Plus, Calendar, TrendingUp, Edit, ChevronRight, Activity 
} from 'lucide-react';
import FonoEvolutionChart from './FonoEvolutionChart';

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
];

export default function FonoaudiologiaModule() {
  const { user } = useAuth();
  const { sede } = useSede();
  const { addToast } = useToast();
  
  const [estaCargando, setEstaCargando] = useState(true);
  const [listadoEstudiantes, setListadoEstudiantes] = useState([]);
  const [historialSesiones, setHistorialSesiones] = useState([]);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [alumnoParaEvolucion, setAlumnoParaEvolucion] = useState(null);
  const [mesSeleccionado, setMesSeleccionado] = useState(new Date().getMonth());

  // Form State
  const [sesionEnEdicion, setSesionEnEdicion] = useState(null);
  const [fechaSesion, setFechaSesion] = useState(getToday());
  const [idAlumnoSeleccionado, setIdAlumnoSeleccionado] = useState('');
  const [descripcionActividad, setDescripcionActividad] = useState('');
  const [notasAdicionales, setNotasAdicionales] = useState('');
  const [nivelesLogrados, setNivelesLogrados] = useState({ fonetico: 0, semantico: 0, morfosintactico: 0, pragmatico: 0 });

  useEffect(() => { cargarDatosIniciales(); }, [sede.id]);

  async function cargarDatosIniciales() {
    setEstaCargando(true);
    try {
      const [alumnos, sesiones] = await Promise.all([
        EstudianteService.getAllBySede(sede.id),
        FonoService.getSesionesBySede(sede.id)
      ]);
      
      setListadoEstudiantes(alumnos);
      const mapa = buildIdMap(alumnos);
      setHistorialSesiones(sesiones.map(s => ({ ...s, estudiante: mapa[s.estudiante_id] })));
    } catch (err) {
      addToast('Error al cargar datos', 'danger');
    } finally { setEstaCargando(false); }
  }

  const limpiarForm = () => {
    setMostrarFormulario(false); setSesionEnEdicion(null); setFechaSesion(getToday());
    setIdAlumnoSeleccionado(''); setDescripcionActividad(''); setNotasAdicionales('');
    setNivelesLogrados({ fonetico: 0, semantico: 0, morfosintactico: 0, pragmatico: 0 });
  };

  const editarSesion = (s) => {
    setSesionEnEdicion(s); setFechaSesion(s.fecha); setIdAlumnoSeleccionado(s.estudiante_id.toString());
    setDescripcionActividad(s.actividad_realizada); setNotasAdicionales(s.observaciones || '');
    setNivelesLogrados({ fonetico: s.nivel_fonetico, semantico: s.nivel_semantico, morfosintactico: s.nivel_morfosintactico, pragmatico: s.nivel_pragmatico });
    setMostrarFormulario(true);
  };

  const guardarSesion = async () => {
    if (!user) return;
    
    const payload = {
      id: sesionEnEdicion?.id,
      fecha: fechaSesion, 
      estudiante_id: parseInt(idAlumnoSeleccionado),
      fonoaudiologo_id: user.id, 
      actividad_realizada: descripcionActividad.trim(),
      observaciones: notasAdicionales.trim(), 
      nivel_fonetico: nivelesLogrados.fonetico,
      nivel_semantico: nivelesLogrados.semantico, 
      nivel_morfosintactico: nivelesLogrados.morfosintactico,
      nivel_pragmatico: nivelesLogrados.pragmatico, 
      sede_id: sede.id
    };

    try {
      await FonoService.saveSesion(payload, user.id, sede.id);
      addToast('Sesión guardada', 'success'); 
      limpiarForm(); 
      cargarDatosIniciales();
    } catch (e) { 
      addToast(e.message, 'danger'); 
    }
  };

  const sesionesFiltradas = historialSesiones.filter(s => new Date(s.fecha).getMonth() === mesSeleccionado);
  const sesionesAlumnoEvolucion = historialSesiones.filter(s => s.estudiante_id === alumnoParaEvolucion?.id);

  if (estaCargando) return <div className="page-container"><div className="skeleton" style={{ height: 400 }} /></div>;

  return (
    <div className="page-container">
      <header className="page-header" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="page-title">Fonoaudiología</h1>
          <p className="page-subtitle">Planificación Clínica e Intervención del Lenguaje</p>
        </div>
        <button className="btn btn-gold" onClick={() => setMostrarFormulario(true)}>
          <Plus size={18} /> Nueva Intervención
        </button>
      </header>

      {/* Meses Selector */}
      <nav className="tabs" style={{ marginBottom: '32px', background: 'white', padding: '8px', borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }}>
        {[2,3,4,5,6,7,8,9,10,11].map(m => (
          <button key={m} className={`tab ${mesSeleccionado === m ? 'active' : ''}`} onClick={() => setMesSeleccionado(m)} style={{ borderRadius: '10px' }}>
            {getMonthName(m).slice(0,3)}
          </button>
        ))}
      </nav>

      <div className="grid" style={{ gridTemplateColumns: '1fr 320px', gap: '32px', alignItems: 'start' }}>
        {/* Main List */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {sesionesFiltradas.length > 0 ? sesionesFiltradas.map(s => (
            <article key={s.id} className="card" style={{ borderLeft: '4px solid var(--color-gold)' }}>
              <div className="card-body" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '20px' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-navy)' }}>{s.estudiante?.nombre} {s.estudiante?.apellidoPaterno}</h3>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                        <Calendar size={14} /> {new Date(s.fecha).toLocaleDateString('es-CL', { timeZone: 'UTC' })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setAlumnoParaEvolucion(s.estudiante)} style={{ color: 'var(--color-gold)' }}><TrendingUp size={16} /></button>
                    <button className="btn btn-ghost btn-sm" onClick={() => editarSesion(s)}><Edit size={16} /></button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
                  {NIVELES_EVALUACION.map(n => (
                    <div key={n.id} style={{ background: 'var(--bg-primary)', padding: '10px', borderRadius: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{n.label.split(' ')[1]}</div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: ESCALA_EVALUACION[(s[`nivel_${n.id}`] || 1) - 1]?.color }}>{s[`nivel_${n.id}`] || 0}/3</div>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                  <span style={{ fontWeight: 800, color: 'var(--color-navy)' }}>Actividad:</span> {s.actividad_realizada}
                </div>
              </div>
            </article>
          )) : (
            <div className="card" style={{ padding: '64px', textAlign: 'center' }}>
                <Activity size={48} color="var(--color-gray-200)" style={{ margin: '0 auto 16px' }} />
                <h3 style={{ color: 'var(--text-muted)' }}>Sin intervenciones este mes</h3>
            </div>
          )}
        </section>

        {/* Aside: Alumnos */}
        <aside className="card" style={{ position: 'sticky', top: '100px' }}>
            <header className="card-header"><h3 className="card-title">Pacientes Activos</h3></header>
            <div className="card-body" style={{ padding: '8px' }}>
                {listadoEstudiantes.map(e => (
                    <button key={e.id} onClick={() => setAlumnoParaEvolucion(e)} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--color-navy)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>{e.nombre[0]}</div>
                            <span style={{ fontSize: '13px', fontWeight: 600 }}>{e.nombre} {e.apellidoPaterno}</span>
                        </div>
                        <ChevronRight size={14} color="var(--text-muted)" />
                    </button>
                ))}
            </div>
        </aside>
      </div>

      {/* Modal Formulario */}
      <Modal 
        isOpen={mostrarFormulario} onClose={limpiarForm} title={sesionEnEdicion ? 'Actualizar Sesión' : 'Nueva Sesión Clínica'} size="lg"
        footer={<><button className="btn btn-outline" onClick={limpiarForm}>Cerrar</button><button className="btn btn-gold" onClick={guardarSesion}>Guardar Intervención</button></>}
      >
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group"><label className="form-label">Fecha</label><input type="date" className="form-input" value={fechaSesion} onChange={e => setFechaSesion(e.target.value)} /></div>
            <div className="form-group">
                <label className="form-label">Estudiante</label>
                <select className="form-select" value={idAlumnoSeleccionado} onChange={e => setIdAlumnoSeleccionado(e.target.value)}>
                    <option value="">Seleccione alumno...</option>
                    {listadoEstudiantes.map(e => <option key={e.id} value={e.id}>{e.nombre} {e.apellidoPaterno}</option>)}
                </select>
            </div>
            <div className="form-group"><label className="form-label">Actividad</label><textarea className="form-textarea" rows={4} value={descripcionActividad} onChange={e => setDescripcionActividad(e.target.value)} /></div>
          </div>
          <div style={{ background: 'var(--bg-primary)', padding: '20px', borderRadius: '16px' }}>
            <h4 style={{ marginBottom: '16px', fontSize: '14px', fontWeight: 800 }}>Evaluación de Niveles</h4>
            {NIVELES_EVALUACION.map(n => (
                <div key={n.id} style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}>{n.label}</div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {[1,2,3].map(v => (
                            <button key={v} onClick={() => setNivelesLogrados({...nivelesLogrados, [n.id]: v})} style={{ 
                                flex: 1, padding: '8px', borderRadius: '8px', border: 'none', fontSize: '11px', fontWeight: 800, cursor: 'pointer',
                                background: nivelesLogrados[n.id] === v ? ESCALA_EVALUACION[v-1].color : 'white',
                                color: nivelesLogrados[n.id] === v ? 'white' : 'var(--text-secondary)'
                            }}>{v}</button>
                        ))}
                    </div>
                </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Modal Evolución */}
      {alumnoParaEvolucion && (
        <Modal isOpen={!!alumnoParaEvolucion} onClose={() => setAlumnoParaEvolucion(null)} title={`Evolución: ${alumnoParaEvolucion.nombre} ${alumnoParaEvolucion.apellidoPaterno}`} size="xl">
            <FonoEvolutionChart data={sesionesAlumnoEvolucion} />
        </Modal>
      )}
    </div>
  );
}
