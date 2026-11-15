export interface Env {
  /** Base URL of the backend to forward to, e.g. https://api.example.com (no trailing slash). */
  BACKEND_URL: string;
  /** Shared secret callers must send in the `x-proxy-secret` header. Set with `wrangler secret put PROXY_SECRET`. */
  PROXY_SECRET: string;
  /** Optional comma-separated allowlist of paths to forward. Defaults to DEFAULT_ALLOWED_PATHS. */
  ALLOWED_PATHS?: string;
}

const DEFAULT_ALLOWED_PATHS = ['/api/login', '/api/registration'];

function allowedPaths(env: Env): string[] {
  if (!env.ALLOWED_PATHS) return DEFAULT_ALLOWED_PATHS;
  return env.ALLOWED_PATHS.split(',').map((p) => p.trim()).filter(Boolean);
}

/** Constant-time string comparison so the secret check does not leak timing information. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check: no auth needed
    if (url.pathname === '/health') {
      return Response.json({ ok: true, worker: 'auth-proxy' });
    }

    // Verify the shared secret on all other routes
    const secret = request.headers.get('x-proxy-secret') ?? '';
    if (!env.PROXY_SECRET || !safeEqual(secret, env.PROXY_SECRET)) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Only forward allowlisted paths
    if (!allowedPaths(env).includes(url.pathname)) {
      return new Response('Not found', { status: 404 });
    }
    if (!env.BACKEND_URL) {
      return Response.json({ error: 'BACKEND_URL is not configured' }, { status: 500 });
    }

    const targetUrl = `${env.BACKEND_URL}${url.pathname}`;
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('Accept', 'application/json');

    let body: string | null = null;
    if (request.method === 'POST') {
      body = await request.text();
    }

    try {
      const response = await fetch(targetUrl, { method: request.method, headers, body });
      const data = await response.text();
      return new Response(data, {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (err) {
      return Response.json({ error: 'Failed to reach backend', detail: String(err) }, { status: 502 });
    }
  },
};
