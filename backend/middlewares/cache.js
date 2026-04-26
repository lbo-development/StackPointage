const store = new Map();

function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

function set(key, value, ttlMs) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function invalidate(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function cache(ttlMs) {
  return (req, res, next) => {
    const key = req.originalUrl;
    const hit = get(key);
    if (hit) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(hit);
    }
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      if (res.statusCode === 200) set(key, data, ttlMs);
      return originalJson(data);
    };
    next();
  };
}
