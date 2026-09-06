import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import EstudiantesList from './estudiantes/EstudiantesList';
import ReportesModule from './reportes/ReportesModule';
import FonoaudiologiaModule from './fonoaudiologia/FonoaudiologiaModule';

const mocks = vi.hoisted(() => ({
  download: vi.fn(), toast: vi.fn(), audit: vi.fn(), products: vi.fn(),
  alumnos: [{ id: 1, rut: '', nombre: 'Alumno', apellidoPaterno: 'Prueba', apellidoMaterno: '', nivel: 'NT1', jornada: 'Mañana' }],
}));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'test' }, can: () => true }) }));
vi.mock('../auth/SedeContext', () => ({ useSede: () => ({ sede: { id: 'test', nombre: 'Sede de prueba' } }) }));
vi.mock('../components/Toast', () => ({ useToast: () => ({ addToast: mocks.toast }) }));
vi.mock('../components/Modal', () => ({ default: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) => isOpen ? children : null }));
vi.mock('../utils/excel', () => ({ downloadExcel: mocks.download }));
vi.mock('../services/inventarioService', () => ({ InventarioService: { getProductos: mocks.products } }));
vi.mock('../services/fonoService', () => ({ FonoService: { registrarConsulta: mocks.audit } }));
vi.mock('./fonoaudiologia/FonoEvolutionChart', () => ({ default: () => null }));
vi.mock('../db/database', () => ({
  supabase: { from: () => ({ select: () => ({ eq: async () => ({ data: [], error: null }) }) }) },
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    isLoading: false,
    data: queryKey[0] === 'estudiantes' ? mocks.alumnos : [{
      id: 1, estudiante_id: 1, fecha: new Date().toISOString().slice(0, 10),
      actividad_realizada: 'Actividad de prueba', nivel_fonetico: 1, nivel_semantico: 1,
      nivel_morfosintactico: 1, nivel_pragmatico: 1,
    }],
  }),
  useMutation: () => ({ isPending: false, mutate: vi.fn() }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

let root: ReactTestRenderer;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.products.mockResolvedValue([]);
  mocks.audit.mockResolvedValue(undefined);
});
afterEach(async () => { if (root) await act(async () => root.unmount()); });

describe('integración de matrícula y clínica con las protecciones de seguridad', () => {
  it('la nómina espera la descarga antes de confirmar el éxito', async () => {
    let finish!: () => void;
    mocks.download.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
    await act(async () => { root = create(<EstudiantesList />); });
    let pending!: Promise<void>;
    await act(async () => {
      pending = root.root.findByProps({ title: 'Descargar nómina en formato Excel (.xlsx)' }).props.onClick();
    });
    expect(mocks.download).toHaveBeenCalledOnce();
    expect(mocks.toast).not.toHaveBeenCalled();
    await act(async () => { finish(); await pending; });
    expect(mocks.toast).toHaveBeenCalledWith('Nómina oficial exportada a Excel', 'success');
  });

  it('una descarga fallida de matrícula muestra el error sin confirmar éxito', async () => {
    mocks.download.mockRejectedValue(new Error('compresión fallida'));
    await act(async () => { root = create(<EstudiantesList />); });
    await act(async () => {
      await root.root.findByProps({ title: 'Descargar nómina en formato Excel (.xlsx)' }).props.onClick();
    });
    expect(mocks.toast).toHaveBeenCalledWith(expect.any(String), 'danger');
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.any(String), 'success');
  });

  it('conserva los cinco reportes y mantiene sus botones bloqueados durante la descarga', async () => {
    let finish!: () => void;
    mocks.download.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
    await act(async () => { root = create(<ReportesModule />); });
    expect(root.root.findAllByType('article')).toHaveLength(5);
    await act(async () => {
      root.root.findAllByType('article')[2].findAllByType('button')[0].props.onClick();
    });
    expect(mocks.download).toHaveBeenCalledWith(expect.any(String), 'Inventario y Stock', expect.any(Array));
    expect(root.root.findAllByType('button').every(button => button.props.disabled)).toBe(true);
    expect(mocks.toast).not.toHaveBeenCalled();
    await act(async () => { finish(); });
    expect(mocks.toast).toHaveBeenCalledWith(expect.any(String), 'success');
  });

  it('el botón de evolución conserva la auditoría de consulta clínica', async () => {
    await act(async () => { root = create(<FonoaudiologiaModule />); });
    expect(root.root.findByProps({ 'aria-label': 'Filtrar por estudiante' })).toBeDefined();
    await act(async () => {
      root.root.findByProps({ title: 'Ver Evolución Gráfica' }).props.onClick();
    });
    expect(mocks.audit).toHaveBeenCalledWith(1);
  });
});
