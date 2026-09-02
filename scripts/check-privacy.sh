#!/usr/bin/env bash
set -euo pipefail

fallar() {
  echo "$1" >&2
  exit 1
}

for archivo in scripts/seed_custom_data.js scripts/seed.js; do
  if [ -e "$archivo" ]; then
    fallar "Archivo obsoleto o sensible detectado: $archivo"
  fi
done

rutas=(src scripts public supabase/migrations supabase/functions supabase/maintenance)
existentes=()
for ruta in "${rutas[@]}"; do
  # Solo rutas con contenido versionado: `git grep` aborta ante un pathspec
  # que no conoce (p. ej. una carpeta nueva todavía sin commitear).
  if git ls-files --error-unmatch -- "$ruta" >/dev/null 2>&1; then
    existentes+=("$ruta")
  fi
done

# Solo muestra nombres de archivo: un hallazgo no debe copiar el dato personal
# al log de CI. Los RUT sintéticos de las pruebas SQL quedan fuera del escaneo.
# Se usa `git grep` —no `rg`— para escanear únicamente lo versionado: los datos
# reales de siembra viven en archivos ignorados y locales (src/db/students_*.json)
# que no deben hacer fallar esta verificación.
if git grep -I -l -E '(^|[^0-9])[0-9]{7,9}-[0-9Kk]([^0-9A-Za-z]|$)' -- "${existentes[@]}"; then
  fallar "Se detectó un posible RUT versionado fuera de las pruebas aisladas."
fi

for baseline in \
  supabase/migrations/20260829000000_esquema_base.sql \
  supabase/migrations/20260829001000_permisos_base.sql \
  supabase/migrations/20260829002000_feriados_base.sql; do
  [ -f "$baseline" ] || fallar "Falta la migración baseline: $baseline"
done

migraciones=(supabase/migrations/*.sql)
timestamps=()
for migracion in "${migraciones[@]}"; do
  nombre=${migracion##*/}
  [[ "$nombre" =~ ^[0-9]{14}_[a-z0-9_]+\.sql$ ]] \
    || fallar "Nombre de migración inválido: $nombre"
  timestamps+=("${nombre%%_*}")
done

duplicados=$(printf '%s\n' "${timestamps[@]}" | sort | uniq -d)
[ -z "$duplicados" ] || fallar "Hay timestamps de migración duplicados: $duplicados"

if rg -Il -i -e 'using[[:space:]]*\([[:space:]]*true[[:space:]]*\)' \
  -e 'with[[:space:]]+check[[:space:]]*\([[:space:]]*true[[:space:]]*\)' \
  supabase/migrations; then
  fallar "Se detectó una política RLS abierta incondicionalmente."
fi

if rg -Il -e "select\\(['\"]\\*" \
  src/services/estudianteService.ts src/services/documentoService.ts src/services/fonoService.ts; then
  fallar "Una consulta sensible volvió a usar select('*')."
fi

echo "Privacidad del árbol y estructura de migraciones verificadas."
