import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Send, Trash2, TriangleAlert } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useSede } from '../../auth/SedeContext';
import { useToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import { AdjuntoService, comprimirFoto } from '../../services/adjuntoService';
import { ETIQUETA_PRIORIDAD, MantencionService } from '../../services/mantencionService';
import { PrioridadMantencion } from '../../types';

const PRIORIDADES: PrioridadMantencion[] = ['baja', 'media', 'alta', 'urgente'];

const COLOR_PRIORIDAD: Record<PrioridadMantencion, string> = {
  baja: 'var(--navy-600)',
  media: 'var(--color-info)',
  alta: 'var(--color-warning)',
  urgente: 'var(--color-danger)',
};

const FORM_VACIO = {
  lugar: '',
  categoriaId: 0,
  descripcion: '',
  prioridad: 'media' as PrioridadMantencion,
};

/**
 * Reportar un problema.
 *
 * Se usa de pie, con una mano, delante de la cosa rota. Por eso son cinco
 * campos y ninguno opcional de más: dónde, qué categoría, qué pasa, qué tan
 * urgente y una foto.
 *
 * La foto se comprime a WebP antes de subir — acá se sube con datos móviles y
 * muchas veces desde el patio.
 */
export default function ReportarProblema({
  abierto, onCerrar,
}: {
  abierto: boolean;
  onCerrar: () => void;
}) {
  const { user } = useAuth();
  const { sede } = useSede();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const inputFoto = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState(FORM_VACIO);
  const [foto, setFoto] = useState<File | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const [error, setError] = useState('');

  const { data: categorias = [] } = useQuery({
    queryKey: ['mantencion-categorias'],
    queryFn: MantencionService.getCategorias,
  });

  function limpiar() {
    setForm(FORM_VACIO);
    setFoto(null);
    setVistaPrevia(previa => { if (previa) URL.revokeObjectURL(previa); return null; });
    setError('');
  }

  async function elegirFoto(archivo: File | undefined) {
    if (!archivo) return;
    const comprimida = await comprimirFoto(archivo);
    setFoto(comprimida);
    setVistaPrevia(previa => {
      if (previa) URL.revokeObjectURL(previa);
      return URL.createObjectURL(comprimida);
    });
  }

  const reportar = useMutation({
    mutationFn: async () => {
      const id = await MantencionService.reportar({
        sedeId: sede.id,
        categoriaId: form.categoriaId,
        lugar: form.lugar,
        descripcion: form.descripcion,
        prioridad: form.prioridad,
      });

      // La incidencia ya quedó registrada. Si la foto falla —señal mala, archivo
      // raro— no se pierde el reporte: se avisa y listo.
      if (foto && user) {
        try {
          await AdjuntoService.subir(foto, {
            origen: 'mantencion',
            origenId: id,
            sedeId: sede.id,
            subidoPor: user.id,
            momento: 'antes',
          });
        } catch {
          addToast('El reporte se envió, pero la foto no se pudo subir', 'warning');
        }
      }
      return id;
    },
    onSuccess: () => {
      addToast('Reporte enviado. Mantención ya lo tiene.', 'success');
      limpiar();
      onCerrar();
      queryClient.invalidateQueries({ queryKey: ['mantenciones'] });
      queryClient.invalidateQueries({ queryKey: ['panel-operaciones'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  function enviar() {
    setError('');
    if (form.lugar.trim().length < 2) {
      setError('Indica dónde está el problema'); return;
    }
    if (!form.categoriaId) {
      setError('Elige una categoría'); return;
    }
    if (form.descripcion.trim().length < 5) {
      setError('Describe qué pasa, aunque sea en una línea'); return;
    }
    reportar.mutate();
  }

  return (
    <Modal
      isOpen={abierto}
      onClose={() => { limpiar(); onCerrar(); }}
      title="Reportar un problema"
      size="md"
      footer={
        <>
          <button className="btn btn-outline" onClick={() => { limpiar(); onCerrar(); }}>
            Cancelar
          </button>
          <button className="btn btn-gold" onClick={enviar} disabled={reportar.isPending}>
            <Send size={17} /> {reportar.isPending ? 'Enviando…' : 'Enviar reporte'}
          </button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: '16px' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" htmlFor="mant-lugar">¿Dónde?</label>
          <input
            id="mant-lugar" className="form-input" autoFocus
            placeholder="Baño de niños, sala NT1, patio…"
            value={form.lugar}
            onChange={e => setForm({ ...form, lugar: e.target.value })}
          />
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" htmlFor="mant-categoria">¿De qué se trata?</label>
          <select
            id="mant-categoria" className="form-input"
            value={form.categoriaId}
            onChange={e => setForm({ ...form, categoriaId: Number(e.target.value) })}
          >
            <option value={0}>Elige una categoría</option>
            {categorias.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" htmlFor="mant-descripcion">¿Qué pasa?</label>
          <textarea
            id="mant-descripcion" className="form-textarea" rows={3}
            placeholder="La llave del lavamanos gotea todo el día"
            value={form.descripcion}
            onChange={e => setForm({ ...form, descripcion: e.target.value })}
          />
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <span className="form-label">¿Qué tan urgente?</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
            {PRIORIDADES.map(p => {
              const activa = form.prioridad === p;
              return (
                <button
                  key={p} type="button"
                  onClick={() => setForm({ ...form, prioridad: p })}
                  style={{
                    minHeight: 48, borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    fontWeight: 800, fontSize: '13px', fontFamily: 'inherit',
                    border: `1.5px solid ${activa ? COLOR_PRIORIDAD[p] : 'var(--border-medium)'}`,
                    background: activa ? COLOR_PRIORIDAD[p] : 'var(--bg-card)',
                    color: activa ? 'white' : 'var(--text-muted)',
                  }}
                  aria-pressed={activa}
                >
                  {ETIQUETA_PRIORIDAD[p]}
                </button>
              );
            })}
          </div>
          {form.prioridad === 'urgente' && (
            <p style={{
              display: 'flex', gap: '6px', alignItems: 'center',
              fontSize: '12px', color: 'var(--color-danger)', marginTop: '8px',
            }}>
              <TriangleAlert size={14} /> Urgente le llega a dirección y a mantención de inmediato.
            </p>
          )}
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <span className="form-label">Una foto ayuda (opcional)</span>
          <input
            ref={inputFoto} type="file" accept="image/*" capture="environment"
            style={{ display: 'none' }}
            onChange={e => elegirFoto(e.target.files?.[0])}
          />

          {vistaPrevia ? (
            <div style={{ position: 'relative' }}>
              <img
                src={vistaPrevia} alt="Foto del problema"
                style={{
                  width: '100%', maxHeight: 240, objectFit: 'cover',
                  borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)',
                }}
              />
              <button
                type="button" className="btn btn-outline btn-sm"
                style={{ position: 'absolute', top: 8, right: 8, background: 'var(--bg-card)' }}
                onClick={() => { setFoto(null); setVistaPrevia(p => { if (p) URL.revokeObjectURL(p); return null; }); }}
              >
                <Trash2 size={15} /> Quitar
              </button>
              {foto && (
                <p className="text-muted" style={{ fontSize: '12px', marginTop: '6px' }}>
                  {Math.round(foto.size / 1024)} KB tras comprimir
                </p>
              )}
            </div>
          ) : (
            <button
              type="button" className="btn btn-outline"
              style={{ width: '100%', minHeight: 48 }}
              onClick={() => inputFoto.current?.click()}
            >
              <Camera size={18} /> Tomar o elegir foto
            </button>
          )}
        </div>

        {error && (
          <p style={{ color: 'var(--color-danger)', fontSize: '13px', margin: 0 }}>{error}</p>
        )}
      </div>
    </Modal>
  );
}
