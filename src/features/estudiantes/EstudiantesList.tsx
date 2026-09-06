import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { EstudianteService } from '../../services/estudianteService';
import { useSede } from '../../auth/SedeContext';
import { PERMISSIONS } from '../../auth/permissions';
import { useToast } from '../../components/Toast';
import { supabase } from '../../db/database';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Estudiante, EstudianteResumen } from '../../types';
import {
  Plus, Search, Edit2, Eye, Trash2, FolderOpen, FileText
} from 'lucide-react';
// El generador de PDF pesa ~1,5 MB. Se carga al abrir la matrícula, no en
// cada visita a la app: la mayoría del personal nunca la imprime.
const MatriculaPreviewModal = lazy(() => import('../matricula/MatriculaPreviewModal'));
import DocumentManager from './DocumentManager';
import EstudianteForm from './EstudianteForm';
import Modal from '../../components/Modal';

export default function EstudiantesList() {
  const { can } = useAuth();
  const { sede } = useSede();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [filterCurso, setFilterCurso] = useState('');
  const [cursos, setCursos] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Estudiante | null>(null);
  const [loadingStudentId, setLoadingStudentId] = useState<number | null>(null);
  const [showDetail, setShowDetail] = useState<Estudiante | null>(null);
  const [docStudent, setDocStudent] = useState<{id: number, nombre: string} | null>(null);
  const [showMatricula, setShowMatricula] = useState<Estudiante | null>(null);
  const [deactivatingStudent, setDeactivatingStudent] = useState<EstudianteResumen | null>(null);

  // Cargar cursos de la sede
  useEffect(() => {
    async function loadCursos() {
      const { data, error } = await supabase
        .from('cursos')
        .select('id,nombre,nivel')
        .eq('sede_id', sede.id);
      if (error) {
        addToast('No se pudieron cargar los cursos: ' + error.message, 'danger');
        return;
      }
      setCursos(data || []);
    }
    loadCursos();
  }, [addToast, sede.id]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingStudent) {
        return EstudianteService.update(editingStudent.id, data);
      } else {
        return EstudianteService.create(data, sede.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estudiantes', sede.id] });
      addToast('Estudiante guardado exitosamente', 'success');
      setShowForm(false);
      setEditingStudent(null);
    },
    onError: (err: any) => {
      addToast('Error al guardar estudiante: ' + err.message, 'danger');
    }
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => EstudianteService.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estudiantes', sede.id] });
      addToast('Matrícula desactivada correctamente', 'success');
      setDeactivatingStudent(null);
    },
    onError: (err: any) => {
      addToast('No se pudo desactivar la matrícula: ' + err.message, 'danger');
    },
  });

  const loadStudentDetail = async (id: number, destination: 'detail' | 'edit' | 'matricula') => {
    setLoadingStudentId(id);
    try {
      const student = await EstudianteService.getById(id);
      if (destination === 'detail') setShowDetail(student);
      if (destination === 'edit') {
        setEditingStudent(student);
        setShowForm(true);
      }
      if (destination === 'matricula') setShowMatricula(student);
    } catch (error: any) {
      addToast('No se pudo cargar el expediente: ' + error.message, 'danger');
    } finally {
      setLoadingStudentId(null);
    }
  };

  const { data: estudiantes = [], isLoading } = useQuery({
    queryKey: ['estudiantes', sede.id],
    queryFn: () => EstudianteService.getAllBySede(sede.id),
  });

  const filtered = useMemo(() => {
    return estudiantes.filter(e => {
      const matchSearch = !search ||
        `${e.nombre} ${e.apellidoPaterno} ${e.apellidoMaterno}`.toLowerCase().includes(search.toLowerCase()) ||
        e.rut.includes(search.replace(/\./g, ''));
      const matchCurso = !filterCurso || e.curso_id === filterCurso;
      return matchSearch && matchCurso;
    }).sort((a, b) => a.apellidoPaterno.localeCompare(b.apellidoPaterno));
  }, [estudiantes, search, filterCurso]);

  if (isLoading) return <div className="page-container"><div className="skeleton h-100" /></div>;

  return (
    <div className="page-container animate-in">
      <header className="flex justify-between items-end mb-10">
        <div>
          <h1 className="page-title">Libro de Matrícula</h1>
          <p className="page-subtitle">Gestión de expedientes y registros oficiales</p>
        </div>
        {can(PERMISSIONS.ENROLL_STUDENTS) && (
          <button className="btn btn-gold" onClick={() => { setEditingStudent(null); setShowForm(true); }}>
            <Plus size={20} /> Nueva Matrícula
          </button>
        )}
      </header>

      {/* Filtros Pulidos */}
      <div className="flex gap-5 mb-8 items-center">
        <div className="relative flex-1">
          <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--navy-600)' }} />
          <input
            className="form-input"
            style={{ paddingLeft: '48px', width: '100%' }}
            placeholder="Buscar por nombre o RUT..."
            value={search}
            onChange={e => setSearch(e.target.value)}
 />
        </div>
        <div style={{ display: 'flex', background: 'var(--border-light)', padding: '6px', borderRadius: '14px', gap: '4px', overflowX: 'auto' }}>
          <button
            onClick={() => setFilterCurso('')}
            style={{
              padding: '8px 16px', borderRadius: '10px', border: 'none', fontSize: '13px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
              background: !filterCurso ? 'white' : 'transparent',
              boxShadow: !filterCurso ? 'var(--shadow-subtle)' : 'none',
              color: !filterCurso ? 'var(--navy-900)' : 'var(--navy-600)'
            }}
>Todos</button>
          {cursos.map(c => (
            <button
              key={c.id}
              onClick={() => setFilterCurso(c.id)}
              style={{
                padding: '8px 16px', borderRadius: '10px', border: 'none', fontSize: '13px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                background: filterCurso === c.id ? 'white' : 'transparent',
                boxShadow: filterCurso === c.id ? 'var(--shadow-subtle)' : 'none',
                color: filterCurso === c.id ? 'var(--navy-900)' : 'var(--navy-600)'
              }}
>{c.nombre}</button>
          ))}
        </div>
      </div>

      {/* Grid de Alumnos */}
      <div className="grid grid-3">
        {filtered.map(est => (
          <article key={est.id} className="card">
            <div className="p-6">
              <div className="flex gap-5 items-center mb-6">
                <div style={{
                  width: '64px', height: '64px', borderRadius: '18px',
                  background: 'linear-gradient(135deg, var(--navy-900), var(--navy-800))',
                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '22px', fontWeight: 800, border: '4px solid var(--gold-50)'
                }}>
                  {est.nombre[0]}{est.apellidoPaterno[0]}
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-navy mb-1">
                    {est.apellidoPaterno} {est.apellidoMaterno}
                  </h3>
                  <p className="text-sm font-semibold text-secondary">{est.nombre}</p>
                </div>
              </div>

              <div className="grid grid-2 gap-3 mb-6">
                <div className="bg-main p-3 rounded-md">
                  <div className="text-xs font-extrabold text-secondary uppercase mb-1">RUT</div>
                  <div className="text-sm font-bold">{est.rut}</div>
                </div>
                <div className="bg-main p-3 rounded-md">
                  <div className="text-xs font-extrabold text-secondary uppercase mb-1">Curso</div>
                  <div className="text-sm font-bold">
                    {cursos.find(c => c.id === est.curso_id)?.nombre || est.nivel}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex gap-1">
                  <button className="btn btn-ghost p-2" disabled={loadingStudentId === est.id}  onClick={() => void loadStudentDetail(est.id, 'detail')}><Eye size={18} /></button>
                  <button className="btn btn-ghost p-2"  onClick={() => setDocStudent({id: est.id, nombre: `${est.nombre} ${est.apellidoPaterno}`})}><FolderOpen size={18} /></button>
                  <button className="btn btn-ghost p-2" disabled={loadingStudentId === est.id}  onClick={() => void loadStudentDetail(est.id, 'matricula')}><FileText size={18} /></button>
                </div>
                {can(PERMISSIONS.ENROLL_STUDENTS) && (
                  <div className="flex gap-1">
                    <button
                      className="btn btn-ghost p-2 text-gold"
                      title="Editar estudiante"
                      aria-label={`Editar a ${est.nombre} ${est.apellidoPaterno}`}

disabled={loadingStudentId === est.id}
                      onClick={() => void loadStudentDetail(est.id, 'edit')}
><Edit2 size={18} /></button>
                    <button
                      className="btn btn-ghost p-2 text-danger"
                      title="Desactivar matrícula"
                      aria-label={`Desactivar matrícula de ${est.nombre} ${est.apellidoPaterno}`}

onClick={() => setDeactivatingStudent(est)}
><Trash2 size={18} /></button>
                  </div>
                )}
              </div>
            </div>
            <div style={{ height: '4px', width: '100%', background: 'var(--gold-500)', opacity: 0.1 }}></div>
          </article>
        ))}
      </div>

      {/* Modales */}
      <Modal
        isOpen={!!showDetail}
        onClose={() => setShowDetail(null)}
        title="Detalle del estudiante"
        size="lg"
      >
        {showDetail && (
          <div className="grid grid-2 gap-4">
            {[
              ['Nombre', `${showDetail.nombre} ${showDetail.apellidoPaterno} ${showDetail.apellidoMaterno}`],
              ['RUT', showDetail.rut],
              ['Curso', cursos.find(c => c.id === showDetail.curso_id)?.nombre || showDetail.nivel],
              ['Jornada', showDetail.jornada || 'Sin registrar'],
              ['Fecha de nacimiento', showDetail.fechaNacimiento || 'Sin registrar'],
              ['Diagnóstico', showDetail.diagnostico || 'Sin registrar'],
              ['Apoderado', showDetail.nombreApoderado || 'Sin registrar'],
              ['Teléfono', showDetail.telefonoApoderado || 'Sin registrar'],
              ['Anamnesis', showDetail.anamnesis ? 'Completada' : 'Pendiente'],
              ['Prueba inicial', showDetail.pruebaInicial ? 'Completada' : 'Pendiente'],
            ].map(([label, value]) => (
              <div key={label} className="p-3 bg-main rounded-md">
                <div className="text-xs font-extrabold text-secondary uppercase mb-1">{label}</div>
                <div className="text-base font-bold">{value}</div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {docStudent && (
        <DocumentManager isOpen={!!docStudent} onClose={() => setDocStudent(null)} estudianteId={docStudent.id} nombreEstudiante={docStudent.nombre} />
      )}

      {showForm && (
        <EstudianteForm
          isOpen={showForm}
          onClose={() => { setShowForm(false); setEditingStudent(null); }}
          onSubmit={(data) => mutation.mutate(data)}
          estudiante={editingStudent}
          isLoading={mutation.isPending}
          cursos={cursos}
 />
      )}

      {showMatricula && (
        <Suspense fallback={
          <div className="modal-overlay">
            <div className="modal-box md p-10 text-center">
              <p className="text-muted">Preparando la matrícula…</p>
            </div>
          </div>
        }>
          <MatriculaPreviewModal
            isOpen={!!showMatricula}
            onClose={() => setShowMatricula(null)}
            estudiante={showMatricula}
            sede={sede}
 />
        </Suspense>
      )}

      <Modal
        isOpen={!!deactivatingStudent}
        onClose={() => !deactivateMutation.isPending && setDeactivatingStudent(null)}
        title="Desactivar matrícula"
      >
        <p style={{ marginBottom: '24px', color: 'var(--navy-600)', lineHeight: 1.6 }}>
          {deactivatingStudent
            ? `¿Confirmas que deseas desactivar la matrícula de ${deactivatingStudent.nombre} ${deactivatingStudent.apellidoPaterno}? El historial se conservará.`
            : ''}
        </p>
        <div className="flex justify-end gap-3">
          <button
            className="btn btn-outline"
            disabled={deactivateMutation.isPending}
            onClick={() => setDeactivatingStudent(null)}
>Cancelar</button>
          <button
            className="btn"
            disabled={!deactivatingStudent || deactivateMutation.isPending}
            onClick={() => deactivatingStudent && deactivateMutation.mutate(deactivatingStudent.id)}
            style={{ background: 'var(--color-danger)', color: 'white' }}
>{deactivateMutation.isPending ? 'Desactivando...' : 'Desactivar matrícula'}</button>
        </div>
      </Modal>
    </div>
  );
}
