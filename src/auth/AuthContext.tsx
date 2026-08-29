import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { supabase } from '../db/database';
import { hasPermission, getDefaultRoute, ROLE_LABELS, ROLE_COLORS } from './permissions';
import { User } from '../types';
import { mapPerfil } from '../utils/mappers';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; defaultRoute?: string }>;
  logout: () => Promise<void>;
  can: (permission: string) => boolean;
  isAuthenticated: boolean;
  roleLabel: string;
  roleColor: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserProfile = useCallback(async (userId: string) => {
    const { data, error: profileError } = await supabase
      .from('perfiles')
      .select('*, perfiles_sedes(sede_id)')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('[AuthContext] Error fetching profile:', profileError.message);
      return null;
    }

    const profile = mapPerfil(data);
    return profile.activo ? profile : null;
  }, []);

  useEffect(() => {
    let active = true;

    async function syncSession(userId: string) {
      const profile = await fetchUserProfile(userId);
      if (!active) return;
      if (profile) {
        setUser(profile);
      } else {
        setUser(null);
        await supabase.auth.signOut();
      }
    }

    async function init() {
      setLoading(true);
      setError(null);
      try {
        // 1. Verificar si hay una sesión activa en Supabase Auth
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;

        if (session?.user) {
          // Si el perfil no existe o fue desactivado, se cierra la sesión.
          await syncSession(session.user.id);
        }
      } catch (err: any) {
        console.error('[AuthContext] Critical error during initialization:', err);
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
        // Se difiere para no ejecutar otra llamada Supabase dentro del lock de Auth.
        // Revalida `activo` en cada refresco: una cuenta desactivada pierde la sesión.
        setTimeout(() => { void syncSession(session.user.id); }, 0);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    init();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        console.warn('[Auth] Intento de login fallido:', authError.message);
        return { success: false, error: 'Correo o contraseña incorrectos.' };
      }

      if (data.user) {
        const profile = await fetchUserProfile(data.user.id);
        if (profile) {
          setUser(profile);
          return { success: true, defaultRoute: getDefaultRoute(profile.rol) };
        } else {
          await supabase.auth.signOut();
          return { success: false, error: 'La cuenta no tiene un perfil activo. Contacta al director.' };
        }
      }

      return { success: false, error: 'Error desconocido durante el inicio de sesión.' };
    } catch (err) {
      console.error('[Auth] Login error:', err);
      return { success: false, error: 'Error de conexión.' };
    }
  }, [fetchUserProfile]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const can = useCallback((permission: string) => {
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
