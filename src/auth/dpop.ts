import { SignJWT, exportJWK, generateKeyPair, KeyLike } from 'jose';
import { randomUUID } from 'crypto';

export interface DPoPKeyPair {
  privateKey: KeyLike;
  publicKey: KeyLike;
}

export async function generateKeys(): Promise<DPoPKeyPair> {
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  return { privateKey, publicKey };
}

export async function createDPoPToken(
  url: string,
  method: string,
  privateKey: KeyLike,
  publicKey: KeyLike,
  uuid: string
): Promise<string> {
  const jwk = await exportJWK(publicKey);

  return new SignJWT({
    htu: url,
    htm: method,
    uuid,
  })
    .setProtectedHeader({
      typ: 'dpop+jwt',
      alg: 'ES256',
      jwk: {
        crv: jwk.crv,
        kty: jwk.kty,
        x: jwk.x,
        y: jwk.y,
      },
    })
    .setIssuedAt()
    .setJti(randomUUID())
    .sign(privateKey);
}
