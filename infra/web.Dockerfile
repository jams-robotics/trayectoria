# syntax=docker/dockerfile:1
# Static site image for self-hosting (docs/ops/SELF-HOSTING.md).
# Build context: repository root. Usage: docker compose -f infra/docker-compose.yml build
# Base images are pinned by tag and digest (#525); Dependabot (.github/dependabot.yml) updates both.

FROM node:24.18.0-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

ARG PUBLIC_SUPABASE_URL
ARG PUBLIC_SUPABASE_ANON_KEY
RUN test -n "$PUBLIC_SUPABASE_URL" && test -n "$PUBLIC_SUPABASE_ANON_KEY" \
  || (echo "PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY are required build args" >&2 && exit 1)
ENV PUBLIC_SUPABASE_URL=$PUBLIC_SUPABASE_URL \
    PUBLIC_SUPABASE_ANON_KEY=$PUBLIC_SUPABASE_ANON_KEY

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM caddy:2.11.4-alpine@sha256:6aeddd44c3078b0f9a35206472a11420648a79c184603ef95957d0a20044cb2b
ARG PUBLIC_SUPABASE_URL
COPY infra/Caddyfile /etc/caddy/Caddyfile
# The CSP names the same Supabase the site was built for (#507).
RUN --mount=type=bind,source=infra/csp-origins.sh,target=/tmp/csp-origins.sh \
  sh /tmp/csp-origins.sh /etc/caddy/Caddyfile
COPY --from=build /repo/apps/web/dist /srv
