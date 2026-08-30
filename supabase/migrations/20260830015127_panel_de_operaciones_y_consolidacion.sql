-- =============================================================================
-- Fase 8 — Panel de operaciones y consolidacion
--
-- Hasta aca cada modulo sabe lo suyo, pero nadie ve el conjunto. Quien dirige
-- termina abriendo cinco pantallas para responder una sola pregunta: que hay
-- que atender hoy.
--
-- Tres vistas, tres preguntas:
--   · panel_operaciones_vista      — que necesita atencion ahora
--   · consolidado_mensual_vista    — en que se fue la plata cada mes
--   · lista_compra_sugerida_vista  — que conviene comprar la proxima vez
--
-- Las tres son `security_invoker`: no abren ni un dato que la persona no
-- pudiera consultar tabla por tabla. Para alguien de una sola sede, las filas
-- de las otras sedes vuelven en cero, no vuelven prohibidas.
--
-- No se agrega ninguna tabla. Un panel que necesita su propia tabla es un panel
-- que puede quedar desincronizado del dato real.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Que necesita atencion hoy
--
-- Una fila por sede. Cada columna es una cola de trabajo con nombre y dueño:
-- si el numero es mayor que cero, hay alguien que tiene algo pendiente.
-- -----------------------------------------------------------------------------
create or replace view public.panel_operaciones_vista
with (security_invoker = true) as
select
  s.id   as sede_id,
  s.nombre as sede_nombre,

  -- Solicitudes de materiales, por etapa. Quien revisa, quien compra, quien
  -- entrega: son tres personas distintas y tres colas distintas.
  (select count(*) from public.solicitudes_materiales m
    where m.sede_id = s.id and m.estado = 'pendiente')                as materiales_por_revisar,
  (select count(*) from public.solicitudes_materiales m
    where m.sede_id = s.id and m.estado in ('aprobada','en_compra','compra_parcial')) as materiales_por_comprar,
  (select count(*) from public.solicitudes_materiales m
    where m.sede_id = s.id and m.estado in ('comprada','preparando','entregada_parcial')) as materiales_por_entregar,

  -- Permisos esperando resolucion.
  (select count(*) from public.solicitudes_permiso p
    where p.sede_id = s.id and p.estado = 'pendiente')                as permisos_por_resolver,

  -- Bodega.
  (select count(*) from public.inventario_estado_vista i
    where i.sede_id = s.id and i.activo and i.estado_stock = 'agotado') as productos_agotados,
  (select count(*) from public.inventario_estado_vista i
    where i.sede_id = s.id and i.activo and i.estado_stock = 'bajo')    as productos_bajo_minimo,

  -- Mantenciones. `por_cerrar` son las que ya se repararon y solo falta
  -- registrar el costo: se separan porque no bloquean a nadie.
  (select count(*) from public.mantenciones t
    where t.sede_id = s.id and t.estado not in ('cerrada','cancelada'))  as mantenciones_abiertas,
  (select count(*) from public.mantenciones t
    where t.sede_id = s.id and t.prioridad = 'urgente'
      and t.estado not in ('resuelta','cerrada','cancelada'))            as mantenciones_urgentes,
  (select count(*) from public.mantenciones t
    where t.sede_id = s.id and t.estado = 'resuelta')                    as mantenciones_por_cerrar,

  -- Preventivas.
  (select count(*) from public.preventivas_estado_vista v
    where v.sede_id = s.id and v.activo and v.estado_preventiva = 'vencida') as preventivas_vencidas,
  (select count(*) from public.preventivas_estado_vista v
    where v.sede_id = s.id and v.activo and v.estado_preventiva = 'proxima') as preventivas_proximas,

  -- Prestamos que ya pasaron su plazo.
  (select count(*) from public.prestamos_vista pr
    where pr.sede_id = s.id and pr.situacion = 'atrasado')             as prestamos_atrasados

from public.sedes s
where s.activo;

comment on view public.panel_operaciones_vista is
  'Colas de trabajo abiertas por sede. Se calcula al vuelo desde las tablas de cada modulo: no hay contadores materializados que puedan quedar desfasados.';

-- -----------------------------------------------------------------------------
-- 2. Consolidacion mensual
--
-- Tres origenes de gasto que hoy se miran por separado. `mes` es el primer dia
-- del mes, para que agrupar y ordenar sea trivial.
--
-- La fecha de cada gasto es la de su cierre, no la de su creacion: una
-- solicitud abierta en marzo y entregada en abril es gasto de abril, que es
-- cuando efectivamente salio la plata.
-- -----------------------------------------------------------------------------
create or replace view public.consolidado_mensual_vista
with (security_invoker = true) as

  -- Materiales: solo lo que ya tiene costo real registrado. Lo estimado no es
  -- gasto, es intencion.
  select
    m.sede_id,
    date_trunc('month',
      (coalesce(m.entrega_confirmada_en, m.updated_at) at time zone 'America/Santiago')
    )::date                        as mes,
    'materiales'::text             as origen,
    count(*)                       as cantidad,
    sum(m.costo_real_total)::numeric(14,2) as total
  from public.solicitudes_materiales m
  where m.costo_real_total > 0
    and m.estado not in ('cancelada','rechazada')
  group by 1, 2

union all

  -- Mantenciones correctivas: lo que costo arreglar lo que se rompio.
  select
    t.sede_id,
    date_trunc('month',
      (coalesce(t.cerrada_en, t.resuelta_en) at time zone 'America/Santiago')
    )::date,
    'mantenciones',
    count(*),
    sum(t.costo)::numeric(14,2)
  from public.mantenciones t
  where t.costo is not null and t.costo > 0
    and coalesce(t.cerrada_en, t.resuelta_en) is not null
  group by 1, 2

union all

  -- Preventivas: lo que costo que no se rompiera.
  select
    p.sede_id,
    date_trunc('month', e.fecha)::date,
    'preventivas',
    count(*),
    sum(e.costo)::numeric(14,2)
  from public.preventivas_ejecuciones e
  join public.mantenciones_preventivas p on p.id = e.preventiva_id
  where e.costo is not null and e.costo > 0
  group by 1, 2;

comment on view public.consolidado_mensual_vista is
  'Gasto real por sede, mes y origen. La fecha de cada gasto es la de su cierre, no la de su creacion.';

-- -----------------------------------------------------------------------------
-- 3. Lista de compra sugerida
--
-- Que falta, y cuanto conviene comprar. La regla es explicita y esta a la
-- vista: lo que falta para llegar al minimo, mas lo que se consume en un mes.
-- Reponer justo hasta el minimo deja a la bodega comprando lo mismo cada
-- semana.
--
-- El consumo sale de los movimientos de entrega de los ultimos 90 dias, que es
-- el unico dato real que existe. Un producto nuevo, sin historial, sugiere
-- exactamente lo que falta y nada mas.
-- -----------------------------------------------------------------------------
create or replace view public.lista_compra_sugerida_vista
with (security_invoker = true) as
with consumo as (
  select
    mv.item_id,
    sum(-mv.cantidad) as consumo_90d
  from public.inventario_movimientos mv
  where mv.tipo = 'entrega'
    and mv.created_at >= now() - interval '90 days'
  group by mv.item_id
),
ultima_compra as (
  select mv.item_id, max(mv.created_at) as fecha
  from public.inventario_movimientos mv
  where mv.tipo in ('compra','ingreso')
  group by mv.item_id
)
select
  i.id, i.sede_id, i.categoria_id, i.categoria, i.nombre,
  i.unidad, i.unidad_nombre, i.ubicacion,
  i.stock_actual, i.stock_minimo, i.estado_stock, i.faltante,
  coalesce(c.consumo_90d, 0)::numeric(12,2)      as consumo_90d,
  (coalesce(c.consumo_90d, 0) / 3)::numeric(12,2) as consumo_mensual,
  ceil(i.faltante + coalesce(c.consumo_90d, 0) / 3)::numeric(12,2) as sugerido,
  u.fecha                                         as ultima_compra
from public.inventario_estado_vista i
left join consumo c       on c.item_id = i.id
left join ultima_compra u on u.item_id = i.id
where i.activo
  and i.estado_stock in ('agotado','bajo');

comment on view public.lista_compra_sugerida_vista is
  'Productos bajo el minimo con una cantidad sugerida: lo que falta para llegar al minimo mas un mes de consumo, medido sobre las entregas de los ultimos 90 dias.';

grant select on public.panel_operaciones_vista     to authenticated;
grant select on public.consolidado_mensual_vista   to authenticated;
grant select on public.lista_compra_sugerida_vista to authenticated;

revoke all on public.panel_operaciones_vista     from anon;
revoke all on public.consolidado_mensual_vista   from anon;
revoke all on public.lista_compra_sugerida_vista from anon;

commit;
