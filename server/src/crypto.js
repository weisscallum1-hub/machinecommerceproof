import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function canonicalize(value) {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('canonical_json_requires_finite_numbers');
    return JSON.stringify(value);
  }
  if (typeof value !== 'object') throw new TypeError(`unsupported_json_type:${typeof value}`);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`;
}

export function stableJson(value) {
  return canonicalize(value);
}

export function loadOrCreateKeyPair(dataDir) {
  const privatePath = path.join(dataDir, 'ed25519-private.pem');
  const publicPath = path.join(dataDir, 'ed25519-public.pem');

  if (fs.existsSync(privatePath) && fs.existsSync(publicPath)) {
    const privateKey = fs.readFileSync(privatePath);
    const publicKey = fs.readFileSync(publicPath);
    const derivedPublicKey = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }).toString();
    if (derivedPublicKey !== publicKey.toString()) throw new Error('signing_key_pair_mismatch');
    return { privateKey, publicKey };
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(privatePath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  fs.writeFileSync(publicPath, publicKey.export({ type: 'spki', format: 'pem' }), { mode: 0o644 });
  return { privateKey: fs.readFileSync(privatePath), publicKey: fs.readFileSync(publicPath) };
}

export function publicKeyDer(publicKey) {
  if (Buffer.isBuffer(publicKey) || publicKey instanceof Uint8Array) return Buffer.from(publicKey);
  if (publicKey && typeof publicKey.export === 'function' && publicKey.type === 'public') return publicKey.export({ type: 'spki', format: 'der' });
  return crypto.createPublicKey(publicKey).export({ type: 'spki', format: 'der' });
}

export function publicKeySpkiB64(publicKey) {
  return publicKeyDer(publicKey).toString('base64');
}

export function fingerprint(publicKey) {
  const der = publicKeyDer(publicKey);
  return crypto.createHash('sha256').update(der).digest('hex').slice(0, 32);
}

export function publicKeyFromSigner(signer) {
  if (signer?.publicKeySpkiB64) {
    return crypto.createPublicKey({ key: Buffer.from(signer.publicKeySpkiB64, 'base64'), type: 'spki', format: 'der' });
  }
  if (signer?.publicKeyPem) return crypto.createPublicKey(signer.publicKeyPem);
  throw new Error('missing_public_key');
}

export function signJson(value, privateKey) {
  return crypto.sign(null, Buffer.from(stableJson(value)), privateKey).toString('base64');
}

export function verifyJson(value, signatureB64, publicKey) {
  try {
    const key = publicKey?.type ? publicKey : crypto.createPublicKey(publicKey);
    return crypto.verify(null, Buffer.from(stableJson(value)), key, Buffer.from(signatureB64, 'base64'));
  } catch {
    return false;
  }
}
