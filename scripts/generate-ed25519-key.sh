#!/usr/bin/env bash
set -euo pipefail
OUT="${1:-ed25519-private.pem}"
openssl genpkey -algorithm ED25519 -out "$OUT"
echo "Created $OUT"
echo "For Cloudflare: convert the PKCS#8 DER bytes to base64 and store the result as secret ED25519_PRIVATE_PKCS8_B64."
