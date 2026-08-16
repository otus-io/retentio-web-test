/**
 * Browser-side ElevenLabs TTS for Contributions inbox Fix Fact (web-test only).
 * Keys come from VITE_* env and are visible in the client bundle.
 */

import { readingForm } from "./fixFactRuby";

/** Presets shown in the Fix panel TTS model picker. */
export const TTS_MODEL_OPTIONS: { value: string; label: string }[] = [
  { value: "eleven_v3", label: "ElevenLabs · eleven_v3" },
  { value: "eleven_multilingual_v2", label: "ElevenLabs · eleven_multilingual_v2" },
  { value: "eleven_turbo_v2_5", label: "ElevenLabs · eleven_turbo_v2_5" },
  { value: "eleven_flash_v2_5", label: "ElevenLabs · eleven_flash_v2_5" },
];

export function getElevenLabsApiKey(): string {
  return String(import.meta.env.VITE_ELEVENLABS_API_KEY ?? "").trim();
}

export function getElevenLabsVoiceId(): string {
  return String(import.meta.env.VITE_ELEVENLABS_VOICE_ID ?? "").trim();
}

export function getDefaultTtsModel(): string {
  return String(import.meta.env.VITE_ELEVENLABS_MODEL_ID ?? "").trim() || "eleven_multilingual_v2";
}

/** Exported for tests. */
export function elevenLabsTtsUrl(voiceId: string): string {
  return `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;
}

/** Random seed in ElevenLabs' documented range so each regen can sample differently. */
export function randomTtsSeed(): number {
  return Math.floor(Math.random() * 0x1_0000_0000);
}

export async function synthesizeWithElevenLabs(opts: {
  text: string;
  modelId: string;
  voiceId?: string;
  apiKey?: string;
  /** When omitted, a new random seed is sent so repeated clicks vary. */
  seed?: number;
  fetchImpl?: typeof fetch;
}): Promise<Blob> {
  const apiKey = (opts.apiKey ?? getElevenLabsApiKey()).trim();
  const voiceId = (opts.voiceId ?? getElevenLabsVoiceId()).trim();
  if (!apiKey) {
    throw new Error(
      "VITE_ELEVENLABS_API_KEY is not set (use ./run-dev.sh so .env / quality-tools/.env are loaded)"
    );
  }
  if (!voiceId) {
    throw new Error(
      "VITE_ELEVENLABS_VOICE_ID is not set (use ./run-dev.sh so .env / quality-tools/.env are loaded)"
    );
  }
  const speak = readingForm(opts.text);
  if (!speak) {
    throw new Error("Empty TTS reading form (no speakable text)");
  }
  const seed = opts.seed ?? randomTtsSeed();
  // Bind: extracting `fetch` and calling it unbound throws Illegal invocation.
  const fetchFn = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const res = await fetchFn(elevenLabsTtsUrl(voiceId), {
    method: "POST",
    cache: "no-store",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: speak,
      model_id: opts.modelId,
      seed,
    }),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(`ElevenLabs TTS HTTP ${res.status}: ${detail}`);
  }
  return res.blob();
}
