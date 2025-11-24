import { PrivateInferenceEngine } from './privateInference.js';
import { SoftwareInferenceEngine } from './privateInference.js';

export function createPrivateInferenceEngine(): PrivateInferenceEngine {
  // In future we will switch on an env var, e.g. TEE_MODE=nitro
  // and return a NitroTEEInferenceEngine instead.
  return new SoftwareInferenceEngine();
}

