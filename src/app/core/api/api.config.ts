/** Todo pasa por el API Gateway; cada servicio se publica bajo su propio prefijo. */
export const GATEWAY_URL = 'http://localhost:8090';

export const API = {
  tenant: `${GATEWAY_URL}/tenant/api`,
  operation: `${GATEWAY_URL}/operation/api`,
  pricing: `${GATEWAY_URL}/pricing/api`,
  payment: `${GATEWAY_URL}/payment/api`,
  reporting: `${GATEWAY_URL}/reporting/api`
} as const;
