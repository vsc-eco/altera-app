// Client-side only, for the same reason as /login: this route imports the
// auth store (whose graph reaches the browser-only Reown AppKit / wagmi
// setup) and calls `logout()` in an effect. A hard navigation to /logout
// would SSR it in prod and risk the same 500. Mirrors the (authed) group's
// `ssr = false`; prerender stays false so it's still served as a function.
export const ssr = false;
