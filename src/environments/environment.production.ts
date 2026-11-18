/**
 * Produccion: la web y el gateway se publican en el mismo dominio. Nginx del servidor
 * envia /api/* al API Gateway (quitando /api), asi que no hace falta CORS ni escribir la IP.
 */
export const environment = {
  production: true,
  gatewayUrl: '/api'
};
