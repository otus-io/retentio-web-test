/**
 * Browser-side LLM translation for Contributions inbox Fix Fact (web-test only).
 * Keys come from VITE_* env and are visible in the client bundle.
 */

export type TextTranslationProvider = "openai" | "claude" | "deepseek";

/** Presets shown in the Fix panel model picker. */
export const TEXT_TRANSLATION_MODEL_OPTIONS: { value: string; label: string }[] = [
  { value: "gpt-4o", label: "OpenAI · gpt-4o" },
  { value: "gpt-4o-mini", label: "OpenAI · gpt-4o-mini" },
  { value: "claude-sonnet-4-6", label: "Claude · claude-sonnet-4-6" },
  { value: "claude-haiku-4-5-20251001", label: "Claude · haiku-4-5" },
  { value: "deepseek-chat", label: "DeepSeek · deepseek-chat" },
  { value: "deepseek-reasoner", label: "DeepSeek · deepseek-reasoner" },
];

export const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
export const DEEPSEEK_CHAT_URL = "https://api.deepseek.com/chat/completions";
export const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2023-06-01";

export function getOpenAiApiKey(): string {
  return String(import.meta.env.VITE_OPENAI_API_KEY ?? "").trim();
}

export function getAnthropicApiKey(): string {
  return String(import.meta.env.VITE_ANTHROPIC_API_KEY ?? "").trim();
}

export function getDeepSeekApiKey(): string {
  return String(import.meta.env.VITE_DEEPSEEK_API_KEY ?? "").trim();
}

export function getDefaultTextTranslationModel(): string {
  return String(import.meta.env.VITE_OPENAI_MODEL ?? "").trim() || "gpt-4o";
}

export function inferTextTranslationProvider(model: string): TextTranslationProvider {
  const m = (model || "").trim().toLowerCase();
  if (m.startsWith("claude")) return "claude";
  if (m.startsWith("deepseek")) return "deepseek";
  return "openai";
}

export function missingKeyForTextModel(model: string): string | null {
  const p = inferTextTranslationProvider(model);
  if (p === "claude" && !getAnthropicApiKey()) return "VITE_ANTHROPIC_API_KEY";
  if (p === "deepseek" && !getDeepSeekApiKey()) return "VITE_DEEPSEEK_API_KEY";
  if (p === "openai" && !getOpenAiApiKey()) return "VITE_OPENAI_API_KEY";
  return null;
}

export function buildTranslationMessages(opts: {
  sourceField: string;
  sourceText: string;
  translationField: string;
  translationText: string;
  translationLang: string;
}): { system: string; user: string } {
  const system =
    `You write flashcard translations in ${opts.translationLang}. ` +
    "Keep the meaning faithful to the source. Do not add explanations, " +
    "notes, or quotes. Reply with ONLY the translation text.";
  const user =
    `Source field (${opts.sourceField}):\n${opts.sourceText}\n\n` +
    `Current translation (${opts.translationField}):\n${opts.translationText || "(empty)"}\n\n` +
    `Write an improved ${opts.translationLang} translation.`;
  return { system, user };
}

function stripWrappingQuotes(text: string): string {
  const t = text.trim();
  if (t.length >= 2 && t[0] === t[t.length - 1] && (t[0] === '"' || t[0] === "'")) {
    return t.slice(1, -1).trim();
  }
  return t;
}

async function chatOpenAiCompatible(opts: {
  url: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
  fetchImpl: typeof fetch;
  providerLabel: string;
}): Promise<string> {
  const res = await opts.fetchImpl(opts.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      temperature: 0.3,
      max_tokens: 1024,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    }),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(`${opts.providerLabel} HTTP ${res.status}: ${detail}`);
  }
  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = stripWrappingQuotes(body.choices?.[0]?.message?.content ?? "");
  if (!text) throw new Error(`${opts.providerLabel} returned empty translation`);
  return text;
}

async function chatClaude(opts: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  fetchImpl: typeof fetch;
}): Promise<string> {
  const res = await opts.fetchImpl(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "x-api-key": opts.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      // Required for browser CORS; without it fetch fails as "Failed to fetch".
      "anthropic-dangerous-direct-browser-access": "true",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: 1024,
      temperature: 0.3,
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
    }),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(`Claude HTTP ${res.status}: ${detail}`);
  }
  const body = (await res.json()) as {
    content?: { type?: string; text?: string }[];
  };
  const parts =
    body.content
      ?.filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => (b.text ?? "").trim())
      .filter(Boolean) ?? [];
  const text = stripWrappingQuotes(parts.join("\n"));
  if (!text) throw new Error("Claude returned empty translation");
  return text;
}

/** @deprecated Prefer translateFactText — kept for existing tests. */
export async function translateWithOpenAi(opts: {
  model: string;
  sourceField: string;
  sourceText: string;
  translationField: string;
  translationText: string;
  translationLang: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  return translateFactText({ ...opts, apiKeys: { openai: opts.apiKey } });
}

export async function translateFactText(opts: {
  model: string;
  sourceField: string;
  sourceText: string;
  translationField: string;
  translationText: string;
  translationLang: string;
  apiKeys?: { openai?: string; anthropic?: string; deepseek?: string };
  fetchImpl?: typeof fetch;
}): Promise<string> {
  if (!opts.sourceText.trim()) {
    throw new Error("Source text is empty");
  }
  const provider = inferTextTranslationProvider(opts.model);
  const { system, user } = buildTranslationMessages(opts);
  // Bind: extracting `fetch` and calling it unbound throws Illegal invocation.
  const fetchFn = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);

  try {
    if (provider === "openai") {
      const apiKey = (opts.apiKeys?.openai ?? getOpenAiApiKey()).trim();
      if (!apiKey) {
        throw new Error(
          "VITE_OPENAI_API_KEY is not set (use ./run-dev.sh so .env / quality-tools/.env are loaded)"
        );
      }
      return await chatOpenAiCompatible({
        url: OPENAI_CHAT_URL,
        apiKey,
        model: opts.model,
        system,
        user,
        fetchImpl: fetchFn,
        providerLabel: "OpenAI",
      });
    }

    if (provider === "deepseek") {
      const apiKey = (opts.apiKeys?.deepseek ?? getDeepSeekApiKey()).trim();
      if (!apiKey) {
        throw new Error(
          "VITE_DEEPSEEK_API_KEY is not set (use ./run-dev.sh so .env / quality-tools/.env are loaded)"
        );
      }
      return await chatOpenAiCompatible({
        url: DEEPSEEK_CHAT_URL,
        apiKey,
        model: opts.model,
        system,
        user,
        fetchImpl: fetchFn,
        providerLabel: "DeepSeek",
      });
    }

    const apiKey = (opts.apiKeys?.anthropic ?? getAnthropicApiKey()).trim();
    if (!apiKey) {
      throw new Error(
        "VITE_ANTHROPIC_API_KEY is not set (use ./run-dev.sh so .env / quality-tools/.env are loaded)"
      );
    }
    return await chatClaude({
      apiKey,
      model: opts.model,
      system,
      user,
      fetchImpl: fetchFn,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      throw new Error(
        `${provider} request blocked or unreachable (${msg}). ` +
          "If using Claude, ensure the app was rebuilt after the browser CORS header fix; " +
          "also check ad blockers and that the API key is loaded."
      );
    }
    throw e;
  }
}
