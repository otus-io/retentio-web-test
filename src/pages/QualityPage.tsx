import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchAllDeckFacts,
  isImportedDeck,
  normalizeStoredMediaRef,
  request,
  type DeckItem,
  type Entry,
  type FactItem,
  type GetDecksRes,
} from "@/lib/api";
import {
  QUALITY_SCORE_BUCKETS,
  QUALITY_SCORE_MAX,
  QUALITY_SCORE_MIN,
  buildQualityHistogram,
  emptyQualityHistogram,
  entriesInBucket,
  fetchAllDeckQuality,
  listQualityEntries,
  putFactQuality,
  withMaxEntryScores,
  withUpdatedEntryScores,
  type EntryQuality,
  type FactQuality,
  type QualityEntryRow,
  type QualityHistogram,
  type QualityScoreBucketKey,
} from "@/lib/quality";
import { AudioPreviewButton } from "@/components/media/AudioPreviewButton";
import { cn } from "@/lib/utils";

const SCORE_OPTIONS = Array.from(
  { length: QUALITY_SCORE_MAX - QUALITY_SCORE_MIN + 1 },
  (_, i) => QUALITY_SCORE_MIN + i
);

function formatModel(model: string | null): string {
  return model ? ` (${model})` : "";
}

function AspectScoreControl({
  score,
  model,
  disabled,
  ariaLabel,
  onChange,
}: {
  score: number | null;
  model: string | null;
  disabled?: boolean;
  ariaLabel: string;
  onChange: (score: number) => void;
}) {
  if (score == null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <select
        aria-label={ariaLabel}
        className="h-8 rounded-md border border-input bg-background px-2 text-sm tabular-nums"
        value={score}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {SCORE_OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{formatModel(model)}</span>
    </span>
  );
}

function buildFactsById(facts: FactItem[]): Record<string, FactItem> {
  const out: Record<string, FactItem> = {};
  for (const fact of facts) out[fact.id] = fact;
  return out;
}

function entryHasContent(entry: Entry | undefined): boolean {
  if (!entry) return false;
  return Boolean(
    (entry.text != null && entry.text !== "") ||
      entry.audio ||
      entry.image ||
      entry.video ||
      entry.json
  );
}

function QualityFactContent({
  fact,
  fieldNames,
  highlightEntryIndex,
  token,
}: {
  fact: FactItem | undefined;
  fieldNames: string[];
  highlightEntryIndex: string;
  token: string;
}) {
  if (!fact) {
    return <span className="text-muted-foreground">(fact missing)</span>;
  }

  return (
    <div className="space-y-2">
      {fact.entries.map((entry, i) => {
        const key = String(i);
        const label = fieldNames[i]?.trim() || `Field ${i}`;
        const highlighted = key === highlightEntryIndex;
        const audioId = normalizeStoredMediaRef(entry.audio);
        if (!entryHasContent(entry)) {
          return (
            <div
              key={key}
              className={cn("rounded px-1.5 py-1", highlighted && "bg-accent/70")}
            >
              <span className="text-xs font-medium text-muted-foreground">{label}</span>
              <span className="ml-2 text-muted-foreground">—</span>
            </div>
          );
        }
        return (
          <div
            key={key}
            className={cn("space-y-1 rounded px-1.5 py-1", highlighted && "bg-accent/70")}
          >
            <div className="text-xs font-medium text-muted-foreground">{label}</div>
            {entry.text != null && entry.text !== "" && (
              <p className="whitespace-pre-wrap break-words">{entry.text}</p>
            )}
            {audioId && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Audio</span>
                <AudioPreviewButton mediaId={audioId} token={token} />
              </div>
            )}
            {entry.image && (
              <p className="text-xs text-muted-foreground break-all">Image: {entry.image}</p>
            )}
            {entry.video && (
              <p className="text-xs text-muted-foreground break-all">Video: {entry.video}</p>
            )}
            {entry.json && (
              <p className="text-xs text-muted-foreground break-all">JSON: {entry.json}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function QualityPage() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [decks, setDecks] = useState<DeckItem[]>([]);
  const [loadingDecks, setLoadingDecks] = useState(true);
  const [deckId, setDeckId] = useState("");
  const [histogram, setHistogram] = useState<QualityHistogram>(emptyQualityHistogram);
  const [entries, setEntries] = useState<QualityEntryRow[]>([]);
  const [qualityByFactId, setQualityByFactId] = useState<Record<string, FactQuality>>({});
  const [factsById, setFactsById] = useState<Record<string, FactItem>>({});
  const [selectedBucket, setSelectedBucket] = useState<QualityScoreBucketKey | null>(null);
  const [loadingQuality, setLoadingQuality] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  const sourceDecks = useMemo(
    () => decks.filter((d) => !isImportedDeck(d)).sort((a, b) => a.name.localeCompare(b.name)),
    [decks]
  );

  const selectedDeck = useMemo(
    () => sourceDecks.find((d) => d.id === deckId) ?? null,
    [sourceDecks, deckId]
  );

  const fieldNames = selectedDeck?.fields ?? [];

  const maxCount = useMemo(
    () => Math.max(0, ...QUALITY_SCORE_BUCKETS.map((b) => histogram[b.key])),
    [histogram]
  );

  const entryCount = useMemo(
    () => QUALITY_SCORE_BUCKETS.reduce((sum, b) => sum + histogram[b.key], 0),
    [histogram]
  );

  const selectedLabel = useMemo(
    () => QUALITY_SCORE_BUCKETS.find((b) => b.key === selectedBucket)?.label ?? null,
    [selectedBucket]
  );

  const selectedEntries = useMemo(
    () => (selectedBucket ? entriesInBucket(entries, selectedBucket) : []),
    [entries, selectedBucket]
  );

  const fetchDecks = useCallback(async () => {
    if (!token) return;
    setLoadingDecks(true);
    try {
      const res = await request<GetDecksRes>("/api/decks", { token });
      setDecks(res.data.decks);
    } catch {
      setDecks([]);
    } finally {
      setLoadingDecks(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchDecks();
  }, [fetchDecks]);

  useEffect(() => {
    if (!deckId && sourceDecks.length > 0) {
      setDeckId(sourceDecks[0].id);
    }
  }, [deckId, sourceDecks]);

  const applyQualityItems = useCallback((items: FactQuality[]) => {
    const byId: Record<string, FactQuality> = {};
    for (const item of items) byId[item.fact_id] = item;
    setQualityByFactId(byId);
    setHistogram(buildQualityHistogram(items));
    setEntries(listQualityEntries(items));
  }, []);

  const loadQuality = useCallback(async () => {
    if (!token || !deckId) {
      setHistogram(emptyQualityHistogram());
      setEntries([]);
      setQualityByFactId({});
      setFactsById({});
      setSelectedBucket(null);
      return;
    }
    setLoadingQuality(true);
    setError("");
    setSelectedBucket(null);
    try {
      const [items, facts] = await Promise.all([
        fetchAllDeckQuality(deckId, token),
        fetchAllDeckFacts(deckId, token),
      ]);
      applyQualityItems(items);
      setFactsById(buildFactsById(facts));
    } catch (e) {
      setHistogram(emptyQualityHistogram());
      setEntries([]);
      setQualityByFactId({});
      setFactsById({});
      setError(e instanceof Error ? e.message : "Failed to load quality");
    } finally {
      setLoadingQuality(false);
    }
  }, [token, deckId, applyQualityItems]);

  useEffect(() => {
    void loadQuality();
  }, [loadQuality]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  function toggleBucket(key: QualityScoreBucketKey) {
    setSelectedBucket((prev) => (prev === key ? null : key));
  }

  async function saveEntryScores(row: QualityEntryRow, nextEntries: Record<string, EntryQuality>) {
    if (!token || !deckId) return;
    const key = `${row.factId}:${row.entryIndex}`;
    setSavingKey(key);
    setError("");
    try {
      const updated = await putFactQuality(deckId, row.factId, nextEntries, token);
      const nextById = { ...qualityByFactId, [updated.fact_id]: updated };
      setQualityByFactId(nextById);
      const items = Object.values(nextById);
      setHistogram(buildQualityHistogram(items));
      setEntries(listQualityEntries(items));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update quality");
    } finally {
      setSavingKey(null);
    }
  }

  async function handleAspectScoreChange(
    row: QualityEntryRow,
    aspect: "text" | "audio",
    score: number
  ) {
    const current = qualityByFactId[row.factId];
    if (!current) {
      setError("Quality record missing for this fact");
      return;
    }
    const nextEntries = withUpdatedEntryScores(current.entries, row.entryIndex, {
      [aspect]: score,
    });
    await saveEntryScores(row, nextEntries);
  }

  async function handleSetMax(row: QualityEntryRow) {
    const current = qualityByFactId[row.factId];
    if (!current) {
      setError("Quality record missing for this fact");
      return;
    }
    if (row.minScore === QUALITY_SCORE_MAX) return;
    const nextEntries = withMaxEntryScores(current.entries, row.entryIndex);
    await saveEntryScores(row, nextEntries);
  }

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Quality</h1>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link to="/decks">Deck</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/tags">Tags</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/media">Media</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/quality">Quality</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/confidence">Confidence</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/profile">Profile</Link>
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              Logout
            </Button>
          </nav>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Score distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2 max-w-md">
              <Label htmlFor="quality-deck">Source deck</Label>
              {loadingDecks ? (
                <p className="text-sm text-muted-foreground">Loading decks…</p>
              ) : sourceDecks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No source decks. Quality scores are only available on source decks (not imports).
                </p>
              ) : (
                <select
                  id="quality-deck"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={deckId}
                  onChange={(e) => setDeckId(e.target.value)}
                >
                  {sourceDecks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {!deckId || loadingDecks ? null : loadingQuality ? (
              <p className="text-muted-foreground">Loading quality…</p>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {entryCount === 0
                    ? "No scored entries on this deck yet."
                    : `${entryCount} scored ${entryCount === 1 ? "entry" : "entries"} (min aspect score per entry). Click a bar to list entries.`}
                </p>
                <div className="space-y-3" role="list" aria-label="Quality score histogram">
                  {QUALITY_SCORE_BUCKETS.map((b) => {
                    const count = histogram[b.key];
                    const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;
                    const sharePct = entryCount > 0 ? Math.round((count / entryCount) * 100) : 0;
                    const selected = selectedBucket === b.key;
                    return (
                      <button
                        key={b.key}
                        type="button"
                        role="listitem"
                        disabled={count === 0}
                        aria-pressed={selected}
                        onClick={() => toggleBucket(b.key)}
                        className={cn(
                          "grid w-full grid-cols-[4rem_1fr_5.5rem] items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors",
                          count === 0
                            ? "cursor-not-allowed opacity-50"
                            : "hover:bg-accent/60",
                          selected && "bg-accent"
                        )}
                      >
                        <span className="text-sm font-medium tabular-nums">{b.label}</span>
                        <div className="h-7 rounded bg-muted overflow-hidden">
                          <div
                            className="h-full rounded bg-primary/80 transition-[width] duration-300"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground tabular-nums text-right">
                          {count} ({sharePct}%)
                        </span>
                      </button>
                    );
                  })}
                </div>

                {selectedBucket && selectedLabel && (
                  <div className="space-y-3 border-t border-border pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-sm font-semibold">
                        Score {selectedLabel} ({selectedEntries.length})
                      </h2>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedBucket(null)}>
                        Clear
                      </Button>
                    </div>
                    {selectedEntries.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No entries in this range.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border text-left text-muted-foreground">
                              <th className="py-2 pr-3 font-medium">Fact</th>
                              <th className="py-2 pr-3 font-medium">Content</th>
                              <th className="py-2 pr-3 font-medium">Entry</th>
                              <th className="py-2 pr-3 font-medium">Min</th>
                              <th className="py-2 pr-3 font-medium">Text</th>
                              <th className="py-2 pr-3 font-medium">Audio</th>
                              <th className="py-2 font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedEntries.map((row) => {
                              const rowKey = `${row.factId}:${row.entryIndex}`;
                              const saving = savingKey === rowKey;
                              return (
                                <tr
                                  key={rowKey}
                                  className="border-b border-border/60 align-top"
                                >
                                  <td className="py-2 pr-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                                    {row.factId}
                                  </td>
                                  <td className="py-2 pr-3 min-w-[16rem] max-w-xl">
                                    {token ? (
                                      <QualityFactContent
                                        fact={factsById[row.factId]}
                                        fieldNames={fieldNames}
                                        highlightEntryIndex={row.entryIndex}
                                        token={token}
                                      />
                                    ) : null}
                                  </td>
                                  <td className="py-2 pr-3 tabular-nums">{row.entryIndex}</td>
                                  <td className="py-2 pr-3 tabular-nums font-medium">{row.minScore}</td>
                                  <td className="py-2 pr-3">
                                    <AspectScoreControl
                                      score={row.textScore}
                                      model={row.textModel}
                                      disabled={saving || savingKey != null}
                                      ariaLabel={`Text score for entry ${row.entryIndex}`}
                                      onChange={(score) =>
                                        void handleAspectScoreChange(row, "text", score)
                                      }
                                    />
                                  </td>
                                  <td className="py-2 pr-3">
                                    <AspectScoreControl
                                      score={row.audioScore}
                                      model={row.audioModel}
                                      disabled={saving || savingKey != null}
                                      ariaLabel={`Audio score for entry ${row.entryIndex}`}
                                      onChange={(score) =>
                                        void handleAspectScoreChange(row, "audio", score)
                                      }
                                    />
                                  </td>
                                  <td className="py-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      disabled={
                                        saving ||
                                        savingKey != null ||
                                        row.minScore === QUALITY_SCORE_MAX
                                      }
                                      onClick={() => void handleSetMax(row)}
                                    >
                                      {saving ? "Saving…" : "Max"}
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
