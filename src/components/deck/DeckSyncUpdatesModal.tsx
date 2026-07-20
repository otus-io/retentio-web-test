import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  deckHasUpdatesAvailable,
  entryToDisplayString,
  getDeckUpdates,
  syncDeck,
  type DeckItem,
  type DeckUpdateFactRef,
  type DeckUpdatesData,
  type Entry,
  type FactItem,
  type SyncFactDecision,
  type SyncFactDecisionAction,
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

function defaultDecisionForRemoved(ref: DeckUpdateFactRef): SyncFactDecisionAction {
  if (ref.default_action === "keep" || ref.default_action === "accept") {
    return ref.default_action;
  }
  return ref.has_local_overlay || ref.local ? "keep" : "accept";
}

function defaultDecisionForEdited(aligned: boolean | undefined): SyncFactDecisionAction {
  return aligned ? "accept" : "keep";
}

function FactDecisionToggle({
  factId,
  value,
  onChange,
  hint,
}: {
  factId: string;
  value: SyncFactDecisionAction;
  onChange: (action: SyncFactDecisionAction) => void;
  hint?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="font-mono text-muted-foreground">{factId}</span>
      {hint && <span className="text-muted-foreground">· {hint}</span>}
      <div className="flex gap-1 ml-auto">
        <Button
          type="button"
          size="sm"
          variant={value === "accept" ? "default" : "outline"}
          onClick={() => onChange("accept")}
        >
          Accept
        </Button>
        <Button
          type="button"
          size="sm"
          variant={value === "keep" ? "default" : "outline"}
          onClick={() => onChange("keep")}
        >
          Keep local
        </Button>
      </div>
    </div>
  );
}

function UpdatesDiffBody({
  updates,
  decisions,
  setDecision,
}: {
  updates: DeckUpdatesData;
  decisions: Record<string, SyncFactDecisionAction>;
  setDecision: (factId: string, action: SyncFactDecisionAction) => void;
}) {
  const {
    added_facts,
    removed_facts,
    edited_facts,
    media_changes,
    card_template_changes = [],
  } = updates;
  const hasDiff =
    added_facts.length > 0 ||
    removed_facts.length > 0 ||
    edited_facts.length > 0 ||
    media_changes.length > 0 ||
    card_template_changes.length > 0;

  if (!hasDiff) {
    return <p className="text-sm text-muted-foreground">No content changes in the latest version.</p>;
  }

  return (
    <div className="space-y-4 text-sm max-h-[50vh] overflow-y-auto">
      {added_facts.length > 0 && (
        <section className="space-y-2">
          <p className="font-medium text-green-700 dark:text-green-400">
            Added facts ({added_facts.length})
          </p>
          <ul className="mt-1 space-y-2">
            {added_facts.map((f) => (
              <li key={f.fact_id} className="rounded border p-2 space-y-1">
                <p className="font-mono text-xs text-muted-foreground">
                  {f.fact_id}
                  {f.aligned ? " · aligned" : ""}
                  {f.has_local_overlay ? " · local overlay" : ""}
                </p>
                <p>{formatFactPreview(f.fact)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {removed_facts.length > 0 && (
        <section className="space-y-2">
          <p className="font-medium text-destructive">
            Removed facts ({removed_facts.length})
          </p>
          <ul className="mt-1 space-y-2">
            {removed_facts.map((f) => (
              <li key={f.fact_id} className="rounded border p-2 space-y-2">
                <FactDecisionToggle
                  factId={f.fact_id}
                  value={decisions[f.fact_id] ?? defaultDecisionForRemoved(f)}
                  onChange={(action) => setDecision(f.fact_id, action)}
                  hint={
                    f.has_local_overlay || f.local
                      ? "has local overlay (default keep)"
                      : "default accept"
                  }
                />
                <p className="text-sm">{formatFactPreview(f.fact)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {edited_facts.length > 0 && (
        <section className="space-y-2">
          <p className="font-medium">Edited facts ({edited_facts.length})</p>
          <ul className="mt-2 space-y-3">
            {edited_facts.map((ef) => (
              <li key={ef.fact_id} className="rounded border p-2 space-y-2">
                <FactDecisionToggle
                  factId={ef.fact_id}
                  value={decisions[ef.fact_id] ?? defaultDecisionForEdited(ef.aligned)}
                  onChange={(action) => setDecision(ef.fact_id, action)}
                  hint={
                    ef.aligned
                      ? "aligned with your overlay"
                      : ef.has_local_overlay
                        ? "local overlay differs"
                        : undefined
                  }
                />
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
      {card_template_changes.length > 0 && (
        <section>
          <p className="font-medium">
            Card template changes ({card_template_changes.length})
          </p>
          <ul className="mt-1 space-y-2 text-sm">
            {card_template_changes.map((c) => {
              const related =
                added_facts.find((f) => f.fact_id === c.fact_id)?.fact ??
                edited_facts.find((f) => f.fact_id === c.fact_id)?.after;
              return (
                <li key={c.fact_id} className="rounded border p-2 space-y-1">
                  <p className="font-mono text-xs text-muted-foreground">
                    {c.fact_id}
                    {c.added_templates?.length
                      ? ` · +${c.added_templates.length} template(s)`
                      : ""}
                    {c.removed_templates?.length
                      ? ` · −${c.removed_templates.length} template(s) (cards kept)`
                      : ""}
                  </p>
                  {related && <p>{formatFactPreview(related)}</p>}
                </li>
              );
            })}
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
  const [decisions, setDecisions] = useState<Record<string, SyncFactDecisionAction>>({});
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
      const initial: Record<string, SyncFactDecisionAction> = {};
      for (const f of res.data.removed_facts ?? []) {
        initial[f.fact_id] = defaultDecisionForRemoved(f);
      }
      for (const f of res.data.edited_facts ?? []) {
        initial[f.fact_id] = defaultDecisionForEdited(f.aligned);
      }
      setDecisions(initial);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load updates");
      setUpdates(null);
      setDecisions({});
    } finally {
      setLoading(false);
    }
  }, [deck.id, token]);

  useEffect(() => {
    if (open) void loadUpdates();
    else {
      setUpdates(null);
      setDecisions({});
      setError("");
    }
  }, [open, loadUpdates]);

  const decisionList: SyncFactDecision[] = useMemo(
    () =>
      Object.entries(decisions).map(([fact_id, action]) => ({
        fact_id,
        action,
      })),
    [decisions]
  );

  async function handleAccept() {
    if (!token || !updates) return;
    setSyncing(true);
    setError("");
    try {
      await syncDeck(
        deck.id,
        {
          target_version: updates.latest_version,
          ...(decisionList.length > 0 ? { decisions: decisionList } : {}),
        },
        token
      );
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
            {updates.change_summary ? ` · ${updates.change_summary}` : ""}
          </p>
        )}
        {loading && <p className="text-sm text-muted-foreground">Loading changes…</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {updates && !loading && (
          <UpdatesDiffBody
            updates={updates}
            decisions={decisions}
            setDecision={(factId, action) =>
              setDecisions((prev) => ({ ...prev, [factId]: action }))
            }
          />
        )}
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
