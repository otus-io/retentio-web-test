import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  entryToDisplayString,
  submitDeckTagContribution,
  submitFactAddContribution,
  submitFactEditContribution,
  submitFactTagContribution,
  submitFieldRenameContribution,
  submitTemplateContribution,
  type DeckItem,
  type Entry,
  type FactItem,
} from "@/lib/api";
import {
  clearPendingContributions,
  formatContributionKind,
  listPendingContributions,
  listSentContributions,
  markPendingAsSent,
  removePendingContribution,
  type ContributionBoxKind,
  type PendingContributionItem,
  type SentContributionItem,
} from "@/lib/pendingContributions";
import { formatRelativePast } from "@/lib/unixTime";

type Tab = "pending" | "sent";

interface PendingContributionsOutboxModalProps {
  open: boolean;
  onClose: () => void;
  deck: DeckItem;
  token: string;
  factsById?: Record<string, FactItem>;
  onChanged?: () => void;
  onSubmittedBatch?: (sentCount: number) => void | Promise<void>;
}

function rowPreview(
  item: PendingContributionItem | SentContributionItem,
  fact: FactItem | undefined,
  fields: string[]
): string {
  if ("addTags" in item || "removeTags" in item) {
    const p = item as PendingContributionItem;
    const parts: string[] = [];
    if (p.addTags?.length) parts.push(`+${p.addTags.join(", ")}`);
    if (p.removeTags?.length) parts.push(`−${p.removeTags.join(", ")}`);
    if (parts.length) return parts.join(" · ");
  }
  if ("proposedFields" in item && (item as PendingContributionItem).proposedFields?.length) {
    return (item as PendingContributionItem).proposedFields!.join(" · ");
  }
  if (fact?.entries?.length) {
    return fact.entries.map((e) => entryToDisplayString(e as Entry)).join(" · ");
  }
  if (item.preview?.trim()) return item.preview.trim();
  return fields.length ? `(${fields[0]}…)` : "(no preview)";
}

async function submitPendingItem(
  deckId: string,
  item: PendingContributionItem,
  token: string,
  message?: string
): Promise<string | undefined> {
  const bodyMsg = message?.trim() ? { message: message.trim() } : {};
  switch (item.kind) {
    case "edit": {
      if (!item.factId) throw new Error("missing fact id");
      const res = await submitFactEditContribution(deckId, item.factId, bodyMsg, token);
      return res.data.contribution_id;
    }
    case "add": {
      if (!item.factId) throw new Error("missing fact id");
      const res = await submitFactAddContribution(deckId, item.factId, bodyMsg, token);
      return res.data.contribution_id;
    }
    case "deck_tags": {
      const res = await submitDeckTagContribution(
        deckId,
        {
          ...(item.addTags?.length ? { add_tags: item.addTags } : {}),
          ...(item.removeTags?.length ? { remove_tags: item.removeTags } : {}),
          ...bodyMsg,
        },
        token
      );
      return res.data.contribution_id;
    }
    case "fact_tags": {
      if (!item.factId) throw new Error("missing fact id");
      const res = await submitFactTagContribution(
        deckId,
        item.factId,
        {
          ...(item.addTags?.length ? { add_tags: item.addTags } : {}),
          ...(item.removeTags?.length ? { remove_tags: item.removeTags } : {}),
          ...bodyMsg,
        },
        token
      );
      return res.data.contribution_id;
    }
    case "template": {
      if (!item.factId || !item.template) throw new Error("missing template");
      const res = await submitTemplateContribution(
        deckId,
        item.factId,
        { template: item.template, ...bodyMsg },
        token
      );
      return res.data.contribution_id;
    }
    case "field_rename": {
      if (!item.proposedFields?.length) throw new Error("missing proposed fields");
      const res = await submitFieldRenameContribution(
        deckId,
        { proposed_fields: item.proposedFields, ...bodyMsg },
        token
      );
      return res.data.contribution_id;
    }
    case "report":
      throw new Error("reports are sent from the card menu");
    default: {
      const _exhaustive: never = item.kind;
      throw new Error(`unsupported kind ${_exhaustive}`);
    }
  }
}

export function PendingContributionsOutboxModal({
  open,
  onClose,
  deck,
  token,
  factsById = {},
  onChanged,
  onSubmittedBatch,
}: PendingContributionsOutboxModalProps) {
  const [tab, setTab] = useState<Tab>("pending");
  const [pending, setPending] = useState<PendingContributionItem[]>([]);
  const [sent, setSent] = useState<SentContributionItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(() => {
    setPending(listPendingContributions(deck.id));
    setSent(listSentContributions(deck.id));
    setSelected((prev) => {
      const ids = new Set(listPendingContributions(deck.id).map((i) => i.id));
      const kept = new Set<string>();
      for (const id of prev) {
        if (ids.has(id)) kept.add(id);
      }
      return kept;
    });
  }, [deck.id]);

  useEffect(() => {
    if (!open) {
      setError("");
      setNotice("");
      setMessage("");
      setSubmitting(false);
      setSelected(new Set());
      setTab("pending");
      return;
    }
    refresh();
    const p = listPendingContributions(deck.id);
    setTab(p.length > 0 ? "pending" : "sent");
  }, [open, refresh, deck.id]);

  const allSelected = pending.length > 0 && selected.size === pending.length;
  const someSelected = selected.size > 0 && selected.size < pending.length;

  const selectedItems = useMemo(
    () => pending.filter((i) => selected.has(i.id)),
    [pending, selected]
  );

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(pending.map((i) => i.id)));
  }

  function handleDismissSelected() {
    if (selectedItems.length === 0) return;
    const n = selectedItems.length;
    for (const item of selectedItems) {
      removePendingContribution(deck.id, item.id);
    }
    refresh();
    onChanged?.();
    setNotice(`Dismissed ${n} item(s).`);
  }

  function handleClearAllPending() {
    if (pending.length === 0) return;
    const n = pending.length;
    clearPendingContributions(deck.id);
    refresh();
    onChanged?.();
    setSelected(new Set());
    setNotice(`Cleared ${n} pending item(s).`);
  }

  async function handleSendSelected() {
    if (selectedItems.length === 0) return;
    setSubmitting(true);
    setError("");
    setNotice("");
    const trimmed = message.trim();
    let sentCount = 0;
    const failures: string[] = [];

    for (const item of selectedItems) {
      try {
        const contributionId = await submitPendingItem(deck.id, item, token, trimmed || undefined);
        markPendingAsSent(deck.id, item.id, {
          contributionId,
          message: trimmed || undefined,
        });
        sentCount += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "send failed";
        failures.push(`${formatContributionKind(item.kind)}: ${msg}`);
      }
    }

    refresh();
    onChanged?.();
    if (sentCount > 0) {
      await onSubmittedBatch?.(sentCount);
      setNotice(
        failures.length === 0
          ? `Sent ${sentCount} contribution(s) to the author.`
          : `Sent ${sentCount}; ${failures.length} failed.`
      );
      if (failures.length === 0) setTab("sent");
    }
    if (failures.length > 0) {
      setError(failures.slice(0, 3).join(" · ") + (failures.length > 3 ? "…" : ""));
    }
    setSubmitting(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contributions-box-title"
    >
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative z-50 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border bg-card p-6 shadow-lg flex flex-col gap-4">
        <h2 id="contributions-box-title" className="text-lg font-semibold">
          Contributions
        </h2>
        <p className="text-sm text-muted-foreground">
          Pending local changes ready to send, and a record of what you already sent from this
          browser.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={tab === "pending" ? "default" : "outline"}
            onClick={() => setTab("pending")}
            disabled={submitting}
          >
            Pending ({pending.length})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tab === "sent" ? "default" : "outline"}
            onClick={() => setTab("sent")}
            disabled={submitting}
          >
            Sent ({sent.length})
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {notice && (
          <p className="text-sm text-green-800 dark:text-green-200 rounded border border-green-600/40 bg-green-600/10 px-3 py-2">
            {notice}
          </p>
        )}

        {tab === "pending" && (
          <>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing pending. Edit facts, add facts, or stage tag/field suggestions — they will
                show up here until you send them.
              </p>
            ) : (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={toggleAll}
                    disabled={submitting}
                    className="h-4 w-4 rounded border"
                  />
                  <span>Select all ({pending.length})</span>
                </label>
                <ul className="space-y-3 list-none">
                  {pending.map((item) => {
                    const fact = item.factId ? factsById[item.factId] : undefined;
                    return (
                      <li key={item.id} className="rounded-lg border p-3 space-y-2 text-sm">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selected.has(item.id)}
                            onChange={() => toggleOne(item.id)}
                            disabled={submitting}
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border"
                          />
                          <span className="min-w-0 flex-1 space-y-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border px-2 py-0.5 text-xs">
                                {formatContributionKind(item.kind)}
                              </span>
                              <span
                                className="text-xs text-muted-foreground"
                                title={new Date(item.savedAt).toLocaleString()}
                              >
                                {formatRelativePast(item.savedAt)}
                              </span>
                              {item.factId && (
                                <span className="font-mono text-xs text-muted-foreground">
                                  {item.factId}
                                </span>
                              )}
                            </span>
                            <span className="block">{rowPreview(item, fact, deck.fields)}</span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <div className="space-y-2">
                  <Label htmlFor="pending-batch-message">Message (optional)</Label>
                  <textarea
                    id="pending-batch-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={submitting}
                    rows={3}
                    maxLength={2000}
                    placeholder="Optional note for the author"
                    className="flex min-h-[3rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </>
            )}
          </>
        )}

        {tab === "sent" && (
          <>
            {sent.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No sent contributions stored yet on this device.
              </p>
            ) : (
              <ul className="space-y-3 list-none">
                {sent.map((item) => {
                  const fact = item.factId ? factsById[item.factId] : undefined;
                  return (
                    <li key={item.id} className="rounded-lg border p-3 space-y-1 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border px-2 py-0.5 text-xs">
                          {formatContributionKind(item.kind as ContributionBoxKind)}
                        </span>
                        <span
                          className="text-xs text-muted-foreground"
                          title={new Date(item.sentAt).toLocaleString()}
                        >
                          {formatRelativePast(item.sentAt)}
                        </span>
                        {item.contributionId && (
                          <span className="font-mono text-xs text-muted-foreground">
                            {item.contributionId}
                          </span>
                        )}
                      </div>
                      <p>{rowPreview(item, fact, deck.fields)}</p>
                      {item.message?.trim() && (
                        <p className="text-muted-foreground whitespace-pre-wrap">{item.message}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Close
          </Button>
          {tab === "pending" && pending.length > 0 && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={submitting || selected.size === 0}
                onClick={handleDismissSelected}
              >
                Dismiss selected
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={submitting}
                onClick={handleClearAllPending}
              >
                Clear all pending
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={submitting || selected.size === 0}
                onClick={() => void handleSendSelected()}
              >
                {submitting
                  ? "Sending…"
                  : selected.size === 0
                    ? "Send selected"
                    : `Send selected (${selected.size})`}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
