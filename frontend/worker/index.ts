// Cloudflare runs this for /api/* only (see wrangler.jsonc), and serves everything else as static files.
// Forwarding keeps the API on the site's own address, so browsers send the login cookie.
interface Env {
  BACKEND_ORIGIN?: string;
  PROXY_SECRET?: string;
}

function errorResponse(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), { status, headers: { 'Content-Type': 'application/json' } });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!env.BACKEND_ORIGIN || !env.PROXY_SECRET) {
      console.error('BACKEND_ORIGIN or PROXY_SECRET is not set');
      return errorResponse(503, 'The service is not available right now');
    }

    const url = new URL(request.url);
    const target = new URL(url.pathname + url.search, env.BACKEND_ORIGIN);

    // These overwrite anything the browser sent, so a client can't choose its own address
    const headers = new Headers(request.headers);
    headers.delete('Host');
    headers.set('X-Proxy-Secret', env.PROXY_SECRET);
    headers.set('X-Client-IP', request.headers.get('CF-Connecting-IP') ?? '');

    try {
      return await fetch(target, {
        method: request.method,
        headers,
        body: request.body,
        redirect: 'manual',
        // Responses hold personal data, so they must never be cached
        cache: 'no-store',
      });
    } catch (error) {
      console.error('Could not reach the backend');
      return errorResponse(502, 'The service is not available right now');
    }
  },
};
