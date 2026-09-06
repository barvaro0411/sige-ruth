#!/usr/bin/env bash
set -euo pipefail

pattern='(SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY)=([[:alnum:]_.-]{20,})|sb_secret_[[:alnum:]_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----'

# Solo nombres: nunca copiar el secreto detectado al log de CI.
if git grep -IEl "$pattern" -- . ':!package-lock.json' ':!.env.example'; then
  echo "Se detectó un posible secreto en archivos versionados." >&2
  exit 1
else
  resultado=$?
  if [ "$resultado" -ne 1 ]; then
    echo "No se pudo completar el escaneo de secretos." >&2
    exit "$resultado"
  fi
fi

echo "No se detectaron patrones de secretos versionados."
