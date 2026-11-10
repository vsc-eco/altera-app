// Server-render the landing page: crawlers and link previews must get the
// real content at the domain root, not a CSR shell. Everything browser-only
// in the landing component is guarded by `browser` or runs in effects, which
// never run on the server (same reasoning as /login, verified there first).
// prerender stays false: the root layout reads `$env/dynamic/public` at module
// load, which is illegal during prerender.
export const ssr = true;
export const prerender = false;
