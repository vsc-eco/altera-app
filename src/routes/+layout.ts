// Prerendering is disabled: the layout's import chain reaches
// nodeSelection/env.ts, which reads `$env/dynamic/public` (PUBLIC_*_NODES) at
// module load. Reading dynamic env during prerender is illegal, so every page
// (including /login and /logout) crashed at build time and shipped with no
// static page AND no serverless function — making a hard navigation to them
// 404 via the catch-all. Serving everything as SSR/CSR functions fixes that;
// dynamic env reads are fine at runtime. The catch-all 404 handler still works.
export const prerender = false;
