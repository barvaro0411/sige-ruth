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
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('[AuthContext] Error fetching profile:', profileError.message);
      return null;
    }

    return mapPerfil(data);
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      setError(null);
      try {
        // 1. Verificar si hay una sesión activa en Supabase Auth
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;

        if (session?.user) {
          const profile = await fetchUserProfile(session.user.id);
          if (profile) {
            setUser(profile);
          } else {
            // Si el perfil no existe, cerrar sesión por consistencia
            await supabase.auth.signOut();
            setUser(null);
          }
        }
      } catch (err: any) {
        console.error('[AuthContext] Critical error during initialization:', err);
        setError('Error crítico al conectar con el servidor.');
      } finally {
        setLoading(false);
      }

      // 2. Escuchar cambios en el estado de autenticación
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const profile = await fetchUserProfile(session.user.id);
          setUser(profile);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    }
    init();
  }, [fetchUserProfile]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        console.warn('[Auth] Intento de login fallido:', authError.message);
        return { success: false, error: authError.message };
      }

      if (data.user) {
        const profile = await fetchUserProfile(data.user.id);
        if (profile) {
          setUser(profile);
          return { success: true, defaultRoute: getDefaultRoute(profile.rol) };
        } else {
          return { success: false, error: 'No se encontró perfil asociado a este usuario.' };
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
