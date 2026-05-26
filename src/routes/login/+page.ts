// Render client-side only. The login page mounts browser-only wallet SDKs
// (Reown AppKit / wagmi via AppKitLogin) and reads localStorage. Server-
// rendering it crashed the Vercel function on a HARD navigation to /login
// (a direct hit SSRs the page), returning a 500. Reaching /login via the
// client-side redirect from `/` never crashed because `/` is an (authed)
// route with ssr=false, so the login page only ever rendered in the browser.
// Mirrors the (authed) group's `ssr = false`. prerender stays false
// (inherited from the root layout) so the route is still served as a
// function with a CSR fallback shell — no catch-all 404.
export const ssr = false;
