import { describe, it, expect } from 'vitest';
import { decodeJwt, decodeProtectedHeader } from 'jose';
import { generateKeys, createDPoPToken } from '../../src/auth/dpop';

describe('DPoP', () => {
  describe('generateKeys', () => {
    it('should generate valid ES256 key pair', async () => {
      const keys = await generateKeys();

      expect(keys.privateKey).toBeDefined();
      expect(keys.publicKey).toBeDefined();
    });

    it('should generate different keys each time', async () => {
      const keys1 = await generateKeys();
      const keys2 = await generateKeys();

      const token1 = await createDPoPToken(
        'https://example.com',
        'GET',
        keys1.privateKey,
        keys1.publicKey,
        'uuid1'
      );
      const token2 = await createDPoPToken(
        'https://example.com',
        'GET',
        keys2.privateKey,
        keys2.publicKey,
        'uuid2'
      );

      const header1 = decodeProtectedHeader(token1);
      const header2 = decodeProtectedHeader(token2);

      // Different keys should have different JWK values
      expect(header1.jwk).not.toEqual(header2.jwk);
    });
  });

  describe('createDPoPToken', () => {
    it('should create valid JWT with correct header', async () => {
      const keys = await generateKeys();
      const token = await createDPoPToken(
        'https://api.mercari.jp/v2/entities:search',
        'POST',
        keys.privateKey,
        keys.publicKey,
        'test-uuid'
      );

      const header = decodeProtectedHeader(token);

      expect(header.typ).toBe('dpop+jwt');
      expect(header.alg).toBe('ES256');
      expect(header.jwk).toBeDefined();
      expect(header.jwk?.crv).toBe('P-256');
      expect(header.jwk?.kty).toBe('EC');
      expect(header.jwk?.x).toBeDefined();
      expect(header.jwk?.y).toBeDefined();
    });

    it('should include correct payload fields', async () => {
      const keys = await generateKeys();
      const url = 'https://api.mercari.jp/items/get';
      const method = 'GET';
      const uuid = 'my-test-uuid';

      const token = await createDPoPToken(url, method, keys.privateKey, keys.publicKey, uuid);

      const payload = decodeJwt(token);

      expect(payload.htu).toBe(url);
      expect(payload.htm).toBe(method);
      expect(payload.uuid).toBe(uuid);
      expect(payload.iat).toBeDefined();
      expect(payload.jti).toBeDefined();
    });

    it('should generate unique jti for each token', async () => {
      const keys = await generateKeys();
      const tokens = await Promise.all([
        createDPoPToken('https://example.com', 'GET', keys.privateKey, keys.publicKey, 'uuid'),
        createDPoPToken('https://example.com', 'GET', keys.privateKey, keys.publicKey, 'uuid'),
        createDPoPToken('https://example.com', 'GET', keys.privateKey, keys.publicKey, 'uuid'),
      ]);

      const jtis = tokens.map((t) => decodeJwt(t).jti);
      const uniqueJtis = new Set(jtis);

      expect(uniqueJtis.size).toBe(3);
    });

    it('should set iat to current timestamp', async () => {
      const keys = await generateKeys();
      const before = Math.floor(Date.now() / 1000);

      const token = await createDPoPToken(
        'https://example.com',
        'GET',
        keys.privateKey,
        keys.publicKey,
        'uuid'
      );

      const after = Math.floor(Date.now() / 1000);
      const payload = decodeJwt(token);

      expect(payload.iat).toBeGreaterThanOrEqual(before);
      expect(payload.iat).toBeLessThanOrEqual(after);
    });
  });
});
