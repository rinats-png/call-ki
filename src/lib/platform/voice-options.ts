import { VOICE_PROVIDER_OPTIONS } from "./registry";

export function isVoiceProvider(v: string): boolean {
  return VOICE_PROVIDER_OPTIONS.some((o) => o.value === v);
}
