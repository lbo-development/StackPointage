import { describe, it, expect } from 'vitest';
import { PHOTO_MAX_BYTES, detectImageMime } from '../../lib/imageUtils.js';

describe('PHOTO_MAX_BYTES', () => {
  it('est 5 Mo', () => {
    expect(PHOTO_MAX_BYTES).toBe(5 * 1024 * 1024);
  });
});

describe('detectImageMime', () => {
  it('détecte JPEG', () => {
    const buf = Buffer.from([0xFF, 0xD8, 0xFF, 0x00, ...new Array(20).fill(0)]);
    expect(detectImageMime(buf)).toBe('image/jpeg');
  });

  it('détecte PNG', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4E, 0x47, ...new Array(20).fill(0)]);
    expect(detectImageMime(buf)).toBe('image/png');
  });

  it('détecte WebP', () => {
    // RIFF....WEBP
    const buf = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00, // file size (ignored)
      0x57, 0x45, 0x42, 0x50, // WEBP
    ]);
    expect(detectImageMime(buf)).toBe('image/webp');
  });

  it('retourne null pour un format inconnu', () => {
    const buf = Buffer.from([0x00, 0x01, 0x02, 0x03, ...new Array(20).fill(0)]);
    expect(detectImageMime(buf)).toBeNull();
  });

  it('retourne null si le buffer est trop court', () => {
    const buf = Buffer.from([0xFF, 0xD8]);
    expect(detectImageMime(buf)).toBeNull();
  });

  it('retourne null pour un buffer vide', () => {
    expect(detectImageMime(Buffer.alloc(0))).toBeNull();
  });
});
