import React, { useState, useEffect } from 'react';
import Modal from '../../components/Modal';
import { NIVELES, JORNADAS, DIAGNOSTICOS } from '../../constants';
import { rutInputHandler, validateRut } from '../../utils/rut';
import { Estudiante } from '../../types';
import { User, School, Activity, Phone, CheckCircle2 } from 'lucide-react';

interface EstudianteFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  estudiante: Estudiante | null;
  isLoading?: boolean;
  cursos?: Array<{ id: string; nombre: string; nivel: string }>;
}

export default function EstudianteForm({
  isOpen, onClose, onSubmit, estudiante, isLoading = false, cursos = []
}: EstudianteFormProps) {
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState({
    rut: '',
    nombre: '',
    apellido_paterno: '',
    apellido_materno: '',
    fecha_nacimiento: '',
    diagnostico: '',
    nivel: '',
    jornada: '',
    nombre_apoderado: '',
    telefono_apoderado: '',
    anamnesis: false,
    prueba_inicial: false,
    curso_id: '',
  });

  useEffect(() => {
    if (estudiante) {
      setFormData({
        rut: estudiante.rut,
        nombre: estudiante.nombre,
        apellido_paterno: estudiante.apellidoPaterno,
        apellido_materno: estudiante.apellidoMaterno || '',
        fecha_nacimiento: estudiante.fechaNacimiento || '',
        diagnostico: estudiante.diagnostico || '',
        nivel: estudiante.nivel || '',
        jornada: estudiante.jornada || '',
        nombre_apoderado: estudiante.nombreApoderado || '',
        telefono_apoderado: estudiante.telefonoApoderado || '',
        anamnesis: estudiante.anamnesis || false,
        prueba_inicial: estudiante.pruebaInicial || false,
        curso_id: estudiante.curso_id || '',
      });
    } else {
      setFormData({
        rut: '',
        nombre: '',
        apellido_paterno: '',
        apellido_materno: '',
        fecha_nacimiento: '',
        diagnostico: '',
        nivel: '',
        jornada: '',
        nombre_apoderado: '',
        telefono_apoderado: '',
        anamnesis: false,
        prueba_inicial: false,
        curso_id: '',
      });
    }
    setFormError('');
  }, [estudiante, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'rut') {
      setFormData(prev => ({ ...prev, rut: rutInputHandler(value).formatted }));
    } else if (name === 'curso_id') {
      const curso = cursos.find(item => item.id === value);
      setFormData(prev => ({ ...prev, curso_id: value, nivel: curso?.nivel || prev.nivel }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateRut(formData.rut)) {
      setFormError('El RUT ingresado no es válido. Revisa el dígito verificador.');
      return;
    }
    if (formData.fecha_nacimiento && formData.fecha_nacimiento > new Date().toISOString().split('T')[0]) {
      setFormError('La fecha de nacimiento no puede estar en el futuro.');
      return;
    }
    if (!formData.curso_id) {
      setFormError('Selecciona el curso asignado para el estudiante.');
      return;
    }

    setFormError('');
    onSubmit({
      ...formData,
      nombre: formData.nombre.trim(),
      apellido_paterno: formData.apellido_paterno.trim(),
      apellido_materno: formData.apellido_materno.trim(),
      nombre_apoderado: formData.nombre_apoderado.trim(),
      telefono_apoderado: formData.telefono_apoderado.trim(),
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={estudiante ? `Editar Ficha · ${estudiante.nombre} ${estudiante.apellidoPaterno}` : 'Nueva Matrícula Oficial'}
      size="lg"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {formError && (
          <div className="login-error" role="alert" style={{ margin: 0 }}>
            {formError}
          </div>
        )}

        {/* Sección 1: Identificación del Estudiante */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
            <User size={18} style={{ color: 'var(--gold-600)' }} />
            <h4 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--navy-900)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              1. Identificación del Alumno(a)
            </h4>
          </div>

          <div className="grid grid-2" style={{ gap: '14px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="est-rut">RUT *</label>
              <input
                id="est-rut" required type="text" name="rut" className="form-input"
                placeholder="12.345.678-9"
                value={formData.rut} onChange={handleChange} disabled={isLoading}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="est-nacimiento">Fecha de Nacimiento</label>
              <input
                id="est-nacimiento" type="date" name="fecha_nacimiento" className="form-input"
                value={formData.fecha_nacimiento} onChange={handleChange} disabled={isLoading}
              />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label" htmlFor="est-nombre">Nombres *</label>
              <input
                id="est-nombre" required type="text" name="nombre" className="form-input"
                placeholder="Nombres del estudiante"
                value={formData.nombre} onChange={handleChange} disabled={isLoading}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="est-paterno">Apellido Paterno *</label>
              <input
                id="est-paterno" required type="text" name="apellido_paterno" className="form-input"
                placeholder="Primer apellido"
                value={formData.apellido_paterno} onChange={handleChange} disabled={isLoading}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="est-materno">Apellido Materno</label>
              <input
                id="est-materno" type="text" name="apellido_materno" className="form-input"
                placeholder="Segundo apellido"
                value={formData.apellido_materno} onChange={handleChange} disabled={isLoading}
              />
            </div>
          </div>
        </section>

        {/* Sección 2: Asignación Escolar */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
            <School size={18} style={{ color: 'var(--gold-600)' }} />
            <h4 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--navy-900)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              2. Asignación de Curso y Jornada
            </h4>
          </div>

          <div className="grid grid-3" style={{ gap: '14px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="est-curso">Curso *</label>
              <select
                id="est-curso" required name="curso_id" className="form-select"
                value={formData.curso_id} onChange={handleChange} disabled={isLoading}
              >
                <option value="">Seleccionar curso</option>
                {cursos.map(curso => <option key={curso.id} value={curso.id}>{curso.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="est-nivel">Nivel Educativo *</label>
              <select
                id="est-nivel" required disabled={!!formData.curso_id} name="nivel" className="form-select"
                value={formData.nivel} onChange={handleChange}
              >
                <option value="">Seleccionar nivel</option>
                {NIVELES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="est-jornada">Jornada *</label>
              <select
                id="est-jornada" required name="jornada" className="form-select"
                value={formData.jornada} onChange={handleChange} disabled={isLoading}
              >
                <option value="">Seleccionar jornada</option>
                {JORNADAS.map(j => <option key={j} value={j}>{j}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* Sección 3: Diagnóstico y Fonoaudiología */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
            <Activity size={18} style={{ color: 'var(--gold-600)' }} />
            <h4 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--navy-900)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              3. Diagnóstico y Expediente Fonoaudiológico
            </h4>
          </div>

          <div className="grid grid-2" style={{ gap: '14px', marginBottom: '16px' }}>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label" htmlFor="est-diag">Diagnóstico TEL *</label>
              <select
                id="est-diag" name="diagnostico" className="form-select"
                value={formData.diagnostico} onChange={handleChange} disabled={isLoading}
              >
                <option value="">Seleccionar diagnóstico</option>
                {DIAGNOSTICOS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <label
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '12px 16px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                border: `1.5px solid ${formData.anamnesis ? 'var(--color-success)' : 'var(--border-medium)'}`,
                background: formData.anamnesis ? 'var(--color-success-soft)' : 'white',
                fontWeight: 700, fontSize: '13px', flex: '1 1 200px'
              }}
            >
              <input
                type="checkbox" name="anamnesis" checked={formData.anamnesis}
                onChange={handleChange} disabled={isLoading}
              />
              <span style={{ color: formData.anamnesis ? 'var(--color-success-dark)' : 'var(--text-primary)' }}>
                Anamnesis completada
              </span>
            </label>

            <label
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '12px 16px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                border: `1.5px solid ${formData.prueba_inicial ? 'var(--color-success)' : 'var(--border-medium)'}`,
                background: formData.prueba_inicial ? 'var(--color-success-soft)' : 'white',
                fontWeight: 700, fontSize: '13px', flex: '1 1 200px'
              }}
            >
              <input
                type="checkbox" name="prueba_inicial" checked={formData.prueba_inicial}
                onChange={handleChange} disabled={isLoading}
              />
              <span style={{ color: formData.prueba_inicial ? 'var(--color-success-dark)' : 'var(--text-primary)' }}>
                Evaluación inicial completada
              </span>
            </label>
          </div>
        </section>

        {/* Sección 4: Datos del Apoderado */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
            <Phone size={18} style={{ color: 'var(--gold-600)' }} />
            <h4 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--navy-900)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              4. Apoderado y Contacto de Emergencia
            </h4>
          </div>

          <div className="grid grid-2" style={{ gap: '14px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="est-apoderado">Nombre del Apoderado</label>
              <input
                id="est-apoderado" type="text" name="nombre_apoderado" className="form-input"
                placeholder="Nombre y apellidos"
                value={formData.nombre_apoderado} onChange={handleChange} disabled={isLoading}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="est-tel">Teléfono de Contacto</label>
              <input
                id="est-tel" type="tel" name="telefono_apoderado" className="form-input"
                placeholder="+56 9 1234 5678"
                value={formData.telefono_apoderado} onChange={handleChange} disabled={isLoading}
              />
            </div>
          </div>
        </section>

        {/* Footer fijo accesible */}
        <div className="modal-footer-sticky">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-gold" disabled={isLoading}>
            <CheckCircle2 size={18} />
            {isLoading ? 'Guardando…' : estudiante ? 'Guardar Cambios' : 'Registrar Matrícula'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

