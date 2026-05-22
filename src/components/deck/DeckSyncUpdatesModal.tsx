import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  deckHasUpdatesAvailable,
  entryToDisplayString,
  getDeckUpdates,
  syncDeck,
  type DeckItem,
  type DeckUpdatesData,
  type Entry,
  type FactItem,
} from "@/lib/api";

interface DeckSyncUpdatesModalProps {
  open: boolean;
  onClose: () => void;
  deck: DeckItem;
  token: string;
  onSynced: () => void | Promise<void>;
}

function formatFactPreview(fact: FactItem | undefined): string {
  if (!fact?.entries?.length) return "(empty)";
  return fact.entries.map((e) => entryToDisplayString(e as Entry)).join(" · ");
}

function UpdatesDiffBody({ updates }: { updates: DeckUpdatesData }) {
  const { added_facts, removed_facts, edited_facts, media_changes } = updates;
  const hasDiff =
    added_facts.length > 0 ||
    removed_facts.length > 0 ||
    edited_facts.length > 0 ||
    media_changes.length > 0;

  if (!hasDiff) {
    return <p className="text-sm text-muted-foreground">No content changes in the latest version.</p>;
  }

  return (
    <div className="space-y-4 text-sm max-h-[50vh] overflow-y-auto">
      {added_facts.length > 0 && (
        <section>
          <p className="font-medium text-green-700 dark:text-green-400">
            Added facts ({added_facts.length})
          </p>
          <ul className="mt-1 list-disc pl-5 space-y-0.5 font-mono text-xs">
            {added_facts.map((f) => (
              <li key={f.fact_id}>{f.fact_id}</li>
            ))}
          </ul>
        </section>
      )}
      {removed_facts.length > 0 && (
        <section>
          <p className="font-medium text-destructive">
            Removed facts ({removed_facts.length})
          </p>
          <ul className="mt-1 list-disc pl-5 space-y-0.5 font-mono text-xs">
            {removed_facts.map((f) => (
              <li key={f.fact_id}>{f.fact_id}</li>
            ))}
          </ul>
        </section>
      )}
      {edited_facts.length > 0 && (
        <section>
          <p className="font-medium">Edited facts ({edited_facts.length})</p>
          <ul className="mt-2 space-y-3">
            {edited_facts.map((ef) => (
              <li key={ef.fact_id} className="rounded border p-2 space-y-1">
                <p className="font-mono text-xs text-muted-foreground">{ef.fact_id}</p>
                <p>
                  <span className="text-muted-foreground">Before: </span>
                  {formatFactPreview(ef.before)}
                </p>
                <p>
                  <span className="text-muted-foreground">After: </span>
                  {formatFactPreview(ef.after)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {media_changes.length > 0 && (
        <section>
          <p className="font-medium">Media changes ({media_changes.length})</p>
          <ul className="mt-1 space-y-1 font-mono text-xs">
            {media_changes.map((m) => (
              <li key={m.media_id}>
                {m.media_id}
                {m.before_hash || m.after_hash
                  ? ` (${m.before_hash?.slice(0, 8) ?? "—"} → ${m.after_hash?.slice(0, 8) ?? "—"})`
                  : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function DeckSyncUpdatesModal({
  open,
  onClose,
  deck,
  token,
  onSynced,
}: DeckSyncUpdatesModalProps) {
  const [updates, setUpdates] = useState<DeckUpdatesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  const loadUpdates = useCallback(async () => {
    if (!token || !deck.id) return;
    setLoading(true);
    setError("");
    try {
      const res = await getDeckUpdates(deck.id, token);
      setUpdates(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load updates");
      setUpdates(null);
    } finally {
      setLoading(false);
    }
  }, [deck.id, token]);

  useEffect(() => {
    if (open) void loadUpdates();
    else {
      setUpdates(null);
      setError("");
    }
  }, [open, loadUpdates]);

  async function handleAccept() {
    if (!token || !updates) return;
    setSyncing(true);
    setError("");
    try {
      await syncDeck(deck.id, { target_version: updates.latest_version }, token);
      onClose();
      await onSynced();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  if (!open) return null;

  const canAccept = updates != null && deckHasUpdatesAvailable(updates);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deck-sync-updates-title"
    >
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative z-50 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border bg-card p-6 shadow-lg flex flex-col gap-4">
        <h2 id="deck-sync-updates-title" className="text-lg font-semibold">
          Review deck update
        </h2>
        {updates && (
          <p className="text-sm text-muted-foreground">
            Pinned v{updates.source_version} → latest v{updates.latest_version}
          </p>
        )}
        {loading && <p className="text-sm text-muted-foreground">Loading changes…</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {updates && !loading && <UpdatesDiffBody updates={updates} />}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={syncing}>
            {canAccept ? "Dismiss" : "Close"}
          </Button>
          {canAccept && (
            <Button size="sm" onClick={() => void handleAccept()} disabled={syncing || loading}>
              {syncing ? "Accepting…" : "Accept update"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
