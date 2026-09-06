import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, Plus, ShieldCheck, UserCheck, UserX, Users } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { ROLE_LABELS, esRolTransversal } from '../../auth/permissions';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { useSede } from '../../auth/SedeContext';
import { Sede } from '../../types';
import { ActualizarUsuario, NuevoUsuario, PerfilUsuario, UsuarioService } from '../../services/usuarioService';

const ROLES: PerfilUsuario['rol'][] = [
  'director', 'sostenedor', 'secretaria', 'docente', 'fonoaudiologo', 'jefe_utp',
  'aseo', 'bodega', 'mantencion',
];

const EMPTY_CREATE: NuevoUsuario = {
  nombre: '',
  email: '',
  password: '',
  rol: 'docente',
  sede_ids: [],
};

export default function UsuariosModule() {
  const { user } = useAuth();
  const { availableSedes } = useSede();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<NuevoUsuario>(EMPTY_CREATE);
  const [editing, setEditing] = useState<PerfilUsuario | null>(null);
  const [editForm, setEditForm] = useState<ActualizarUsuario | null>(null);
  const [formError, setFormError] = useState('');

  const { data: perfiles = [], isLoading, error } = useQuery({
    queryKey: ['perfiles'],
    queryFn: UsuarioService.getAll,
  });

  useEffect(() => {
    if (!editing) {
      setEditForm(null);
      return;
    }
    setEditForm({
      nombre: editing.nombre,
      rol: editing.rol,
      sede_ids: editing.sede_ids,
      activo: editing.activo,
    });
    setFormError('');
  }, [editing]);

  const createMutation = useMutation({
    mutationFn: UsuarioService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['perfiles'] });
      addToast('Usuario creado correctamente', 'success');
      setShowCreate(false);
      setCreateForm(EMPTY_CREATE);
      setFormError('');
    },
    onError: (err: Error) => addToast(err.message || 'No se pudo crear el usuario', 'danger'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: NonNullable<typeof editForm> }) =>
      UsuarioService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['perfiles'] });
      addToast('Usuario actualizado correctamente', 'success');
      setEditing(null);
    },
    onError: (err: Error) => addToast(err.message || 'No se pudo actualizar el usuario', 'danger'),
  });

  function validateProfile(nombre: string, rol: PerfilUsuario['rol'], sedeIds: string[]) {
    if (nombre.trim().length < 3) return 'Ingresa el nombre completo del usuario.';
    if (!esRolTransversal(rol) && sedeIds.length === 0) return 'Asigna al menos una sede a este usuario.';
    return '';
  }

  function submitCreate(event: FormEvent) {
    event.preventDefault();
    const validationError = validateProfile(createForm.nombre, createForm.rol, createForm.sede_ids);
    if (validationError) return setFormError(validationError);
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/.test(createForm.password)) {
      return setFormError('Usa al menos 12 caracteres, con mayúscula, minúscula, número y símbolo.');
    }

    setFormError('');
    createMutation.mutate({
      ...createForm,
      nombre: createForm.nombre.trim(),
      email: createForm.email.trim().toLowerCase(),
      sede_ids: esRolTransversal(createForm.rol) ? [] : createForm.sede_ids,
    });
  }

  function submitEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing || !editForm) return;
    const validationError = validateProfile(editForm.nombre, editForm.rol, editForm.sede_ids);
    if (validationError) return setFormError(validationError);
    if (editing.id === user?.id && !editForm.activo) return setFormError('No puedes desactivar tu propia cuenta.');

    setFormError('');
    updateMutation.mutate({ id: editing.id, payload: editForm });
  }

  if (isLoading) return <div className="page-container"><div className="skeleton h-100" /></div>;

  return (
    <div className="page-container animate-in">
      <header className="page-header mb-8">
        <div>
          <h1 className="page-title">Administración de Usuarios</h1>
          <p className="page-subtitle">Roles, sedes y acceso del personal</p>
        </div>
        <button className="btn btn-gold" onClick={() => { setShowCreate(true); setFormError(''); }}>
          <Plus size={18} /> Nuevo usuario
        </button>
      </header>

      {error ? (
        <div className="card p-8 text-danger">
          No se pudo cargar el listado de usuarios.
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr><th>Usuario</th><th>Rol</th><th>Sede</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {perfiles.map(perfil => (
                <tr key={perfil.id}>
                  <td>
                    <div className="font-bold">{perfil.nombre}</div>
                    <div className="text-sm text-muted">{perfil.email}</div>
                  </td>
                  <td><span className="badge badge-navy"><ShieldCheck size={13} /> {ROLE_LABELS[perfil.rol]}</span></td>
                  <td>{esRolTransversal(perfil.rol)
                    ? 'Todas las sedes'
                    : perfil.sede_ids.map(id => availableSedes.find(s => s.id === id)?.nombre || id).join(', ') || 'Sin sede'}</td>
                  <td>
                    <span className={`badge ${perfil.activo ? 'badge-success' : 'badge-danger'}`}>
                      {perfil.activo ? <UserCheck size={13} /> : <UserX size={13} />}
                      {perfil.activo ? 'Activo' : 'Bloqueado'}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" title="Editar usuario" onClick={() => setEditing(perfil)}>
                      <Edit2 size={16} /> Editar
                    </button>
                  </td>
                </tr>
              ))}
              {perfiles.length === 0 && (
                <tr><td colSpan={5} className="text-center p-12"><Users size={32} /> Sin usuarios registrados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => !createMutation.isPending && setShowCreate(false)} title="Crear usuario" size="lg">
        <form onSubmit={submitCreate}>
          {formError && <div className="login-error mb-4" role="alert">{formError}</div>}
          <UserFields
            nombre={createForm.nombre}
            rol={createForm.rol}
            sedeIds={createForm.sede_ids}
            sedes={availableSedes}
            disabled={createMutation.isPending}
            onNombre={nombre => setCreateForm(prev => ({ ...prev, nombre }))}
            onRol={rol => setCreateForm(prev => ({ ...prev, rol, sede_ids: esRolTransversal(rol) ? [] : prev.sede_ids }))}
            onSedes={sede_ids => setCreateForm(prev => ({ ...prev, sede_ids }))}
 />
          <div className="grid grid-2 gap-4 mt-4">
            <div className="form-group">
              <label className="form-label">Correo *</label>
              <input required type="email" className="form-input" autoComplete="off" disabled={createMutation.isPending} value={createForm.email} onChange={e => setCreateForm(prev => ({ ...prev, email: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Contraseña temporal *</label>
              <input required minLength={12} type="password" className="form-input" autoComplete="new-password" disabled={createMutation.isPending} value={createForm.password} onChange={e => setCreateForm(prev => ({ ...prev, password: e.target.value }))} />
            </div>
          </div>
          <ModalActions pending={createMutation.isPending} onCancel={() => setShowCreate(false)} submitLabel="Crear usuario" />
        </form>
      </Modal>

      <Modal isOpen={!!editing} onClose={() => !updateMutation.isPending && setEditing(null)} title="Editar usuario" size="lg">
        {editing && editForm && (
          <form onSubmit={submitEdit}>
            {formError && <div className="login-error mb-4" role="alert">{formError}</div>}
            <UserFields
              nombre={editForm.nombre}
              rol={editForm.rol}
              sedeIds={editForm.sede_ids}
              sedes={availableSedes}
              disabled={updateMutation.isPending}
              lockAccess={editing.id === user?.id}
              onNombre={nombre => setEditForm(prev => prev && ({ ...prev, nombre }))}
              onRol={rol => setEditForm(prev => prev && ({ ...prev, rol, sede_ids: esRolTransversal(rol) ? [] : prev.sede_ids }))}
              onSedes={sede_ids => setEditForm(prev => prev && ({ ...prev, sede_ids }))}
 />
            <label className="flex items-center gap-2 mt-5 font-bold">
              <input
                type="checkbox"
                checked={editForm.activo}
                disabled={updateMutation.isPending || editing.id === user?.id}
                onChange={e => setEditForm(prev => prev && ({ ...prev, activo: e.target.checked }))}
 />
              Usuario activo
            </label>
            <ModalActions pending={updateMutation.isPending} onCancel={() => setEditing(null)} submitLabel="Guardar cambios" />
          </form>
        )}
      </Modal>
    </div>
  );
}

interface UserFieldsProps {
  nombre: string;
  rol: PerfilUsuario['rol'];
  sedeIds: string[];
  sedes: Sede[];
  disabled: boolean;
  lockAccess?: boolean;
  onNombre: (value: string) => void;
  onRol: (value: PerfilUsuario['rol']) => void;
  onSedes: (value: string[]) => void;
}

function UserFields({ nombre, rol, sedeIds, sedes, disabled, lockAccess = false, onNombre, onRol, onSedes }: UserFieldsProps) {
  const toggleSede = (sedeId: string) => {
    onSedes(sedeIds.includes(sedeId)
      ? sedeIds.filter(id => id !== sedeId)
      : [...sedeIds, sedeId]);
  };

  return (
    <div className="grid grid-2 gap-4">
      <div className="form-group">
        <label className="form-label">Nombre completo *</label>
        <input required className="form-input" disabled={disabled} value={nombre} onChange={e => onNombre(e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Rol *</label>
        <select className="form-select" disabled={disabled || lockAccess} value={rol} onChange={e => onRol(e.target.value as PerfilUsuario['rol'])}>
          {ROLES.map(item => <option key={item} value={item}>{ROLE_LABELS[item]}</option>)}
        </select>
      </div>
      <div className="form-group col-span-full">
        <label className="form-label">Sedes autorizadas *</label>
        {esRolTransversal(rol) ? (
          <div className="p-3 rounded-md bg-main font-bold">
            {ROLE_LABELS[rol]} tiene acceso a todas las sedes.
          </div>
        ) : (
          <div className="flex gap-3 flex-wrap">
            {sedes.map(item => (
              <label key={item.id} className="flex items-center gap-2 py-3 px-4 border rounded-md font-bold">
                <input
                  type="checkbox"
                  checked={sedeIds.includes(item.id)}
                  disabled={disabled || lockAccess}
                  onChange={() => toggleSede(item.id)}
 />
                {item.nombre}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ModalActions({ pending, onCancel, submitLabel }: { pending: boolean; onCancel: () => void; submitLabel: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '28px', paddingTop: '18px', borderTop: '1px solid var(--border-light)' }}>
      <button type="button" className="btn btn-outline" disabled={pending} onClick={onCancel}>Cancelar</button>
      <button type="submit" className="btn btn-gold" disabled={pending}>{pending ? 'Guardando...' : submitLabel}</button>
    </div>
  );
}
