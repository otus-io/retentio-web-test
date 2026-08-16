import { describe, expect, it, vi } from "vitest";
import {
  ANTHROPIC_MESSAGES_URL,
  OPENAI_CHAT_URL,
  buildTranslationMessages,
  inferTextTranslationProvider,
  translateFactText,
  translateWithOpenAi,
} from "@/lib/fixFactLlm";

describe("inferTextTranslationProvider", () => {
  it("maps model prefixes", () => {
    expect(inferTextTranslationProvider("gpt-4o")).toBe("openai");
    expect(inferTextTranslationProvider("claude-sonnet-4-6")).toBe("claude");
    expect(inferTextTranslationProvider("deepseek-chat")).toBe("deepseek");
  });
});

describe("buildTranslationMessages", () => {
  it("asks for translation-only reply", () => {
    const { system, user } = buildTranslationMessages({
      sourceField: "日文",
      sourceText: "だれでも",
      translationField: "中文",
      translationText: "任何人",
      translationLang: "Chinese",
    });
    expect(system).toContain("Chinese");
    expect(system).toContain("ONLY the translation");
    expect(user).toContain("だれでも");
    expect(user).toContain("任何人");
  });
});

describe("translateWithOpenAi", () => {
  it("posts to OpenAI chat completions and returns content", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: '"改进"' } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const text = await translateWithOpenAi({
      model: "gpt-4o",
      sourceField: "日文",
      sourceText: "だれでも",
      translationField: "中文",
      translationText: "",
      translationLang: "Chinese",
      apiKey: "sk-test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(text).toBe("改进");
    expect(fetchImpl).toHaveBeenCalledWith(
      OPENAI_CHAT_URL,
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws when API key missing", async () => {
    await expect(
      translateWithOpenAi({
        model: "gpt-4o",
        sourceField: "a",
        sourceText: "x",
        translationField: "b",
        translationText: "",
        translationLang: "Chinese",
        apiKey: "",
      })
    ).rejects.toThrow(/VITE_OPENAI_API_KEY/);
  });
});

describe("translateFactText deepseek", () => {
  it("posts to DeepSeek when model is deepseek-*", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toContain("deepseek.com");
      return new Response(JSON.stringify({ choices: [{ message: { content: "译" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const text = await translateFactText({
      model: "deepseek-chat",
      sourceField: "日文",
      sourceText: "だれでも",
      translationField: "中文",
      translationText: "",
      translationLang: "Chinese",
      apiKeys: { deepseek: "ds-key" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(text).toBe("译");
  });
});

describe("translateFactText claude", () => {
  it("sends browser CORS opt-in header", async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      expect(headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
      return new Response(JSON.stringify({ content: [{ type: "text", text: "任何人" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const text = await translateFactText({
      model: "claude-sonnet-4-6",
      sourceField: "日文",
      sourceText: "だれでも",
      translationField: "中文",
      translationText: "",
      translationLang: "Chinese",
      apiKeys: { anthropic: "ant-key" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(text).toBe("任何人");
    expect(fetchImpl).toHaveBeenCalledWith(
      ANTHROPIC_MESSAGES_URL,
      expect.objectContaining({ method: "POST" })
    );
  });
});
