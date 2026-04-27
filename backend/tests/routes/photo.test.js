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

const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();
const mockAgentUpdate = vi.fn();

vi.mock('../../supabase.js', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      }),
    },
    from: (table) => {
      if (table === 'agents') {
        return { update: () => ({ eq: mockAgentUpdate }) };
      }
      // fallback pour les autres tables utilisées par agents.js GET
      return { select: () => ({ eq: () => ({ order: () => ({}) }) }) };
    },
  },
}));

// ── App ────────────────────────────────────────────────────────
import agentsRouter from '../../routes/agents.js';

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use('/api/agents', agentsRouter);

// ── Helpers ────────────────────────────────────────────────────
function jpegBase64(sizeBytes = 100) {
  const buf = Buffer.alloc(sizeBytes);
  buf[0] = 0xFF; buf[1] = 0xD8; buf[2] = 0xFF;
  return buf.toString('base64');
}

function makeOversizedBase64() {
  const buf = Buffer.alloc(6 * 1024 * 1024); // 6 Mo > limite 5 Mo
  buf[0] = 0xFF; buf[1] = 0xD8; buf[2] = 0xFF;
  return buf.toString('base64');
}

// ── Tests ──────────────────────────────────────────────────────
describe('POST /api/agents/:id/photo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/photo/agent-1' } });
    mockAgentUpdate.mockResolvedValue({ error: null });
  });

  it('400 si data manquant', async () => {
    const res = await request(app)
      .post('/api/agents/agent-1/photo')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/requis/i);
  });

  it('400 si photo > 5 Mo', async () => {
    const res = await request(app)
      .post('/api/agents/agent-1/photo')
      .send({ data: makeOversizedBase64() });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/volumineuse/i);
  });

  it('400 si MIME non supporté (données aléatoires)', async () => {
    const buf = Buffer.alloc(50).fill(0x00);
    const res = await request(app)
      .post('/api/agents/agent-1/photo')
      .send({ data: buf.toString('base64') });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/format non support/i);
  });

  it('200 et retourne photo_url pour un JPEG valide', async () => {
    const res = await request(app)
      .post('/api/agents/agent-1/photo')
      .send({ data: jpegBase64() });
    expect(res.status).toBe(200);
    expect(res.body.photo_url).toBe('https://cdn.example.com/photo/agent-1');
    expect(mockUpload).toHaveBeenCalledWith(
      'photo/agent-1',
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'image/jpeg', upsert: true }),
    );
  });

  it('500 si Supabase storage échoue', async () => {
    mockUpload.mockResolvedValue({ error: new Error('storage down') });
    const res = await request(app)
      .post('/api/agents/agent-1/photo')
      .send({ data: jpegBase64() });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Erreur serveur interne.');
  });

  it("n'expose pas le message d'erreur Supabase en clair", async () => {
    mockUpload.mockResolvedValue({ error: new Error('secret internal detail') });
    const res = await request(app)
      .post('/api/agents/agent-1/photo')
      .send({ data: jpegBase64() });
    expect(res.body.error).not.toContain('secret internal detail');
  });
});
