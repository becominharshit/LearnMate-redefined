import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '20s', target: 10 },
    { duration: '40s', target: 25 },
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<600'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3000';
const AUTH_TOKEN = __ENV.AUTH_BEARER_TOKEN || '';

export default function () {
  // 1. Health probe
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
  });

  // 2. Capabilities probe
  const capRes = http.get(`${BASE_URL}/api/capabilities`);
  check(capRes, {
    'capabilities status is 200': (r) => r.status === 200,
  });

  // 3. Static PYQ Pack Index fetch
  const indexRes = http.get(`${BASE_URL}/pyq-packs/index.json`);
  check(indexRes, {
    'pyq index is 200': (r) => r.status === 200,
  });

  // 4. Optional authenticated waitlist / billing-config probe
  const headers = AUTH_TOKEN
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${AUTH_TOKEN}` }
    : { 'Content-Type': 'application/json' };

  const billingRes = http.get(`${BASE_URL}/api/commercial/billing-config`, { headers });
  check(billingRes, {
    'billing-config returns expected status': (r) => r.status === 200 || r.status === 401,
  });

  sleep(0.5);
}
