import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode,
} from 'react';
import { SedeService } from '../services/sedeService';
import { useAuth } from '../auth/AuthContext';
import { esRolTransversal } from '../auth/permissions';
import { Sede } from '../types';

/**
 * SedeContext
 * Sede activa de la sesión, leída de la tabla `sedes`.
 *
 * Va por dentro de AuthProvider a propósito: la RLS de `sedes` exige sesión
 * activa, así que una consulta anterior al login vuelve vacía.
 */

const CLAVE_SEDE = 'sige_current_sede';

interface SedeState {
  sede: Sede | null;
  setSede: (sede: Sede) => void;
  /** Sedes que este usuario tiene autorizadas. */
  availableSedes: Sede[];
  loading: boolean;
  error: string | null;
}

const SedeContext = createContext<SedeState | null>(null);

export function SedeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [todas, setTodas] = useState<Sede[]>([]);
  const [sedeId, setSedeId] = useState<string | null>(
    () => localStorage.getItem(CLAVE_SEDE)
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setTodas([]);
      setLoading(false);
      return;
    }

    let vigente = true;
    setLoading(true);
    setError(null);

    SedeService.getActivas()
      .then(sedes => {
        if (!vigente) return;
        setTodas(sedes);
      })
      .catch(err => {
        if (!vigente) return;
        console.error('[SedeContext] No se pudieron cargar las sedes:', err);
        setError('No se pudieron cargar las sedes.');
      })
      .finally(() => {
        if (vigente) setLoading(false);
      });

    return () => { vigente = false; };
  }, [user]);

  const availableSedes = useMemo(() => {
    if (!user) return [];
    if (esRolTransversal(user.rol)) return todas;
    return todas.filter(s => user.sedeIds.includes(s.id));
  }, [todas, user]);

  // La sede guardada puede ser de otro usuario, o haberse dado de baja.
  // Cuando no es válida se cae a la primera autorizada.
  const sede = useMemo(() => {
    if (availableSedes.length === 0) return null;
    return availableSedes.find(s => s.id === sedeId) ?? availableSedes[0];
  }, [availableSedes, sedeId]);

  useEffect(() => {
    if (sede && sede.id !== sedeId) {
      setSedeId(sede.id);
      localStorage.setItem(CLAVE_SEDE, sede.id);
    }
  }, [sede, sedeId]);

  const setSede = useCallback((nueva: Sede) => {
    setSedeId(nueva.id);
    localStorage.setItem(CLAVE_SEDE, nueva.id);
  }, []);

  const value = useMemo(
    () => ({ sede, setSede, availableSedes, loading, error }),
    [sede, setSede, availableSedes, loading, error]
  );

  return <SedeContext.Provider value={value}>{children}</SedeContext.Provider>;
}

/** Estado completo, incluida la carga. Lo usa el layout para decidir qué montar. */
export function useSedeStatus(): SedeState {
  const context = useContext(SedeContext);
  if (!context) throw new Error('useSedeStatus debe usarse dentro de SedeProvider');
  return context;
}

/**
 * Para las pantallas, que solo se montan una vez resuelta la sede.
 * Devuelve `sede` ya garantizada, para no arrastrar comprobaciones de null
 * por todos los módulos.
 */
export function useSede(): { sede: Sede; setSede: (s: Sede) => void; availableSedes: Sede[] } {
  const { sede, setSede, availableSedes } = useSedeStatus();
  if (!sede) {
    throw new Error('useSede se usó fuera del área autenticada: la sede aún no está resuelta');
  }
  return { sede, setSede, availableSedes };
}
