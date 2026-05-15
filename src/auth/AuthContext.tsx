import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '../db/database';
import { hasPermission, getDefaultRoute, ROLE_LABELS, ROLE_COLORS } from './permissions';
import { User } from '../types';
import { mapPerfil } from '../utils/mappers';

const AUTH_INIT_TIMEOUT_MS = 30000;
const CONNECTION_TIMEOUT_MESSAGE = 'La conexión está tardando demasiado. Revisa tu conexión a internet.';

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    }),
  ]).finally(() => {
    clearTimeout(timeoutId);
  });
}

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
  const profileRequestsRef = useRef(new Map<string, Promise<User | null>>());

  const fetchUserProfile = useCallback(async (userId: string) => {
    const existingRequest = profileRequestsRef.current.get(userId);
    if (existingRequest) return existingRequest;

    const request = (async () => {
      const { data, error: profileError } = await supabase
        .from('perfiles')
        .select('id,email,nombre,rol,activo,sede_id,created_at')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('[AuthContext] Error fetching profile:', profileError.message);
        return null;
      }

      const profile = mapPerfil(data);
      if (!profile.activo) {
        console.warn('[AuthContext] Perfil inactivo:', profile.email);
        return null;
      }

      return profile;
    })().finally(() => {
      profileRequestsRef.current.delete(userId);
    });

    profileRequestsRef.current.set(userId, request);
    return request;
  }, []);

  useEffect(() => {
    let isMounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await fetchUserProfile(session.user.id);
        if (isMounted) {
          setUser(profile);
          setError(null);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setError(null);
      }
    });

    async function init() {
      setLoading(true);
      setError(null);

      try {
        const { data: { session }, error: sessionError } = await withTimeout(
          supabase.auth.getSession(),
          AUTH_INIT_TIMEOUT_MS,
          CONNECTION_TIMEOUT_MESSAGE,
        );

        if (sessionError) {
          console.error('[AuthContext] Session error:', sessionError.message);
          throw sessionError;
        }

        if (isMounted) setError(null);

        if (session?.user) {
          const profile = await fetchUserProfile(session.user.id);
          if (profile) {
            if (isMounted) {
              setUser(profile);
              setError(null);
            }
          } else {
            console.warn('[AuthContext] No profile found, signing out...');
            await supabase.auth.signOut();
            if (isMounted) {
              setUser(null);
              setError(null);
            }
          }
        } else {
          if (isMounted) setError(null);
        }
      } catch (err: any) {
        console.error('[AuthContext] Critical error during initialization:', err);
        if (isMounted) {
          const message =
            err?.message === CONNECTION_TIMEOUT_MESSAGE
              ? CONNECTION_TIMEOUT_MESSAGE
              : 'Error crítico al conectar con el servidor.';
          setError(message);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    init();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      setError(null);
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
          setError(null);
          return { success: true, defaultRoute: getDefaultRoute(profile.rol) };
        } else {
          await supabase.auth.signOut();
          setUser(null);
          setError(null);
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
