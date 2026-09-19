// Public Vite/Astro environment variables read by @trayectoria/db's client.ts, which this
// package's typecheck follows (see packages/db/src/env.d.ts and .env.example).
interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
