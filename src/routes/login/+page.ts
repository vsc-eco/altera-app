// Server-render the landing page so crawlers and link previews get its real
// content instead of an empty CSR shell. This used to be `ssr = false`
// because a hard navigation to /login crashed with a 500 while the
// browser-only wallet SDKs (Reown AppKit / wagmi) were imported here. A
// direct SSR hit now renders cleanly and hydrates (verified: 200 with the
// full landing markup, no page errors, the connect modal still opens).
// Everything browser-only on this page is guarded by `browser` or runs in
// effects, which never run on the server.
// prerender stays false (inherited from the root layout): the layout reads
// `$env/dynamic/public` at module load, which is illegal during prerender.
export const ssr = true;
