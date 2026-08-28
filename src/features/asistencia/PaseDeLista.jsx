import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { EstudianteService } from '../../services/estudianteService';
import { AsistenciaService } from '../../services/asistenciaService';
import { DocumentoService } from '../../services/documentoService';
import { getToday, getTodayLabel } from '../../utils/dates';
import { useSede } from '../../config/SedeContext';
import { PERMISSIONS } from '../../auth/permissions';
import { ESTADOS_ASISTENCIA } from '../../config/constants';
import { useToast } from '../../components/Toast';
import { supabase } from '../../db/database';
import Modal from '../../components/Modal';
import {
  Send, Lock, UserCheck, UserX, HelpCircle, CheckCircle, Upload, Filter
} from 'lucide-react';

export default function PaseDeLista() {
  const { user, can } = useAuth();
  const { sede } = useSede();
  const { addToast } = useToast();
  const fileInputRef = useRef(null);
  
  const [estudiantes, setEstudiantes] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [asistencia, setAsistencia] = useState({});
  const [observaciones, setObservaciones] = useState({});
  const [filterCurso, setFilterCurso] = useState('');
  const [cerrada, setCerrada] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [showJustModal, setShowJustModal] = useState(null);
  const [justText, setJustText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showConfirmCerrar, setShowConfirmCerrar] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const today = getToday();

  useEffect(() => { loadData(); }, [sede.id]);

  async function loadData() {
    setLoading(true);
    try {
      const [alumnos, registros, cursosDb] = await Promise.all([
        EstudianteService.getAllBySede(sede.id),
        AsistenciaService.getByFecha(today, sede.id),
        supabase.from('cursos').select('*').eq('sede_id', sede.id)
      ]);
      
      setEstudiantes(alumnos);
      setCursos(cursosDb.data || []);
      
      const attMap = {}; const obsMap = {}; let isClosed = false;
      registros.forEach(r => {
        attMap[r.estudiante_id] = r.estado;
        if (r.observacion) obsMap[r.estudiante_id] = r.observacion;
        if (r.cerrada) isClosed = true;
      });
      setAsistencia(attMap); setObservaciones(obsMap); setCerrada(isClosed);
    } catch (err) { 
      console.error(err);
      addToast('Error al cargar datos', 'danger'); 
    } finally { setLoading(false); }
  }

  const filtered = useMemo(() => {
    return estudiantes.filter(e => !filterCurso || e.curso_id === filterCurso)
      .sort((a, b) => a.apellidoPaterno.localeCompare(b.apellidoPaterno));
  }, [estudiantes, filterCurso]);

  const stats = useMemo(() => {
    const filteredStates = filtered.map(e => asistencia[e.id]);
    const p = filteredStates.filter(v => v === ESTADOS_ASISTENCIA.PRESENTE).length;
    const a = filteredStates.filter(v => v === ESTADOS_ASISTENCIA.AUSENTE).length;
    const j = filteredStates.filter(v => v === ESTADOS_ASISTENCIA.JUSTIFICADO).length;
    const totalFiltered = filtered.length;
    const markedCount = filtered.filter(e => asistencia[e.id]).length;
    const missing = totalFiltered - markedCount;
    const totalMissing = estudiantes.filter(e => !asistencia[e.id]).length;
    return { p, a, j, missing, totalMissing };
  }, [filtered, estudiantes, asistencia]);

  const puedeEditar = can(PERMISSIONS.RECORD_ATTENDANCE)
    && (!cerrada || can(PERMISSIONS.MODIFY_CLOSED_ATTENDANCE));

  // Completa como presentes solo a los que siguen sin marcar: asi da igual el
  // orden de trabajo (marcar las ausencias primero y rellenar despues, o
  // rellenar y corregir). Nunca pisa una marca hecha a mano.
  function marcarPendientesPresentes() {
    if (!puedeEditar) {
      addToast(cerrada ? 'Jornada Cerrada' : 'Tu perfil tiene acceso de solo lectura', 'warning');
      return;
    }
    const pendientes = filtered.filter(e => !asistencia[e.id]);
    if (pendientes.length === 0) return;
    setAsistencia(prev => {
      const next = { ...prev };
      pendientes.forEach(e => { next[e.id] = ESTADOS_ASISTENCIA.PRESENTE; });
      return next;
    });
    addToast(`${pendientes.length} marcados como presentes`, 'success');
  }

  function handleMark(id, estado) {
    if (!can(PERMISSIONS.RECORD_ATTENDANCE)) {
      addToast('Tu perfil tiene acceso de solo lectura', 'warning'); return;
    }
    if (cerrada && !can(PERMISSIONS.MODIFY_CLOSED_ATTENDANCE)) {
      addToast('Jornada Cerrada', 'warning'); return;
    }
    if (asistencia[id] === estado) {
        setAsistencia(prev => { const n = {...prev}; delete n[id]; return n; }); return;
    }
    setAsistencia(prev => ({ ...prev, [id]: estado }));
    if (estado === ESTADOS_ASISTENCIA.JUSTIFICADO) { setShowJustModal(id); setJustText(observaciones[id] || ''); }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !showJustModal) return;

    if (file.size > 5 * 1024 * 1024) {
      addToast('El archivo supera el máximo de 5 MB', 'warning');
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      await DocumentoService.upload(file, showJustModal, sede.id);
      addToast('Respaldo subido correctamente', 'success');
      if (!justText) {
        setJustText(`Licencia/Respaldo: ${file.name}`);
      }
    } catch (err) {
      console.error(err);
      addToast('Error al subir documento', 'danger');
    } finally {
      setIsUploading(false);
    }
  }

  async function guardarJornada(esCierreInicial = true) {
    if (!user || !can(PERMISSIONS.RECORD_ATTENDANCE) || saving) return;
    if (estudiantes.length === 0) {
      addToast('No hay estudiantes activos para registrar', 'warning'); return;
    }
    if (stats.totalMissing > 0) {
      addToast(`Faltan ${stats.totalMissing} estudiantes por marcar`, 'warning'); return;
    }
    const justificacionIncompleta = estudiantes.some(e =>
      asistencia[e.id] === ESTADOS_ASISTENCIA.JUSTIFICADO
      && !observaciones[e.id]?.trim()
    );
    if (justificacionIncompleta) {
      addToast('Toda ausencia justificada debe incluir un motivo', 'warning'); return;
    }

    try {
      setSaving(true);
      const records = estudiantes.map(e => ({
        estudiante_id: e.id, fecha: today, estado: asistencia[e.id],
        observacion: observaciones[e.id] || '', registrado_por: user.id, cerrada: true, sede_id: sede.id,
      }));
      await AsistenciaService.salvarJornada(records);
      setCerrada(true);
      setShowConfirmCerrar(false);
      addToast(esCierreInicial ? 'Libro cerrado correctamente' : 'Cambios guardados', 'success');
    } catch (err) {
      addToast(err?.message || 'No se pudo guardar la asistencia', 'danger');
    } finally { setSaving(false); }
  }

  if (loading) return <div className="page-container"><div className="skeleton" style={{ height: 400 }} /></div>;

  return (
    <div className="page-container animate-in">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
        <div>
          <h1 className="page-title">Pase de Lista</h1>
          <p className="page-subtitle">{getTodayLabel()} · Registro Diario</p>
        </div>
        {!can(PERMISSIONS.RECORD_ATTENDANCE) ? (
          <div className="badge" style={{ background: 'var(--bg-main)', color: 'var(--navy-600)', padding: '12px 24px' }}>
            Solo lectura
          </div>
        ) : !cerrada ? (
          <button className="btn btn-gold" onClick={() => setShowConfirmCerrar(true)} disabled={stats.totalMissing > 0 || estudiantes.length === 0 || saving}>
            <Send size={18} /> {saving ? 'Guardando...' : 'Cerrar Jornada'}
          </button>
        ) : can(PERMISSIONS.MODIFY_CLOSED_ATTENDANCE) ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="badge" style={{ background: 'var(--navy-900)', color: 'white', padding: '12px 18px' }}>
              <Lock size={16} style={{ marginRight: 8 }} /> Jornada Finalizada
            </div>
            <button className="btn btn-gold" onClick={() => guardarJornada(false)} disabled={stats.totalMissing > 0 || saving}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        ) : (
          <div className="badge" style={{ background: 'var(--navy-900)', color: 'white', padding: '12px 24px' }}>
            <Lock size={16} style={{ marginRight: 8 }} /> Jornada Finalizada
          </div>
        )}
      </header>

      {/* Selector de Cursos */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px', overflowX: 'auto', paddingBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--navy-600)', fontWeight: 700, fontSize: '13px', marginRight: '8px' }}>
            <Filter size={16} /> FILTRAR:
          </div>
          <button className={`btn ${!filterCurso ? 'btn-gold' : 'btn-outline'}`} onClick={() => setFilterCurso('')}>Todos los Alumnos</button>
          {cursos.map(c => (
              <button key={c.id} className={`btn ${filterCurso === c.id ? 'btn-gold' : 'btn-outline'}`} onClick={() => setFilterCurso(c.id)}>
                {c.nombre}
              </button>
          ))}
      </div>

      {/* Resumen Visual del Filtro Actual */}
      <section className="grid grid-4" style={{ marginBottom: '40px' }}>
        {[
          { label: 'Presentes', val: stats.p, color: 'var(--color-success)', bg: 'var(--color-success-soft)' },
          { label: 'Ausentes', val: stats.a, color: 'var(--color-danger)', bg: 'var(--color-danger-soft)' },
          { label: 'Justificados', val: stats.j, color: 'var(--gold-600)', bg: 'var(--gold-50)' },
          { label: 'Pendientes', val: stats.missing, color: 'var(--navy-600)', bg: 'var(--bg-main)' }
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '20px', textAlign: 'center', borderBottom: `4px solid ${s.color}` }}>
            <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--navy-600)', textTransform: 'uppercase', marginBottom: '4px' }}>{s.label}</div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </section>

      {/* Accion rapida: el registro nunca se autocompleta solo, lo dispara el usuario */}
      {puedeEditar && stats.missing > 0 && (
        <div className="card" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '16px', flexWrap: 'wrap', padding: '16px 20px', marginBottom: '24px'
        }}>
          <div style={{ fontSize: '13px', color: 'var(--navy-600)', fontWeight: 600 }}>
            Marca primero las ausencias y completa el resto de un clic.
          </div>
          <button className="btn btn-outline" onClick={marcarPendientesPresentes}>
            <UserCheck size={18} /> Marcar presentes a los {stats.missing} pendientes
          </button>
        </div>
      )}

      {/* Grid Alumnos Asistencia */}
      <div className="grid grid-3">
          {filtered.map(est => {
              const st = asistencia[est.id];
              const isMarked = !!st;
              
              return (
                  <article key={est.id} className="card" style={{ 
                    padding: '20px', 
                    border: isMarked ? `2px solid ${st === 'P' ? 'var(--color-success)' : st === 'A' ? 'var(--color-danger)' : 'var(--gold-500)'}` : '1px solid var(--border-medium)',
                    background: isMarked ? (st === 'P' ? 'var(--color-success-soft)' : st === 'A' ? 'var(--color-danger-soft)' : 'var(--gold-50)') : 'white'
                  }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--navy-900)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '18px' }}>
                          {est.nombre[0]}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--navy-900)' }}>{est.apellidoPaterno}, {est.nombre}</div>
                          <div style={{ fontSize: '12px', color: 'var(--navy-600)', fontWeight: 600 }}>
                            {cursos.find(c => c.id === est.curso_id)?.nombre || est.nivel}
                          </div>
                        </div>
                        {isMarked && <CheckCircle size={20} style={{ color: st === 'P' ? 'var(--color-success)' : st === 'A' ? 'var(--color-danger)' : 'var(--gold-600)' }} />}
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                          <button 
                            onClick={() => handleMark(est.id, 'P')}
                            disabled={!puedeEditar}
                            style={{ 
                              padding: '12px', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                              background: st === 'P' ? 'var(--color-success)' : 'white',
                              color: st === 'P' ? 'white' : 'var(--navy-600)',
                              boxShadow: 'var(--shadow-subtle)'
                            }}
                          ><UserCheck size={20} /></button>
                          
                          <button 
                            onClick={() => handleMark(est.id, 'A')}
                            disabled={!puedeEditar}
                            style={{ 
                              padding: '12px', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                              background: st === 'A' ? 'var(--color-danger)' : 'white',
                              color: st === 'A' ? 'white' : 'var(--navy-600)',
                              boxShadow: 'var(--shadow-subtle)'
                            }}
                          ><UserX size={20} /></button>
                          
                          <button 
                            onClick={() => handleMark(est.id, 'J')}
                            disabled={!puedeEditar}
                            style={{ 
                              padding: '12px', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                              background: st === 'J' ? 'var(--gold-500)' : 'white',
                              color: st === 'J' ? 'white' : 'var(--navy-600)',
                              boxShadow: 'var(--shadow-subtle)'
                            }}
                          ><HelpCircle size={20} /></button>
                      </div>
                  </article>
              );
          })}
          {filtered.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '80px', color: 'var(--navy-600)' }}>
              <Filter size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
              <p>No hay alumnos registrados en este curso.</p>
            </div>
          )}
      </div>

      {/* Modales */}
      <Modal isOpen={!!showJustModal} onClose={() => setShowJustModal(null)} title="Justificación de Inasistencia">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label className="form-label">Motivo u Observación</label>
              <textarea 
                className="form-textarea" 
                placeholder="Ej: Licencia médica, cita dental, trámite familiar..." 
                value={justText} 
                onChange={e => setJustText(e.target.value)} 
                rows={4}
              />
            </div>

            <div style={{ 
              padding: '16px', 
              border: '2px dashed var(--border-medium)', 
              borderRadius: '12px',
              textAlign: 'center',
              background: 'var(--bg-main)'
            }}>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleUpload} 
                style={{ display: 'none' }} 
                accept=".pdf,.jpg,.jpeg,.png"
              />
              <button 
                type="button"
                className={`btn ${isUploading ? 'btn-disabled' : 'btn-outline'}`}
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                style={{ width: '100%', justifyContent: 'center', gap: '8px' }}
              >
                {isUploading ? 'Subiendo...' : <><Upload size={18} /> Subir Licencia / Respaldo (PDF o Foto)</>}
              </button>
            </div>

            <button className="btn btn-navy" style={{ width: '100%', marginTop: '8px', padding: '14px' }} onClick={() => {
              if (!justText.trim()) {
                addToast('Escribe el motivo de la justificación', 'warning');
                return;
              }
              setObservaciones({...observaciones, [showJustModal]: justText});
              setAsistencia({...asistencia, [showJustModal]: 'J'});
              setShowJustModal(null);
            }}>
              Confirmar Justificación
            </button>
          </div>
      </Modal>

      <Modal isOpen={showConfirmCerrar} onClose={() => setShowConfirmCerrar(false)} title="Cerrar Jornada">
          <p style={{ marginBottom: '24px', color: 'var(--navy-600)' }}>¿Confirma el cierre de la jornada de hoy? Una vez cerrada, los registros serán permanentes.</p>
          <button className="btn btn-gold" style={{ width: '100%' }} disabled={saving} onClick={() => guardarJornada(true)}>{saving ? 'Guardando...' : 'Confirmar Cierre'}</button>
      </Modal>
    </div>
  );
}
