import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../app';

describe('API contract smoke tests (MVP stubs)', () => {
  it('GET /healthz returns ok', async () => {
    const app = createApp();
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('GET /api/client/categories returns categories', async () => {
    const app = createApp();
    const res = await request(app).get('/api/client/categories');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.categories)).toBe(true);
  });

  it('POST /api/otc/suggestions validates input', async () => {
    const app = createApp();
    const res = await request(app).post('/api/otc/suggestions').send({ categoryId: 'not-a-uuid' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });
});

