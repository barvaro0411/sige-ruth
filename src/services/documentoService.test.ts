import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentoService } from './documentoService';
import { supabase } from '../db/database';

vi.mock('../db/database', () => ({
  supabase: {
    storage: {
      from: vi.fn(),
    },
    from: vi.fn(),
  },
}));

function createFile(type: string, size = 12) {
  return new File([new Uint8Array(size)], 'documento.pdf', { type });
}

describe('DocumentoService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rechaza tipos MIME no permitidos antes de llamar a Supabase', async () => {
    await expect(
      DocumentoService.upload(createFile('text/plain'), 1, 'sede-1', 'user-1'),
    ).rejects.toThrow('Tipo de archivo no permitido');

    expect(supabase.storage.from).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('rechaza archivos mayores a 5MB antes de llamar a Supabase', async () => {
    await expect(
      DocumentoService.upload(createFile('application/pdf', 5 * 1024 * 1024 + 1), 1, 'sede-1', 'user-1'),
    ).rejects.toThrow('demasiado grande');

    expect(supabase.storage.from).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('registra metadata con subido_por despues de subir el archivo', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const single = vi.fn().mockResolvedValue({ data: { id: 'doc-1' }, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));

    vi.mocked(supabase.storage.from).mockReturnValue({ upload } as any);
    vi.mocked(supabase.from).mockReturnValue({ insert } as any);

    await expect(
      DocumentoService.upload(createFile('application/pdf'), 10, 'vascongados', 'user-123'),
    ).resolves.toEqual({ id: 'doc-1' });

    expect(upload).toHaveBeenCalledOnce();
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      estudiante_id: 10,
      sede_id: 'vascongados',
      subido_por: 'user-123',
    }));
  });
});
