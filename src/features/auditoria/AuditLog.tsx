import { Fragment, useState } from 'react';
import { formatDateTime } from '../../utils/dates';
import { useSede } from '../../config/SedeContext';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '../../auth/permissions';
import { useAuditLogs } from '../../hooks/useSchoolQueries';
import { Search, ChevronDown } from 'lucide-react';

const ACTION_LABELS = {
  CREAR: { label: 'Creacion', class: 'badge-success' },
  MODIFICAR: { label: 'Modificacion', class: 'badge-warning' },
  ELIMINAR: { label: 'Eliminacion', class: 'badge-danger' },
  CERRAR: { label: 'Cierre Jornada', class: 'badge-info' },
};

interface AuditLogItem {
  id: number;
  accion: string;
  entidad: string;
  usuario: string;
  timestamp: string;
  valorAnterior?: unknown;
  valorNuevo?: unknown;
}

function formatJson(value: unknown) {
  if (!value) return 'Sin datos';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function AuditLog() {
  const { sede } = useSede();
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const pageSize = 50;
  const canViewAudit = can(PERMISSIONS.VIEW_AUDIT);
  const { data, isLoading } = useAuditLogs(sede.id, page, pageSize);
  const logs = canViewAudit ? (data?.rows || []) as AuditLogItem[] : [];
  const total = data?.count || 0;
  const hasNextPage = (page + 1) * pageSize < total;

  const filtered = logs.filter(l =>
    !search ||
    l.usuario.toLowerCase().includes(search.toLowerCase()) ||
    l.entidad.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <div className="page-container"><div className="skeleton" style={{height:400}}/></div>;

  return (
    <div className="page-container">
      <header className="page-header">
        <div><h1 className="page-title">Auditoria</h1><p className="page-subtitle">Registro de acciones del sistema</p></div>
      </header>

      <div className="card" style={{marginBottom:'24px'}}>
        <div className="card-body" style={{padding:'16px 24px'}}>
          <div className="search-container">
            <Search size={18} className="search-icon"/>
            <input className="search-input" placeholder="Buscar por usuario o entidad..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
        </div>
      </div>

      <div className="data-table-container">
        <table className="data-table">
          <thead><tr><th>Fecha/Hora</th><th>Usuario</th><th>Accion</th><th>Entidad</th><th>Detalle</th></tr></thead>
          <tbody>
            {filtered.map(log => {
              const actionMeta = ACTION_LABELS[log.accion as keyof typeof ACTION_LABELS] || { label: log.accion, class: 'badge-navy' };
              const hasDetails = Boolean(log.valorAnterior || log.valorNuevo);
              const isExpanded = expandedId === log.id;

              return (
                <Fragment key={log.id}>
                  <tr>
                    <td style={{fontSize:'12px', whiteSpace:'nowrap'}}>{formatDateTime(log.timestamp)}</td>
                    <td style={{fontWeight:600}}>{log.usuario}</td>
                    <td><span className={`badge ${actionMeta.class}`}>{actionMeta.label}</span></td>
                    <td>{log.entidad}</td>
                    <td>
                      {hasDetails && canViewAudit && (
                        <button className="btn btn-ghost btn-sm" onClick={()=>setExpandedId(isExpanded ? null : log.id)} aria-expanded={isExpanded}>
                          <ChevronDown size={14} style={{transform:isExpanded?'rotate(180deg)':'', transition:'transform 150ms'}}/>
                        </button>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={5} style={{ background: 'var(--bg-main)', padding: 16 }}>
                        <div className="audit-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 8 }}>Valor anterior</div>
                            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, margin: 0, maxHeight: 260, overflow: 'auto' }}>{formatJson(log.valorAnterior)}</pre>
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 8 }}>Valor nuevo</div>
                            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, margin: 0, maxHeight: 260, overflow: 'auto' }}>{formatJson(log.valorNuevo)}</pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="pagination-bar">
        <button className="btn btn-outline" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Anterior</button>
        <span>Pagina {page + 1}</span>
        <button className="btn btn-outline" disabled={!hasNextPage} onClick={() => setPage(p => p + 1)}>Siguiente</button>
      </div>
    </div>
  );
}
