import React, { useState, useEffect } from 'react';
import Modal from '../../components/Modal';
import { NIVELES, JORNADAS, DIAGNOSTICOS } from '../../constants';
import { rutInputHandler, validateRut } from '../../utils/rut';
import { Estudiante } from '../../types';

interface EstudianteFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  estudiante: Estudiante | null;
  isLoading?: boolean;
  cursos?: Array<{ id: string; nombre: string; nivel: string }>;
}

export default function EstudianteForm({ isOpen, onClose, onSubmit, estudiante, isLoading = false, cursos = [] }: EstudianteFormProps) {
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
    if (formData.fecha_nacimiento && formData.fecha_nacimiento> new Date().toISOString().split('T')[0]) {
      setFormError('La fecha de nacimiento no puede estar en el futuro.');
      return;
    }
    if (!formData.curso_id) {
      setFormError('Selecciona el curso del estudiante.');
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
    <Modal isOpen={isOpen} onClose={onClose} title={estudiante ? 'Editar Estudiante' : 'Nueva Matrícula'} size="lg">
      <form onSubmit={handleSubmit}>
        {formError && (
          <div className="login-error mb-4" role="alert">{formError}</div>
        )}
        <div className="grid grid-2 gap-4 mb-6">
          <div>
            <label className="form-label block mb-2 font-semibold">RUT</label>
            <input required type="text" name="rut" className="form-input w-full p-2"  value={formData.rut} onChange={handleChange} placeholder="12.345.678-9" />
          </div>
          <div>
            <label className="form-label block mb-2 font-semibold">Nombre</label>
            <input required type="text" name="nombre" className="form-input w-full p-2"  value={formData.nombre} onChange={handleChange} />
          </div>
          <div>
            <label className="form-label block mb-2 font-semibold">Apellido Paterno</label>
            <input required type="text" name="apellido_paterno" className="form-input w-full p-2"  value={formData.apellido_paterno} onChange={handleChange} />
          </div>
          <div>
            <label className="form-label block mb-2 font-semibold">Apellido Materno</label>
            <input type="text" name="apellido_materno" className="form-input w-full p-2"  value={formData.apellido_materno} onChange={handleChange} />
          </div>
          <div>
            <label className="form-label block mb-2 font-semibold">Fecha de Nacimiento</label>
            <input type="date" name="fecha_nacimiento" className="form-input w-full p-2"  value={formData.fecha_nacimiento} onChange={handleChange} />
          </div>
          <div>
            <label className="form-label block mb-2 font-semibold">Curso</label>
            <select required name="curso_id" className="form-input w-full p-2"  value={formData.curso_id} onChange={handleChange}>
              <option value="">Seleccione Curso</option>
              {cursos.map(curso => <option key={curso.id} value={curso.id}>{curso.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label block mb-2 font-semibold">Nivel</label>
            <select required disabled={!!formData.curso_id} name="nivel" className="form-input w-full p-2"  value={formData.nivel} onChange={handleChange}>
              <option value="">Seleccione Nivel</option>
              {NIVELES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label block mb-2 font-semibold">Jornada</label>
            <select required name="jornada" className="form-input w-full p-2"  value={formData.jornada} onChange={handleChange}>
              <option value="">Seleccione Jornada</option>
              {JORNADAS.map(j => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label block mb-2 font-semibold">Diagnóstico</label>
            <select name="diagnostico" className="form-input w-full p-2"  value={formData.diagnostico} onChange={handleChange}>
              <option value="">Seleccione Diagnóstico</option>
              {DIAGNOSTICOS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label block mb-2 font-semibold">Nombre Apoderado</label>
            <input type="text" name="nombre_apoderado" className="form-input w-full p-2"  value={formData.nombre_apoderado} onChange={handleChange} />
          </div>
          <div>
            <label className="form-label block mb-2 font-semibold">Teléfono Apoderado</label>
            <input type="text" name="telefono_apoderado" className="form-input w-full p-2"  value={formData.telefono_apoderado} onChange={handleChange} />
          </div>
        </div>

        <div className="flex gap-8 mb-8 p-4 bg-subtle rounded-md">
          <label className="flex items-center gap-2 cursor-pointer font-semibold">
            <input type="checkbox" name="anamnesis" checked={formData.anamnesis} onChange={handleChange} style={{ width: '1.2rem', height: '1.2rem' }} />
            Anamnesis Completada
          </label>
          <label className="flex items-center gap-2 cursor-pointer font-semibold">
            <input type="checkbox" name="prueba_inicial" checked={formData.prueba_inicial} onChange={handleChange} style={{ width: '1.2rem', height: '1.2rem' }} />
            Prueba Inicial Completada
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-medium)', paddingTop: '1rem' }}>
          <button type="button" className="btn btn-outline" onClick={onClose} style={{ padding: '0.5rem 1rem' }}>Cancelar</button>
          <button type="submit" className="btn btn-gold" disabled={isLoading} style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--color-navy)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)' }}>
            {isLoading ? 'Guardando...' : 'Guardar Estudiante'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
