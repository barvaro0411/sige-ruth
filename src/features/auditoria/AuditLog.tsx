import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AuditService } from '../../services/auditService';
import { formatDateTime } from '../../utils/dates';
import { useSede } from '../../auth/SedeContext';
import { Search, ChevronDown } from 'lucide-react';
import { AuditLogEntry } from '../../types';

const ACTION_LABELS: Record<string, { label: string; class: string }> = {
  CREAR: { label: 'Creación', class: 'badge-success' },
  MODIFICAR: { label: 'Modificación', class: 'badge-warning' },
  ELIMINAR: { label: 'Eliminación', class: 'badge-danger' },
  CERRAR: { label: 'Cierre Jornada', class: 'badge-info' },
  // En dato clínico, abrir la ficha también se registra.
  CONSULTAR: { label: 'Consulta', class: 'badge-navy' },
};

export default function AuditLog() {
  const { sede } = useSede();
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: logs = [], isLoading } = useQuery<AuditLogEntry[]>({
    queryKey: ['auditoria', sede?.id],
    queryFn: () => AuditService.getAll(sede.id),
    enabled: Boolean(sede?.id),
  });

  const filtered = logs.filter(l =>
    !search ||
    l.usuario.toLowerCase().includes(search.toLowerCase()) ||
    l.entidad.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="skeleton h-100" />
      </div>
    );
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <div>
          <h1 className="page-title">Auditoría</h1>
          <p className="page-subtitle">Registro de acciones del sistema</p>
        </div>
      </header>

      <div className="card mb-6">
        <div className="card-body py-4 px-6">
          <div className="search-container">
            <Search size={18} className="search-icon" />
            <input
              className="search-input"
              placeholder="Buscar por usuario o entidad..."
              value={search}
              onChange={e => setSearch(e.target.value)}
 />
          </div>
        </div>
      </div>

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha/Hora</th>
              <th>Usuario</th>
              <th>Acción</th>
              <th>Entidad</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(log => {
              const actionMeta = ACTION_LABELS[log.accion] || { label: log.accion, class: 'badge-navy' };
              const isExpanded = expandedId === log.id;
              return (
                <tr key={log.id}>
                  <td className="text-sm truncate">{formatDateTime(log.timestamp)}</td>
                  <td className="font-semibold">{log.usuario}</td>
                  <td><span className={`badge ${actionMeta.class}`}>{actionMeta.label}</span></td>
                  <td>{log.entidad}</td>
                  <td>
                    {(log.valorAnterior || log.valorNuevo) && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        aria-label="Ver detalles del log"
                      >
                        <ChevronDown
                          size={14}
                          style={{
                            transform: isExpanded ? 'rotate(180deg)' : '',
                            transition: 'transform 150ms'
                          }}
 />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
