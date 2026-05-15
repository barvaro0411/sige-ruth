import { useQuery } from '@tanstack/react-query';
import { AsistenciaService } from '../services/asistenciaService';
import { AuditService } from '../services/auditService';
import { CursoService } from '../services/cursoService';
import { DashboardService } from '../services/dashboardService';
import { EstudianteService } from '../services/estudianteService';
import { FonoService } from '../services/fonoService';

export const schoolQueryKeys = {
  estudiantes: (sedeId: string) => ['estudiantes', sedeId] as const,
  cursos: (sedeId: string) => ['cursos', sedeId] as const,
  asistencia: (sedeId: string, fecha: string) => ['asistencia', sedeId, fecha] as const,
  dashboard: (sedeId: string) => ['dashboard', sedeId] as const,
  sesionesFono: (sedeId: string) => ['sesiones_fono', sedeId] as const,
  audit: (sedeId: string, page: number, pageSize: number) => ['audit', sedeId, page, pageSize] as const,
};

export function useEstudiantesBySede(sedeId: string) {
  return useQuery({
    queryKey: schoolQueryKeys.estudiantes(sedeId),
    queryFn: () => EstudianteService.getAllBySede(sedeId),
    enabled: Boolean(sedeId),
  });
}

export function useCursosBySede(sedeId: string) {
  return useQuery({
    queryKey: schoolQueryKeys.cursos(sedeId),
    queryFn: () => CursoService.getBySede(sedeId),
    enabled: Boolean(sedeId),
  });
}

export function useAsistenciaByFecha(sedeId: string, fecha: string) {
  return useQuery({
    queryKey: schoolQueryKeys.asistencia(sedeId, fecha),
    queryFn: () => AsistenciaService.getByFecha(fecha, sedeId),
    enabled: Boolean(sedeId && fecha),
  });
}

export function useDashboardStats(sedeId: string) {
  return useQuery({
    queryKey: schoolQueryKeys.dashboard(sedeId),
    queryFn: () => DashboardService.getStats(sedeId),
    enabled: Boolean(sedeId),
  });
}

export function useSesionesFonoBySede(sedeId: string) {
  return useQuery({
    queryKey: schoolQueryKeys.sesionesFono(sedeId),
    queryFn: () => FonoService.getSesionesBySede(sedeId),
    enabled: Boolean(sedeId),
  });
}

export function useAuditLogs(sedeId: string, page: number, pageSize: number) {
  return useQuery({
    queryKey: schoolQueryKeys.audit(sedeId, page, pageSize),
    queryFn: () => AuditService.getAll(sedeId, page, pageSize),
    enabled: Boolean(sedeId),
    placeholderData: previousData => previousData,
  });
}
