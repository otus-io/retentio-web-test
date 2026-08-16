import { describe, expect, it, vi } from "vitest";
import { elevenLabsTtsUrl, synthesizeWithElevenLabs } from "@/lib/fixFactTts";

describe("elevenLabsTtsUrl", () => {
  it("builds voice TTS path", () => {
    expect(elevenLabsTtsUrl("abcVoice")).toBe(
      "https://api.elevenlabs.io/v1/text-to-speech/abcVoice"
    );
  });
});

describe("synthesizeWithElevenLabs", () => {
  it("uses ruby readings for TTS and posts a seed for sample variation", async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        text?: string;
        model_id?: string;
        seed?: number;
      };
      expect(body.text).toBe("みちが出来ます");
      expect(body.model_id).toBe("eleven_v3");
      expect(body.seed).toBe(42);
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      });
    });
    const blob = await synthesizeWithElevenLabs({
      text: "[[道|みち]] が 出来ます",
      modelId: "eleven_v3",
      voiceId: "voice1",
      apiKey: "el-key",
      seed: 42,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(blob.size).toBe(3);
    expect(fetchImpl).toHaveBeenCalledWith(
      elevenLabsTtsUrl("voice1"),
      expect.objectContaining({ method: "POST", cache: "no-store" })
    );
  });

  it("throws when voice id missing", async () => {
    await expect(
      synthesizeWithElevenLabs({
        text: "hi",
        modelId: "eleven_v3",
        voiceId: "",
        apiKey: "el-key",
      })
    ).rejects.toThrow(/VITE_ELEVENLABS_VOICE_ID/);
  });
});
