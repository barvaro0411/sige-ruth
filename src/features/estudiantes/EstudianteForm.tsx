import React, { useState, useEffect } from 'react';
import Modal from '../../components/Modal';
import { NIVELES, JORNADAS, DIAGNOSTICOS } from '../../config/constants';
import { rutInputHandler } from '../../utils/rut';
import { Estudiante } from '../../types';

interface EstudianteFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  estudiante: Estudiante | null;
  isLoading?: boolean;
}

export default function EstudianteForm({ isOpen, onClose, onSubmit, estudiante, isLoading = false }: EstudianteFormProps) {
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
      });
    }
  }, [estudiante, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'rut') {
      setFormData(prev => ({ ...prev, rut: rutInputHandler(value).formatted }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={estudiante ? 'Editar Estudiante' : 'Nueva Matrícula'} size="lg">
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>RUT</label>
            <input required type="text" name="rut" className="form-input" style={{ width: '100%', padding: '0.5rem' }} value={formData.rut} onChange={handleChange} placeholder="12.345.678-9" />
          </div>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Nombre</label>
            <input required type="text" name="nombre" className="form-input" style={{ width: '100%', padding: '0.5rem' }} value={formData.nombre} onChange={handleChange} />
          </div>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Apellido Paterno</label>
            <input required type="text" name="apellido_paterno" className="form-input" style={{ width: '100%', padding: '0.5rem' }} value={formData.apellido_paterno} onChange={handleChange} />
          </div>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Apellido Materno</label>
            <input type="text" name="apellido_materno" className="form-input" style={{ width: '100%', padding: '0.5rem' }} value={formData.apellido_materno} onChange={handleChange} />
          </div>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Fecha de Nacimiento</label>
            <input type="date" name="fecha_nacimiento" className="form-input" style={{ width: '100%', padding: '0.5rem' }} value={formData.fecha_nacimiento} onChange={handleChange} />
          </div>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Nivel</label>
            <select required name="nivel" className="form-input" style={{ width: '100%', padding: '0.5rem' }} value={formData.nivel} onChange={handleChange}>
              <option value="">Seleccione Nivel</option>
              {NIVELES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Jornada</label>
            <select name="jornada" className="form-input" style={{ width: '100%', padding: '0.5rem' }} value={formData.jornada} onChange={handleChange}>
              <option value="">Seleccione Jornada</option>
              {JORNADAS.map(j => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Diagnóstico</label>
            <select name="diagnostico" className="form-input" style={{ width: '100%', padding: '0.5rem' }} value={formData.diagnostico} onChange={handleChange}>
              <option value="">Seleccione Diagnóstico</option>
              {DIAGNOSTICOS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Nombre Apoderado</label>
            <input type="text" name="nombre_apoderado" className="form-input" style={{ width: '100%', padding: '0.5rem' }} value={formData.nombre_apoderado} onChange={handleChange} />
          </div>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Teléfono Apoderado</label>
            <input type="text" name="telefono_apoderado" className="form-input" style={{ width: '100%', padding: '0.5rem' }} value={formData.telefono_apoderado} onChange={handleChange} />
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', padding: '1rem', backgroundColor: 'var(--color-gray-50)', borderRadius: 'var(--radius-md)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>
            <input type="checkbox" name="anamnesis" checked={formData.anamnesis} onChange={handleChange} style={{ width: '1.2rem', height: '1.2rem' }} />
            Anamnesis Completada
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>
            <input type="checkbox" name="prueba_inicial" checked={formData.prueba_inicial} onChange={handleChange} style={{ width: '1.2rem', height: '1.2rem' }} />
            Prueba Inicial Completada
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--color-gray-200)', paddingTop: '1rem' }}>
          <button type="button" className="btn btn-outline" onClick={onClose} style={{ padding: '0.5rem 1rem' }}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={isLoading} style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--color-navy)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)' }}>
            {isLoading ? 'Guardando...' : 'Guardar Estudiante'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
