import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { EstudianteService } from '../../services/estudianteService';
import { useSede } from '../../auth/SedeContext';
import { PERMISSIONS } from '../../auth/permissions';
import { useToast } from '../../components/Toast';
import { supabase } from '../../db/database';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Estudiante, EstudianteResumen } from '../../types';
import { formatRut } from '../../utils/rut';
import { downloadExcel } from '../../utils/excel';
import {
  Plus, Search, Edit2, Eye, Trash2, FolderOpen, FileText,
  Download, LayoutGrid, List, Users, GraduationCap, Sun, Moon,
  Phone, Calendar, Activity, CheckCircle2, Clock, UserCheck, Sparkles
} from 'lucide-react';

// El generador de PDF pesa ~1,5 MB. Se carga solo al abrir la matrícula.
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
  const [filterJornada, setFilterJornada] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [cursos, setCursos] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Estudiante | null>(null);
  const [loadingStudentId, setLoadingStudentId] = useState<number | null>(null);
  const [showDetail, setShowDetail] = useState<Estudiante | null>(null);
  const [docStudent, setDocStudent] = useState<{ id: number; nombre: string } | null>(null);
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
    },
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
      const matchJornada = !filterJornada || e.jornada === filterJornada;
      return matchSearch && matchCurso && matchJornada;
    }).sort((a, b) => a.apellidoPaterno.localeCompare(b.apellidoPaterno));
  }, [estudiantes, search, filterCurso, filterJornada]);

  // KPIs
  const totalMatriculados = estudiantes.length;
  const totalManana = useMemo(() => estudiantes.filter(e => e.jornada === 'Mañana').length, [estudiantes]);
  const totalTarde = useMemo(() => estudiantes.filter(e => e.jornada === 'Tarde').length, [estudiantes]);

  async function exportarExcel() {
    if (filtered.length === 0) {
      addToast('No hay estudiantes para exportar con los filtros actuales', 'warning');
      return;
    }
    const headers = ['N°', 'RUN', 'Apellido Paterno', 'Apellido Materno', 'Nombres', 'Curso', 'Nivel', 'Jornada', 'Sede'];
    const rows = filtered.map((e, index) => [
      index + 1,
      formatRut(e.rut),
      e.apellidoPaterno,
      e.apellidoMaterno || '',
      e.nombre,
      cursos.find(c => c.id === e.curso_id)?.nombre || e.nivel,
      e.nivel,
      e.jornada,
      sede.nombre,
    ]);

    const fechaHoy = new Date().toISOString().split('T')[0];
    try {
      await downloadExcel(`Libro_Matricula_${sede.nombre.replace(/\s+/g, '_')}_${fechaHoy}`, 'Matrícula', [headers, ...rows]);
      addToast('Nómina oficial exportada a Excel', 'success');
    } catch {
      addToast('No se pudo generar la nómina Excel. Intenta nuevamente.', 'danger');
    }
  }

  function getCursoColorBadge(nivel: string) {
    if (nivel.includes('Medio Mayor')) return 'badge-gold';
    if (nivel.includes('NT1') || nivel.includes('Pre')) return 'badge-info';
    if (nivel.includes('NT2') || nivel.includes('Kinder') || nivel.includes('Kínder')) return 'badge-success';
    return 'badge-navy';
  }

  if (isLoading) return <div className="page-container"><div className="skeleton" style={{ height: 420 }} /></div>;

  return (
    <div className="page-container animate-in">
      {/* Cabecera Principal */}
      <header className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="page-title">Libro de Matrícula</h1>
          <p className="page-subtitle">
            Nómina oficial de estudiantes y expedientes · {sede.nombre}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-outline"
            onClick={exportarExcel}
            title="Descargar nómina en formato Excel (.xlsx)"
          >
            <Download size={17} /> Exportar Excel
          </button>
          {can(PERMISSIONS.ENROLL_STUDENTS) && (
            <button className="btn btn-gold" onClick={() => { setEditingStudent(null); setShowForm(true); }}>
              <Plus size={18} /> Nueva Matrícula
            </button>
          )}
        </div>
      </header>

      {/* Franja de Estadísticas / KPIs */}
      <section className="grid grid-3" style={{ marginBottom: '24px' }}>
        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'var(--gold-100)', color: 'var(--gold-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--navy-600)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Matriculados
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--navy-900)', lineHeight: 1.1 }}>
              {totalMatriculados} <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>alumnos</span>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'var(--color-navy-soft)', color: 'var(--navy-800)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GraduationCap size={22} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--navy-600)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Cursos Habilitados
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--navy-900)', lineHeight: 1.1 }}>
              {cursos.length} <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>cursos</span>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'var(--color-success-soft)', color: 'var(--color-success-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--navy-600)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Distribución Jornadas
            </div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--navy-900)', display: 'flex', gap: '10px', marginTop: '2px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Sun size={14} style={{ color: 'var(--gold-600)' }} /> {totalManana} Mañana
              </span>
              <span>·</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Moon size={14} style={{ color: 'var(--navy-500)' }} /> {totalTarde} Tarde
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Barra de Filtros y Selector de Vista */}
      <section style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px' }}>
        {/* Buscador */}
        <div className="search-container" style={{ flex: '1 1 260px' }}>
          <Search size={18} className="search-icon" />
          <input
            className="search-input"
            placeholder="Buscar por RUN, nombre o apellido…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Filtro Curso */}
        <select
          className="form-select"
          style={{ flex: '0 1 200px' }}
          value={filterCurso}
          onChange={e => setFilterCurso(e.target.value)}
          aria-label="Filtrar por curso"
        >
          <option value="">Todos los cursos</option>
          {cursos.map(c => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>

        {/* Filtro Jornada */}
        <select
          className="form-select"
          style={{ flex: '0 1 150px' }}
          value={filterJornada}
          onChange={e => setFilterJornada(e.target.value)}
          aria-label="Filtrar por jornada"
        >
          <option value="">Todas las jornadas</option>
          <option value="Mañana">Mañana</option>
          <option value="Tarde">Tarde</option>
        </select>

        {/* Switch de Vista (Tabla vs Tarjetas) */}
        <div
          style={{
            display: 'flex',
            background: 'var(--border-light)',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
            gap: '2px',
            marginLeft: 'auto'
          }}
          role="group"
          aria-label="Modo de visualización"
        >
          <button
            type="button"
            className="tab"
            style={{
              padding: '6px 12px',
              minHeight: '36px',
              background: viewMode === 'table' ? 'white' : 'transparent',
              color: viewMode === 'table' ? 'var(--navy-900)' : 'var(--text-muted)',
              boxShadow: viewMode === 'table' ? 'var(--shadow-xs)' : 'none',
            }}
            onClick={() => setViewMode('table')}
            title="Vista de Tabla Oficial"
          >
            <List size={16} /> <span style={{ marginLeft: '4px', fontSize: '12px' }}>Tabla</span>
          </button>
          <button
            type="button"
            className="tab"
            style={{
              padding: '6px 12px',
              minHeight: '36px',
              background: viewMode === 'grid' ? 'white' : 'transparent',
              color: viewMode === 'grid' ? 'var(--navy-900)' : 'var(--text-muted)',
              boxShadow: viewMode === 'grid' ? 'var(--shadow-xs)' : 'none',
            }}
            onClick={() => setViewMode('grid')}
            title="Vista de Tarjetas"
          >
            <LayoutGrid size={16} /> <span style={{ marginLeft: '4px', fontSize: '12px' }}>Tarjetas</span>
          </button>
        </div>
      </section>

      {/* Contenido Principal */}
      {filtered.length === 0 ? (
        <div className="card" style={{ padding: '60px 24px', textAlign: 'center' }}>
          <Users size={48} style={{ color: 'var(--text-muted)', marginBottom: '14px', opacity: 0.4 }} />
          <h3 style={{ marginBottom: '6px', fontSize: '16px' }}>No se encontraron estudiantes</h3>
          <p className="text-muted" style={{ fontSize: '13px' }}>
            {search || filterCurso || filterJornada
              ? 'Intenta ajustar los criterios de búsqueda o filtros.'
              : 'Todavía no hay estudiantes matriculados en esta sede.'}
          </p>
        </div>
      ) : viewMode === 'table' ? (
        /* ══════════════════════════════════════════════════════════════════════════
           VISTA 1: TABLA OFICIAL DE MATRÍCULA (ESTILO LIBRO DE CLASES / SIGE)
           ══════════════════════════════════════════════════════════════════════════ */
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '45px', textAlign: 'center' }}>#</th>
                <th style={{ width: '130px' }}>RUN</th>
                <th>Estudiante</th>
                <th>Curso / Nivel</th>
                <th>Jornada</th>
                <th style={{ textAlign: 'right', minWidth: '180px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((est, idx) => {
                const cursoObj = cursos.find(c => c.id === est.curso_id);
                const cursoNombre = cursoObj?.nombre || est.nivel;
                const cursoBadgeClass = getCursoColorBadge(est.nivel);
                const isLoadingRow = loadingStudentId === est.id;

                return (
                  <tr key={est.id}>
                    <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--navy-400)', fontSize: '12px' }}>
                      {idx + 1}
                    </td>
                    <td style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--navy-900)', fontSize: '13.5px' }}>
                      {formatRut(est.rut)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                            background: 'var(--color-navy-soft)', color: 'var(--navy-900)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '12px', fontWeight: 800, border: '1px solid var(--navy-200)'
                          }}
                        >
                          {est.nombre[0]}{(est.apellidoPaterno || '')[0]}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, color: 'var(--navy-900)', fontSize: '14px' }}>
                            {est.apellidoPaterno} {est.apellidoMaterno}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--navy-600)', fontWeight: 500 }}>
                            {est.nombre}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${cursoBadgeClass}`} style={{ fontWeight: 800 }}>
                        {cursoNombre}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          fontSize: '12.5px', fontWeight: 700, color: 'var(--navy-700)'
                        }}
                      >
                        {est.jornada === 'Mañana' ? <Sun size={14} style={{ color: 'var(--gold-600)' }} /> : <Moon size={14} style={{ color: 'var(--navy-500)' }} />}
                        {est.jornada}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          title="Ver Ficha y Expediente"
                          aria-label={`Ver expediente de ${est.nombre} ${est.apellidoPaterno}`}
                          disabled={isLoadingRow}
                          onClick={() => void loadStudentDetail(est.id, 'detail')}
                        >
                          <Eye size={16} /> <span style={{ fontSize: '12px' }}>Ficha</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          title="Documentos Adjuntos"
                          aria-label={`Documentos de ${est.nombre} ${est.apellidoPaterno}`}
                          onClick={() => setDocStudent({ id: est.id, nombre: `${est.nombre} ${est.apellidoPaterno}` })}
                        >
                          <FolderOpen size={16} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          title="Imprimir Ficha PDF de Matrícula"
                          aria-label={`Generar PDF de ${est.nombre} ${est.apellidoPaterno}`}
                          disabled={isLoadingRow}
                          onClick={() => void loadStudentDetail(est.id, 'matricula')}
                        >
                          <FileText size={16} />
                        </button>
                        {can(PERMISSIONS.ENROLL_STUDENTS) && (
                          <>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              title="Editar Estudiante"
                              aria-label={`Editar a ${est.nombre} ${est.apellidoPaterno}`}
                              style={{ color: 'var(--gold-700)' }}
                              disabled={isLoadingRow}
                              onClick={() => void loadStudentDetail(est.id, 'edit')}
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              title="Desactivar Matrícula"
                              aria-label={`Desactivar matrícula de ${est.nombre} ${est.apellidoPaterno}`}
                              style={{ color: 'var(--color-danger)' }}
                              onClick={() => setDeactivatingStudent(est)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════════════════════
           VISTA 2: TARJETAS MODERNIZADAS
           ══════════════════════════════════════════════════════════════════════════ */
        <div className="grid grid-3">
          {filtered.map(est => {
            const cursoObj = cursos.find(c => c.id === est.curso_id);
            const cursoNombre = cursoObj?.nombre || est.nivel;
            const cursoBadgeClass = getCursoColorBadge(est.nivel);
            const isLoadingRow = loadingStudentId === est.id;

            return (
              <article key={est.id} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  {/* Encabezado de la tarjeta */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div
                        style={{
                          width: 46, height: 46, borderRadius: 'var(--radius-md)',
                          background: 'linear-gradient(135deg, var(--navy-900), var(--navy-700))',
                          color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '16px', fontWeight: 800, boxShadow: '0 2px 8px rgba(11, 21, 40, 0.15)'
                        }}
                      >
                        {est.nombre[0]}{(est.apellidoPaterno || '')[0]}
                      </div>
                      <div>
                        <h3 style={{ fontSize: '15.5px', fontWeight: 800, color: 'var(--navy-900)', lineHeight: 1.2, margin: 0 }}>
                          {est.apellidoPaterno} {est.apellidoMaterno}
                        </h3>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--navy-600)', margin: '2px 0 0' }}>
                          {est.nombre}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Insignias de Curso y Jornada */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                    <span className={`badge ${cursoBadgeClass}`} style={{ fontWeight: 800 }}>
                      {cursoNombre}
                    </span>
                    <span
                      className="badge badge-navy"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}
                    >
                      {est.jornada === 'Mañana' ? <Sun size={12} style={{ color: 'var(--gold-600)' }} /> : <Moon size={12} style={{ color: 'var(--navy-500)' }} />}
                      {est.jornada}
                    </span>
                  </div>

                  {/* RUN en bloque limpio */}
                  <div style={{ background: 'var(--bg-main)', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--navy-600)', textTransform: 'uppercase' }}>RUN</span>
                    <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--navy-900)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatRut(est.rut)}
                    </span>
                  </div>
                </div>

                {/* Acciones de la tarjeta */}
                <div style={{ display: 'flex', gap: '6px', borderTop: '1px solid var(--border-light)', paddingTop: '14px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ flex: '1 1 auto', minHeight: '38px', fontSize: '12.5px' }}
                    disabled={isLoadingRow}
                    onClick={() => void loadStudentDetail(est.id, 'detail')}
                  >
                    <Eye size={15} /> Ficha
                  </button>

                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ minHeight: '38px', padding: '6px 10px' }}
                    title="Documentos"
                    onClick={() => setDocStudent({ id: est.id, nombre: `${est.nombre} ${est.apellidoPaterno}` })}
                  >
                    <FolderOpen size={16} />
                  </button>

                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ minHeight: '38px', padding: '6px 10px' }}
                    title="Imprimir PDF Matrícula"
                    disabled={isLoadingRow}
                    onClick={() => void loadStudentDetail(est.id, 'matricula')}
                  >
                    <FileText size={16} />
                  </button>

                  {can(PERMISSIONS.ENROLL_STUDENTS) && (
                    <>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ minHeight: '38px', padding: '6px 10px', color: 'var(--gold-700)' }}
                        title="Editar"
                        disabled={isLoadingRow}
                        onClick={() => void loadStudentDetail(est.id, 'edit')}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ minHeight: '38px', padding: '6px 10px', color: 'var(--color-danger)' }}
                        title="Desactivar matrícula"
                        onClick={() => setDeactivatingStudent(est)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL DETALLE / EXPEDIENTE DEL ESTUDIANTE
          ══════════════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={!!showDetail}
        onClose={() => setShowDetail(null)}
        title="Expediente Oficial del Estudiante"
        size="lg"
      >
        {showDetail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header del Alumno */}
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: '16px',
                padding: '16px 20px', background: 'var(--bg-main)', borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-medium)'
              }}
            >
              <div
                style={{
                  width: 56, height: 56, borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, var(--navy-900), var(--navy-700))',
                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '20px', fontWeight: 800, flexShrink: 0
                }}
              >
                {showDetail.nombre[0]}{(showDetail.apellidoPaterno || '')[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--navy-900)', margin: 0 }}>
                  {showDetail.nombre} {showDetail.apellidoPaterno} {showDetail.apellidoMaterno}
                </h3>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginTop: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--navy-700)', fontVariantNumeric: 'tabular-nums' }}>
                    RUN: {formatRut(showDetail.rut)}
                  </span>
                  <span className={`badge ${getCursoColorBadge(showDetail.nivel)}`}>
                    {cursos.find(c => c.id === showDetail.curso_id)?.nombre || showDetail.nivel}
                  </span>
                  <span className="badge badge-success">Matrícula Activa</span>
                </div>
              </div>
            </div>

            {/* Fichas de Información en 2 Columnas */}
            <div className="grid grid-2" style={{ gap: '16px' }}>
              {/* Bloque 1: Identificación y Académico */}
              <div className="card" style={{ padding: '16px 18px', border: '1px solid var(--border-medium)' }}>
                <h4 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--navy-600)', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <GraduationCap size={15} /> Asignación Académica
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13.5px' }}>
                  <div>
                    <span className="text-muted" style={{ fontSize: '12px' }}>Curso: </span>
                    <strong>{cursos.find(c => c.id === showDetail.curso_id)?.nombre || showDetail.nivel}</strong>
                  </div>
                  <div>
                    <span className="text-muted" style={{ fontSize: '12px' }}>Nivel: </span>
                    <strong>{showDetail.nivel}</strong>
                  </div>
                  <div>
                    <span className="text-muted" style={{ fontSize: '12px' }}>Jornada: </span>
                    <strong>{showDetail.jornada || 'Sin registrar'}</strong>
                  </div>
                  <div>
                    <span className="text-muted" style={{ fontSize: '12px' }}>Fecha de Nacimiento: </span>
                    <strong>{showDetail.fechaNacimiento || 'Sin registrar'}</strong>
                  </div>
                </div>
              </div>

              {/* Bloque 2: Diagnóstico y Fonoaudiología */}
              <div className="card" style={{ padding: '16px 18px', border: '1px solid var(--border-medium)' }}>
                <h4 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--navy-600)', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Activity size={15} /> Diagnóstico y Fonoaudiología
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13.5px' }}>
                  <div>
                    <span className="text-muted" style={{ fontSize: '12px' }}>Diagnóstico: </span>
                    <strong style={{ color: 'var(--gold-700)' }}>{showDetail.diagnostico || 'Sin diagnóstico asignado'}</strong>
                  </div>
                  <div>
                    <span className="text-muted" style={{ fontSize: '12px' }}>Anamnesis: </span>
                    <span className={`badge ${showDetail.anamnesis ? 'badge-success' : 'badge-warning'}`}>
                      {showDetail.anamnesis ? 'Completada' : 'Pendiente'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted" style={{ fontSize: '12px' }}>Evaluación Inicial: </span>
                    <span className={`badge ${showDetail.pruebaInicial ? 'badge-success' : 'badge-warning'}`}>
                      {showDetail.pruebaInicial ? 'Completada' : 'Pendiente'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bloque 3: Apoderado y Contacto */}
              <div className="card" style={{ padding: '16px 18px', border: '1px solid var(--border-medium)', gridColumn: '1 / -1' }}>
                <h4 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--navy-600)', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Phone size={15} /> Apoderado y Contacto de Emergencia
                </h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--navy-900)' }}>
                      {showDetail.nombreApoderado || 'Sin apoderado registrado'}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      Teléfono: <strong>{showDetail.telefonoApoderado || 'Sin teléfono'}</strong>
                    </div>
                  </div>
                  {showDetail.telefonoApoderado && (
                    <a
                      href={`tel:${showDetail.telefonoApoderado}`}
                      className="btn btn-outline btn-sm"
                      style={{ textDecoration: 'none' }}
                    >
                      <Phone size={14} /> Llamar apoderado
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Acciones del Modal */}
            <div className="modal-footer-sticky" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  const student = showDetail;
                  setShowDetail(null);
                  setDocStudent({ id: student.id, nombre: `${student.nombre} ${student.apellidoPaterno}` });
                }}
              >
                <FolderOpen size={16} /> Ver Documentos
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  const student = showDetail;
                  setShowDetail(null);
                  setShowMatricula(student);
                }}
              >
                <FileText size={16} /> Imprimir Ficha PDF
              </button>
              {can(PERMISSIONS.ENROLL_STUDENTS) && (
                <button
                  type="button"
                  className="btn btn-gold"
                  onClick={() => {
                    const student = showDetail;
                    setShowDetail(null);
                    setEditingStudent(student);
                    setShowForm(true);
                  }}
                >
                  <Edit2 size={16} /> Editar Estudiante
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Gestor de Documentos */}
      {docStudent && (
        <DocumentManager
          isOpen={!!docStudent}
          onClose={() => setDocStudent(null)}
          estudianteId={docStudent.id}
          nombreEstudiante={docStudent.nombre}
        />
      )}

      {/* Formulario de Matrícula (Creación / Edición) */}
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

      {/* Modal de Previsualización PDF de Matrícula */}
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

      {/* Modal de Desactivación */}
      <Modal
        isOpen={!!deactivatingStudent}
        onClose={() => !deactivateMutation.isPending && setDeactivatingStudent(null)}
        title="Desactivar Matrícula"
      >
        <p style={{ marginBottom: '24px', color: 'var(--navy-700)', lineHeight: 1.6, fontSize: '14px' }}>
          {deactivatingStudent
            ? `¿Confirmas que deseas desactivar la matrícula de ${deactivatingStudent.nombre} ${deactivatingStudent.apellidoPaterno}? El historial se conservará en el sistema.`
            : ''}
        </p>
        <div className="modal-footer-sticky" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="button"
            className="btn btn-outline"
            disabled={deactivateMutation.isPending}
            onClick={() => setDeactivatingStudent(null)}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn"
            disabled={!deactivatingStudent || deactivateMutation.isPending}
            onClick={() => deactivatingStudent && deactivateMutation.mutate(deactivatingStudent.id)}
            style={{ background: 'var(--color-danger)', color: 'white' }}
          >
            {deactivateMutation.isPending ? 'Desactivando…' : 'Desactivar Matrícula'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
