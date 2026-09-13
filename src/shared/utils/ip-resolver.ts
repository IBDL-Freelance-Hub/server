import { Request } from 'express';

/**
 * SECURITY NOTICE: Express operates in a private internal network behind Next.js / ingress reverse proxy.
 * Trusting 'x-real-client-ip' is ONLY safe because Express is not directly exposed to the public internet
 * and the ingress proxy/Next.js strips or overwrites any client-supplied x-real-client-ip header.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-real-client-ip'];
  if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
    const firstIp = forwarded.split(',')[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }
  return req.ip || req.socket.remoteAddress || '127.0.0.1';
}
