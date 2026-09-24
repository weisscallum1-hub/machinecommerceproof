export interface ProofPayload {
  agentId?: string;
  action: string;
  policy?: string;
  input?: unknown;
  output?: unknown;
  paymentId?: string | null;
  payment?: unknown;
}

export interface Receipt {
  schema: string;
  runId: string;
  createdAt: string;
  agentId: string;
  action: string;
  policy: string;
  inputHash: string;
  outputHash: string;
  paymentId: string | null;
  payment?: unknown;
  previousReceiptHash: string | null;
  provenance: { inputTrust: 'untrusted'; attestationScope: 'integrity-only' };
  signer: { algorithm: 'Ed25519'; keyFingerprint: string; publicKeyPem?: string; publicKeySpkiB64?: string };
  receiptHash: string;
  signature: string;
}

export interface VerificationResult {
  verified: boolean;
  hashValid?: boolean;
  signatureValid?: boolean;
  signerFingerprintValid?: boolean;
  keyFingerprint?: string;
  schema?: string | null;
  attestationScope?: string;
  error?: string;
}

export class MachineCommerceProofClient {
  constructor(baseUrl?: string);
  health(): Promise<Record<string, unknown>>;
  metadata(): Promise<Record<string, unknown>>;
  publicKey(): Promise<Record<string, unknown>>;
  createProof(payload: ProofPayload): Promise<{ok: boolean; receipt: Receipt}>;
  verifyReceipt(receipt: Receipt): Promise<VerificationResult>;
  verifyChain(): Promise<Record<string, unknown>>;
  stats(): Promise<Record<string, unknown>>;
  receipt(runId: string): Promise<Receipt>;
  receipts(limit?: number): Promise<{count: number; receipts: Receipt[]}>;
}

export function receiptToA2APart(receipt: Record<string, unknown>): { data: { type: 'machine-commerce-proof/receipt'; version: string; receipt: Record<string, unknown> }; mediaType: 'application/vnd.machine-commerce-proof+json' };
export function receiptFromA2APart(part: { data?: unknown; mediaType?: string }): Record<string, unknown>;


export function a2aSendMessage(baseUrl: string, message: Record<string, unknown>): Promise<Record<string, unknown>>;
export function a2aGetTask(baseUrl: string, taskId: string): Promise<Record<string, unknown>>;
export function a2aReceiptVerificationMessage(receipt: Record<string, unknown>): Record<string, unknown>;
