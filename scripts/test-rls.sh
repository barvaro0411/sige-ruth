#!/usr/bin/env bash
# =============================================================================
# Corre las pruebas de reglas de la base, en orden.
#
# Cada archivo se revierte solo: no deja filas. Se puede apuntar a produccion.
#
#   export DATABASE_URL='postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres'
#   npm run test:rls
# =============================================================================
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Falta DATABASE_URL." >&2
  echo "Supabase > Project Settings > Database > Connection string (modo session)." >&2
  exit 2
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "Falta psql. Instala el cliente de PostgreSQL para correr estas pruebas." >&2
  exit 2
fi

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/supabase/tests"
fallidos=0
total=0

for archivo in "$DIR"/[0-9]*.sql; do
  nombre="$(basename "$archivo")"
  total=$((total + 1))
  printf '\n──── %s ────\n' "$nombre"

  # ON_ERROR_STOP hace que el `raise exception` del veredicto devuelva != 0.
  if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$archivo"; then
    echo "OK  $nombre"
  else
    echo "FALLA  $nombre" >&2
    fallidos=$((fallidos + 1))
  fi
done

printf '\n═════════════════════════\n'
if [ "$fallidos" -gt 0 ]; then
  echo "$fallidos de $total archivos fallaron" >&2
  exit 1
fi
echo "$total archivos OK"
