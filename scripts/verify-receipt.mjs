#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
if (args[0] === '--help' || args[0] === '-h') {
  console.log('Usage: node scripts/verify-receipt.mjs <receipt.json>');
  console.log('Verifies receipt hash, Ed25519 signature, and signer fingerprint.');
  process.exit(0);
}
const file = args[0];
if (!file) {
  console.error('Usage: node scripts/verify-receipt.mjs <receipt.json>');
  process.exit(2);
}
const receipt = JSON.parse(fs.readFileSync(file, 'utf8'));
const canonical = value => {
  if (value === null) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
};
function cryptographicInput(obj, removeHash = false) {
  const copy = {...obj, signer: obj.signer ? {...obj.signer} : obj.signer};
  if (removeHash) delete copy.receiptHash;
  delete copy.signature;
  if (copy.signer) { delete copy.signer.publicKeyPem; delete copy.signer.publicKeySpkiB64; }
  return copy;
}
const rawDer = receipt.signer.publicKeyPem
  ? crypto.createPublicKey(receipt.signer.publicKeyPem).export({type:'spki', format:'der'})
  : Buffer.from(receipt.signer.publicKeySpkiB64 || '', 'base64');
if (!rawDer.length) throw new Error('Receipt does not contain a supported public key encoding');
const key = crypto.createPublicKey({key: rawDer, type:'spki', format:'der'});
const fingerprint = crypto.createHash('sha256').update(rawDer).digest('hex').slice(0,32);
const hashOk = receipt.receiptHash === `sha256:${crypto.createHash('sha256').update(canonical(cryptographicInput(receipt, true))).digest('hex')}`;
const signatureOk = crypto.verify(null, Buffer.from(canonical(cryptographicInput(receipt, false))), key, Buffer.from(receipt.signature,'base64'));
const signerOk = fingerprint === receipt.signer.keyFingerprint;
console.log(JSON.stringify({verified: hashOk && signatureOk && signerOk, hashValid: hashOk, signatureValid: signatureOk, signerFingerprintValid: signerOk, keyFingerprint: fingerprint}, null, 2));
process.exitCode = hashOk && signatureOk && signerOk ? 0 : 1;
