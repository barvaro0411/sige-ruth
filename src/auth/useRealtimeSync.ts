import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../db/database';
import { useAuth } from './AuthContext';
import { useSedeStatus } from './SedeContext';

/**
 * useRealtimeSync
 * 
 * Gestiona las suscripciones de Supabase Realtime para mantener
 * sincronizadas en vivo las notificaciones y bandejas de trabajo sin sondeos pesados.
 */
export function useRealtimeSync() {
  const { user } = useAuth();
  const { sede } = useSedeStatus();
  const queryClient = useQueryClient();

  // 1. Canal de notificaciones personales
  useEffect(() => {
    if (!user?.id) return;

    const channelName = `realtime-notificaciones-${user.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notificaciones',
          filter: `destinatario_id=eq.${user.id}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // 2. Canal de eventos operativos de la sede
  useEffect(() => {
    if (!user?.id || !sede?.id) return;

    const channelName = `realtime-sede-${sede.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mantenciones',
          filter: `sede_id=eq.${sede.id}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['mantenciones'] });
          void queryClient.invalidateQueries({ queryKey: ['operaciones'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'solicitudes_permiso',
          filter: `sede_id=eq.${sede.id}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['permisos'] });
          void queryClient.invalidateQueries({ queryKey: ['operaciones'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'solicitudes_materiales',
          filter: `sede_id=eq.${sede.id}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['materiales'] });
          void queryClient.invalidateQueries({ queryKey: ['frecuentes'] });
          void queryClient.invalidateQueries({ queryKey: ['operaciones'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recursos_prestamos',
          filter: `sede_id=eq.${sede.id}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['prestamos'] });
          void queryClient.invalidateQueries({ queryKey: ['operaciones'] });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, sede?.id, queryClient]);
}
