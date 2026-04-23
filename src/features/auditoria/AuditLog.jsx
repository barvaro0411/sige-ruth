import { useState, useEffect } from 'react';
import { AuditService } from '../../services/auditService';
import { formatDateTime } from '../../utils/dates';
import { useSede } from '../../config/SedeContext';
import { Shield, Search, ChevronDown } from 'lucide-react';

const ACTION_LABELS = {
  CREAR: { label: 'Creación', class: 'badge-success' },
  MODIFICAR: { label: 'Modificación', class: 'badge-warning' },
  ELIMINAR: { label: 'Eliminación', class: 'badge-danger' },
  CERRAR: { label: 'Cierre Jornada', class: 'badge-info' },
};

export default function AuditLog() {
  const { sede } = useSede();
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => { loadLogs(); }, [sede.id]);

  async function loadLogs() {
    setLoading(true);
    try {
      const data = await AuditService.getAll(sede.id);
      setLogs(data);
    } finally {
      setLoading(false);
    }
  }

  const filtered = logs.filter(l => 
    !search || 
    l.usuario.toLowerCase().includes(search.toLowerCase()) || 
    l.entidad.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="page-container"><div className="skeleton" style={{height:400}}/></div>;

  return (
    <div className="page-container">
      <header className="page-header">
        <div><h1 className="page-title">Auditoría</h1><p className="page-subtitle">Registro de acciones del sistema</p></div>
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
          <thead><tr><th>Fecha/Hora</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>Detalle</th></tr></thead>
          <tbody>
            {filtered.map(log => {
              const actionMeta = ACTION_LABELS[log.accion] || { label: log.accion, class: 'badge-navy' };
              return (
                <tr key={log.id}>
                  <td style={{fontSize:'12px', whiteSpace:'nowrap'}}>{formatDateTime(log.timestamp)}</td>
                  <td style={{fontWeight:600}}>{log.usuario}</td>
                  <td><span className={`badge ${actionMeta.class}`}>{actionMeta.label}</span></td>
                  <td>{log.entidad}</td>
                  <td>
                    {(log.valorAnterior || log.valorNuevo) && (
                      <button className="btn btn-ghost btn-sm" onClick={()=>setExpandedId(expandedId===log.id?null:log.id)}>
                        <ChevronDown size={14} style={{transform:expandedId===log.id?'rotate(180deg)':'', transition:'transform 150ms'}}/>
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
