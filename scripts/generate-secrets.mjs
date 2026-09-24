#!/usr/bin/env node
import crypto from 'node:crypto';
console.log('PROOF_WRITE_TOKEN=' + crypto.randomBytes(32).toString('base64url'));
console.log('ADMIN_TOKEN=' + crypto.randomBytes(32).toString('base64url'));
