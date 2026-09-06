import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../db/database';
import { hasPermission, getDefaultRoute, ROLE_LABELS, ROLE_COLORS, Permiso } from './permissions';
import { User } from '../types';
import { mapPerfil } from '../utils/mappers';
import {
  anotarActividad, olvidarActividad, restanteDeInactividad, sesionVencidaPorInactividad, iniciarControlDeInactividad,
} from './inactividad';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; defaultRoute?: string }>;
  logout: () => Promise<void>;
  /** `Permiso` y no `string`: un permiso mal escrito no compila. */
  can: (permission: Permiso) => boolean;
  isAuthenticated: boolean;
  roleLabel: string;
  roleColor: string;
  mustChangePassword: boolean;
  changeInitialPassword: (password: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const queryClient = useQueryClient();
  const sessionRevision = useRef(0);
  const authorizationKey = useRef<string | null>(null);
  const sessionUserId = useRef<string | null>(null);
  const closing = useRef(false);

  const clearPrivateState = useCallback(() => {
    sessionRevision.current += 1;
    authorizationKey.current = null;
    sessionUserId.current = null;
    queryClient.clear();
    setUser(null);
    setMustChangePassword(false);
  }, [queryClient]);

  const logout = useCallback(async () => {
    closing.current = true;
    clearPrivateState();
    olvidarActividad();
    try {
      await supabase.auth.signOut();
    } finally {
      closing.current = false;
    }
  }, [clearPrivateState]);

  const fetchUserProfile = useCallback(async (userId: string) => {
    const { data, error: profileError } = await supabase
      .from('perfiles')
      .select('*, perfiles_sedes(sede_id)')
      .eq('id', userId)
      .single();

    if (profileError) {
      if (import.meta.env.DEV) console.error('[AuthContext] Error fetching profile:', profileError.message);
      return null;
    }

    const profile = mapPerfil(data);
    return profile.activo ? profile : null;
  }, []);

  useEffect(() => {
    let active = true;

    async function syncSession(userId: string, passwordRequired: boolean, revision: number) {
      if (!active || closing.current || revision !== sessionRevision.current) return;
      if (sesionVencidaPorInactividad()) {
        await logout();
        return;
      }
      const profile = await fetchUserProfile(userId).catch(() => null);
      if (!active || closing.current || revision !== sessionRevision.current) return;
      if (profile) {
        const nextKey = JSON.stringify([profile.id, profile.rol, [...profile.sedeIds].sort(), passwordRequired]);
        if (authorizationKey.current !== nextKey) {
          queryClient.clear();
          authorizationKey.current = nextKey;
        }
        setMustChangePassword(passwordRequired);
        sessionUserId.current = profile.id;
        setUser(profile);
      } else {
        await logout();
      }
    }

    async function init() {
      const revision = sessionRevision.current;
      setLoading(true);
      setError(null);
      try {
        // 1. Verificar si hay una sesión activa en Supabase Auth
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (!active || revision !== sessionRevision.current) return;
        
        if (sessionError) throw sessionError;

        if (session?.user) {
          // La inactividad se mide contra el reloj, no contra un temporizador
          // en memoria: si no, cerrar la pestaña y volver más tarde reinicia
          // el plazo y la sesión olvidada sigue viva.
          if (sesionVencidaPorInactividad()) {
            await logout();
            return;
          }
          // Si el perfil no existe o fue desactivado, se cierra la sesión.
          await syncSession(session.user.id, Boolean(session.user.app_metadata?.must_change_password), revision);
        }
      } catch (err: any) {
        if (import.meta.env.DEV) console.error('[AuthContext] Critical error during initialization:', err);
        if (active) setError('Error crítico al conectar con el servidor.');
      } finally {
        if (active) setLoading(false);
      }
    }

    // 2. Escuchar cambios en el estado de autenticación. La suscripción vive en
    // el efecto para que su limpieza se ejecute realmente al desmontar.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')
          && session?.user) {
        if (closing.current) return;
        if (sessionUserId.current && sessionUserId.current !== session.user.id) clearPrivateState();
        const revision = ++sessionRevision.current;
        // Se difiere para no ejecutar otra llamada Supabase dentro del lock de Auth.
        // Revalida `activo` en cada refresco: una cuenta desactivada pierde la sesión.
        setTimeout(() => {
          void syncSession(session.user.id, Boolean(session.user.app_metadata?.must_change_password), revision);
        }, 0);
      } else if (event === 'SIGNED_OUT') {
        clearPrivateState();
        olvidarActividad();
      }
    });

    init();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [fetchUserProfile, logout, clearPrivateState, queryClient]);

  // En equipos compartidos, una sesión olvidada no debe quedar abierta todo el
  // día. Cada gesto anota la hora y renueva el plazo; a los 30 minutos se
  // cierra. La marca se guarda para que el plazo sobreviva a cerrar la pestaña
  // —que era justamente el caso que se escapaba— y para que dos pestañas de la
  // misma persona compartan un solo reloj.
  useEffect(() => {
    if (!user) return;

    let timer: ReturnType<typeof setTimeout>;

    const cerrar = () => {
      void logout();
    };

    const programar = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        // Otra pestaña pudo haber registrado actividad mientras esta dormía.
        if (sesionVencidaPorInactividad()) cerrar();
        else programar();
      }, restanteDeInactividad());
    };

    const registrar = () => {
      // Un gesto al volver no puede revivir una sesión que ya venció.
      if (sesionVencidaPorInactividad()) {
        cerrar();
        return;
      }
      anotarActividad();
      programar();
    };

    // `visibilitychange` cubre el caso de volver a una pestaña que estuvo en
    // segundo plano: el navegador puede haber frenado el temporizador.
    const alVolver = () => {
      if (document.visibilityState !== 'visible') return;
      if (sesionVencidaPorInactividad()) cerrar();
      else programar();
    };

    const eventos = ['pointerdown', 'keydown', 'touchstart'] as const;
    eventos.forEach(evento => window.addEventListener(evento, registrar, { passive: true }));
    document.addEventListener('visibilitychange', alVolver);

    // Montar el efecto o refrescar el token no cuenta como actividad humana.
    iniciarControlDeInactividad();
    programar();

    return () => {
      clearTimeout(timer);
      eventos.forEach(evento => window.removeEventListener(evento, registrar));
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [user?.id, logout]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      if (closing.current) return { success: false, error: 'Espera a que termine el cierre de sesión.' };
      anotarActividad();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        if (import.meta.env.DEV) console.warn('[Auth] Intento de login fallido:', authError.message);
        return { success: false, error: 'Correo o contraseña incorrectos.' };
      }

      if (data.user) {
        const revision = sessionRevision.current;
        const profile = await fetchUserProfile(data.user.id);
        if (closing.current || revision !== sessionRevision.current) {
          return { success: false, error: 'La sesión cambió. Vuelve a iniciar sesión.' };
        }
        if (profile) {
          return { success: true, defaultRoute: getDefaultRoute(profile.rol) };
        } else {
          await logout();
          return { success: false, error: 'La cuenta no tiene un perfil activo. Contacta al director.' };
        }
      }

      return { success: false, error: 'Error desconocido durante el inicio de sesión.' };
    } catch (err) {
      if (import.meta.env.DEV) console.error('[Auth] Login error:', err);
      return { success: false, error: 'Error de conexión.' };
    }
  }, [fetchUserProfile, logout]);

  const changeInitialPassword = useCallback(async (password: string) => {
    const revision = sessionRevision.current;
    const { data, error: changeError } = await supabase.functions.invoke('admin-users', {
      body: { action: 'change_initial_password', password },
    });
    if (changeError || !data?.success) {
      return { success: false, error: data?.error || changeError?.message || 'No se pudo cambiar la contraseña.' };
    }
    if (closing.current || revision !== sessionRevision.current) {
      return { success: false, error: 'La sesión cambió. Vuelve a iniciar sesión.' };
    }
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) return { success: false, error: 'La contraseña cambió, pero debes volver a iniciar sesión.' };
    // TOKEN_REFRESHED revalida el perfil y publica el estado de la contraseña.
    return { success: true };
  }, []);

  const can = useCallback((permission: Permiso) => {
    if (!user) return false;
    return hasPermission(user.rol, permission);
  }, [user]);

  const value = {
    user,
    loading,
    error,
    login,
    logout,
    can,
    isAuthenticated: !!user,
    roleLabel: user ? ROLE_LABELS[user.rol] : '',
    roleColor: user ? ROLE_COLORS[user.rol] : '',
    mustChangePassword,
    changeInitialPassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
