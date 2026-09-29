#!/bin/sh
# Writes the Supabase origins into the Content-Security-Policy of a headers file (#507).
# Usage: PUBLIC_SUPABASE_URL=https://<ref>.supabase.co sh infra/csp-origins.sh <file>
# Replaces __SUPABASE_ORIGINS__ in <file> with the origin of PUBLIC_SUPABASE_URL and its WebSocket
# form: "https://<ref>.supabase.co wss://<ref>.supabase.co" (http://… gives ws://… for local tests).
# Called by .github/workflows/deploy.yml on apps/web/dist/_headers and by infra/web.Dockerfile on
# the Caddyfile.
set -eu

file="${1:?usage: csp-origins.sh <file>}"
url="${PUBLIC_SUPABASE_URL:?PUBLIC_SUPABASE_URL is required}"

origin=$(printf '%s' "$url" | sed -E 's#^(https?://[^/?#]+).*$#\1#')
# Only a plain scheme://host[:port] may end up inside the policy.
if ! printf '%s' "$origin" | grep -Eq '^https?://[A-Za-z0-9.-]+(:[0-9]+)?$'; then
  echo "csp-origins.sh: PUBLIC_SUPABASE_URL is not an http(s) URL: $url" >&2
  exit 1
fi
websocket=$(printf '%s' "$origin" | sed 's#^http#ws#')

if ! grep -q '__SUPABASE_ORIGINS__' "$file"; then
  echo "csp-origins.sh: no __SUPABASE_ORIGINS__ in $file" >&2
  exit 1
fi
sed -i "s#__SUPABASE_ORIGINS__#$origin $websocket#g" "$file"
