#!/usr/bin/env bash
set -euo pipefail

pattern='(SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY)=([[:alnum:]_.-]{20,})|sb_secret_[[:alnum:]_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----'

if git grep -IEn "$pattern" -- . ':!package-lock.json' ':!.env.example'; then
  echo "Se detectó un posible secreto en archivos versionados." >&2
  exit 1
fi

echo "No se detectaron patrones de secretos versionados."
