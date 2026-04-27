import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// ── Mocks ──────────────────────────────────────────────────────
vi.mock('../../middlewares/auth.js', () => ({
  authMiddleware: (req, _res, next) => {
    req.profile = { id: 'user-1', role: 'admin_app' };
    next();
  },
}));

vi.mock('../../middlewares/role.js', () => ({
  requireRole: (..._roles) => (_req, _res, next) => next(),
  requireServiceScope: (_req, _res, next) => next(),
}));

vi.mock('../../middlewares/cache.js', () => ({
  cache: () => (_req, _res, next) => next(),
  invalidate: vi.fn(),
}));

const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();

vi.mock('../../supabase.js', () => {
  const chain = () => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    eq: chain,
    order: chain,
    single: vi.fn().mockResolvedValue({ data: { id: 'svc-1', nom: 'Test', code: 'TST' }, error: null }),
  });
  return {
    supabase: {
      from: () => chain(),
    },
  };
});

import servicesRouter from '../../routes/services.js';

const app = express();
app.use(express.json());
app.use('/api/services', servicesRouter);

// ── Tests ──────────────────────────────────────────────────────
describe('POST /api/services — validation', () => {
  it('400 si nom manquant', async () => {
    const res = await request(app)
      .post('/api/services')
      .send({ code: 'TST' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/nom.*code|code.*nom/i);
  });

  it('400 si code manquant', async () => {
    const res = await request(app)
      .post('/api/services')
      .send({ nom: 'Test' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/nom.*code|code.*nom/i);
  });

  it('400 si nom est une chaîne vide', async () => {
    const res = await request(app)
      .post('/api/services')
      .send({ nom: '   ', code: 'TST' });
    expect(res.status).toBe(400);
  });

  it('400 si code est une chaîne vide', async () => {
    const res = await request(app)
      .post('/api/services')
      .send({ nom: 'Test', code: '   ' });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/services/:id — validation', () => {
  it('400 si nom manquant', async () => {
    const res = await request(app)
      .put('/api/services/svc-1')
      .send({ code: 'TST' });
    expect(res.status).toBe(400);
  });

  it('400 si code manquant', async () => {
    const res = await request(app)
      .put('/api/services/svc-1')
      .send({ nom: 'Test' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/services/:id/cellules — validation', () => {
  it('400 si nom manquant', async () => {
    const res = await request(app)
      .post('/api/services/svc-1/cellules')
      .send({ code: 'CEL' });
    expect(res.status).toBe(400);
  });

  it('400 si code manquant', async () => {
    const res = await request(app)
      .post('/api/services/svc-1/cellules')
      .send({ nom: 'Cellule A' });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/services/reorder — validation', () => {
  it('400 si body vide', async () => {
    const res = await request(app)
      .put('/api/services/reorder')
      .send([]);
    expect(res.status).toBe(400);
  });

  it('400 si body non-tableau', async () => {
    const res = await request(app)
      .put('/api/services/reorder')
      .send({ id: 'x', num_ordre: 1 });
    expect(res.status).toBe(400);
  });
});
