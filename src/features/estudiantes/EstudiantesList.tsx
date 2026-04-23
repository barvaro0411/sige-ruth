import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { EstudianteService } from '../../services/estudianteService';
import { useSede } from '../../config/SedeContext';
import { PERMISSIONS } from '../../auth/permissions';
import { useToast } from '../../components/Toast';
import { supabase } from '../../db/database';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Estudiante } from '../../types';
import {
  Plus, Search, Edit2, Eye, Trash2, FolderOpen, FileText, Filter
} from 'lucide-react';
import MatriculaPreviewModal from '../matricula/MatriculaPreviewModal';
import DocumentManager from './DocumentManager';
import EstudianteForm from './EstudianteForm';

export default function EstudiantesList() {
  const { user, can } = useAuth();
  const { sede } = useSede();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [filterCurso, setFilterCurso] = useState('');
  const [cursos, setCursos] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showDetail, setShowDetail] = useState<Estudiante | null>(null);
  const [docStudent, setDocStudent] = useState<{id: number, nombre: string} | null>(null);
  const [showMatricula, setShowMatricula] = useState<Estudiante | null>(null);

  // Cargar cursos de la sede
  useEffect(() => {
    async function loadCursos() {
      const { data } = await supabase.from('cursos').select('*').eq('sede_id', sede.id);
      setCursos(data || []);
    }
    loadCursos();
  }, [sede.id]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingId) {
        return EstudianteService.update(editingId, data, user!.id, sede.id);
      } else {
        return EstudianteService.create(data, user!.id, sede.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estudiantes', sede.id] });
      addToast('Estudiante guardado exitosamente', 'success');
      setShowForm(false);
      setEditingId(null);
    },
    onError: (err: any) => {
      addToast('Error al guardar estudiante: ' + err.message, 'error');
    }
  });

  const handleEdit = (est: Estudiante) => {
    setEditingId(est.id);
    setShowForm(true);
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

  if (isLoading) return <div className="page-container"><div className="skeleton" style={{ height: 400 }} /></div>;

  return (
    <div className="page-container animate-in">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
        <div>
          <h1 className="page-title">Libro de Matrícula</h1>
          <p className="page-subtitle">Gestión de expedientes y registros oficiales</p>
        </div>
        {can(PERMISSIONS.ENROLL_STUDENTS) && (
          <button className="btn btn-gold" onClick={() => setShowForm(true)}>
            <Plus size={20} /> Nueva Matrícula
          </button>
        )}
      </header>

      {/* Filtros Pulidos */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '32px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
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
          <article key={est.id} className="card" style={{ padding: '0' }}>
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ 
                  width: '64px', height: '64px', borderRadius: '18px', 
                  background: 'linear-gradient(135deg, var(--navy-900), var(--navy-800))',
                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '22px', fontWeight: 800, border: '4px solid var(--gold-50)'
                }}>
                  {est.nombre[0]}{est.apellidoPaterno[0]}
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--navy-900)', marginBottom: '4px' }}>
                    {est.apellidoPaterno} {est.apellidoMaterno}
                  </h3>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--navy-600)' }}>{est.nombre}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                <div style={{ background: 'var(--bg-main)', padding: '12px', borderRadius: '12px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--navy-600)', textTransform: 'uppercase', marginBottom: '4px' }}>RUT</div>
                  <div style={{ fontSize: '13px', fontWeight: 700 }}>{est.rut}</div>
                </div>
                <div style={{ background: 'var(--bg-main)', padding: '12px', borderRadius: '12px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--navy-600)', textTransform: 'uppercase', marginBottom: '4px' }}>Curso</div>
                  <div style={{ fontSize: '13px', fontWeight: 700 }}>
                    {cursos.find(c => c.id === est.curso_id)?.nombre || est.nivel}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="btn btn-ghost" style={{ padding: '8px' }} onClick={() => setShowDetail(est)}><Eye size={18} /></button>
                  <button className="btn btn-ghost" style={{ padding: '8px' }} onClick={() => setDocStudent({id: est.id, nombre: `${est.nombre} ${est.apellidoPaterno}`})}><FolderOpen size={18} /></button>
                  <button className="btn btn-ghost" style={{ padding: '8px' }} onClick={() => setShowMatricula(est)}><FileText size={18} /></button>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="btn btn-ghost" style={{ padding: '8px', color: 'var(--gold-600)' }} onClick={() => handleEdit(est)}><Edit2 size={18} /></button>
                  <button className="btn btn-ghost" style={{ padding: '8px', color: 'var(--danger)' }}><Trash2 size={18} /></button>
                </div>
              </div>
            </div>
            <div style={{ height: '4px', width: '100%', background: 'var(--gold-500)', opacity: 0.1 }}></div>
          </article>
        ))}
      </div>

      {/* Modales */}
      {docStudent && (
        <DocumentManager isOpen={!!docStudent} onClose={() => setDocStudent(null)} estudianteId={docStudent.id} nombreEstudiante={docStudent.nombre} />
      )}

      {showForm && (
        <EstudianteForm 
          isOpen={showForm} 
          onClose={() => { setShowForm(false); setEditingId(null); }} 
          onSubmit={(data) => mutation.mutate(data)} 
          estudiante={editingId ? estudiantes.find(e => e.id === editingId) || null : null}
          isLoading={mutation.isPending}
        />
      )}

      {showMatricula && (
        <MatriculaPreviewModal 
          isOpen={!!showMatricula} 
          onClose={() => setShowMatricula(null)} 
          estudiante={showMatricula} 
          sede={sede} 
        />
      )}
    </div>
  );
}
