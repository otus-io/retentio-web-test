import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  request,
  type DeckContributionItem,
  type DeckItem,
  type FactItem,
  type GetFactRes,
} from "@/lib/api";
import {
  loadFixFactSettings,
  saveFixFactSettings,
  type FixFactSettings,
} from "@/lib/fixFactSettings";
import {
  TTS_MODEL_OPTIONS,
  getElevenLabsApiKey,
  getElevenLabsVoiceId,
} from "@/lib/fixFactTts";
import { formatRelativePast } from "@/lib/unixTime";
import { FixFactEntriesEditor } from "./FixFactEntriesEditor";

const CUSTOM_MODEL = "__custom__";

function modelSelectValue(current: string, presets: { value: string }[]): string {
  return presets.some((p) => p.value === current) ? current : CUSTOM_MODEL;
}

export function FixFactPanel({
  deck,
  token,
  contribution,
  onBack,
  onResolveAndNext,
}: {
  deck: DeckItem;
  token: string;
  contribution: DeckContributionItem;
  onBack: () => void;
  onResolveAndNext: () => void | Promise<void>;
}) {
  const fields = deck.fields ?? [];
  const factId = (contribution.fact_id ?? "").trim();
  const [settings, setSettings] = useState<FixFactSettings>(() =>
    loadFixFactSettings(deck.id, fields)
  );
  const [ttsModelCustom, setTtsModelCustom] = useState(() => {
    const s = loadFixFactSettings(deck.id, fields);
    return !TTS_MODEL_OPTIONS.some((o) => o.value === s.ttsModel);
  });
  const [fact, setFact] = useState<FactItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const updateSettings = useCallback(
    (patch: Partial<FixFactSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        saveFixFactSettings(deck.id, next);
        return next;
      });
    },
    [deck.id]
  );

  const loadFact = useCallback(async () => {
    if (!factId) {
      setError("Contribution has no fact_id");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await request<GetFactRes>(
        `/api/decks/${encodeURIComponent(deck.id)}/facts/${encodeURIComponent(factId)}`,
        { token }
      );
      setFact(res.data.fact);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load fact");
      setFact(null);
    } finally {
      setLoading(false);
    }
  }, [deck.id, factId, token]);

  useEffect(() => {
    void loadFact();
  }, [loadFact]);

  const missingKeys = useMemo(() => {
    const missing: string[] = [];
    if (!getElevenLabsApiKey()) missing.push("VITE_ELEVENLABS_API_KEY");
    if (!getElevenLabsVoiceId()) missing.push("VITE_ELEVENLABS_VOICE_ID");
    return missing;
  }, []);

  const ttsModelSelect = ttsModelCustom
    ? CUSTOM_MODEL
    : modelSelectValue(settings.ttsModel, TTS_MODEL_OPTIONS);

  async function handleResolveAndNext() {
    setBusy(true);
    setError("");
    try {
      await onResolveAndNext();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Resolve failed");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h3 className="text-base font-semibold">Fix fact</h3>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{contribution.reporter}</span>
            {contribution.created_at && (
              <>
                {" · "}
                <span title={new Date(contribution.created_at).toLocaleString()}>
                  {formatRelativePast(contribution.created_at)}
                </span>
              </>
            )}
            {" · "}
            <span className="font-mono text-xs">{contribution.id}</span>
            {" · fact "}
            <span className="font-mono text-xs">{factId}</span>
          </p>
          {contribution.message?.trim() && (
            <p className="text-sm whitespace-pre-wrap">{contribution.message}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onBack} disabled={busy}>
            Back to list
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleResolveAndNext()}
            disabled={busy || loading}
          >
            Resolve &amp; next
          </Button>
        </div>
      </div>

      {missingKeys.length > 0 && (
        <p className="text-sm rounded border border-amber-600/40 bg-amber-600/10 px-3 py-2 text-amber-950 dark:text-amber-100">
          Missing env for regen: {missingKeys.join(", ")}. Put them in{" "}
          <code className="text-xs">retentio-web-test/.env</code> (or{" "}
          <code className="text-xs">.env.local</code>) with the <code className="text-xs">VITE_</code>{" "}
          prefix, or keep unprefixed keys in{" "}
          <code className="text-xs">retentio-content/quality-tools/.env</code> and restart via{" "}
          <code className="text-xs">./run-dev.sh release</code> (it maps those to{" "}
          <code className="text-xs">VITE_*</code>).
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
        <div className="space-y-1">
          <Label htmlFor="fix-tts-model">TTS model</Label>
          <select
            id="fix-tts-model"
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={ttsModelSelect}
            disabled={busy}
            onChange={(e) => {
              const v = e.target.value;
              if (v === CUSTOM_MODEL) {
                setTtsModelCustom(true);
                return;
              }
              setTtsModelCustom(false);
              updateSettings({ ttsModel: v });
            }}
          >
            {TTS_MODEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
            <option value={CUSTOM_MODEL}>Custom…</option>
          </select>
          {ttsModelCustom && (
            <input
              aria-label="Custom TTS model id"
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 font-mono text-xs"
              value={settings.ttsModel}
              disabled={busy}
              placeholder="eleven_…"
              onChange={(e) => updateSettings({ ttsModel: e.target.value })}
            />
          )}
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading fact…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && fact && (
        <FixFactEntriesEditor
          deckId={deck.id}
          fields={fields}
          factId={factId}
          token={token}
          initialEntries={fact.entries ?? []}
          ttsModel={settings.ttsModel}
          disabled={busy}
          onFactUpdated={(updated) =>
            setFact((prev) => (prev ? { ...prev, ...updated } : updated))
          }
        />
      )}
    </div>
  );
}
