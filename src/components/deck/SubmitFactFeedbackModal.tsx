import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  entryToDisplayString,
  submitDeckFeedback,
  type DeckItem,
  type Entry,
  type FactItem,
  type FeedbackCategory,
} from "@/lib/api";

const CATEGORY_OPTIONS: { value: FeedbackCategory; label: string }[] = [
  { value: "translation", label: "Translation" },
  { value: "audio", label: "Audio" },
  { value: "typo", label: "Typo" },
  { value: "other", label: "Other" },
];

function entriesEqual(a: Entry[], b: Entry[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

interface SubmitFactFeedbackModalProps {
  open: boolean;
  onClose: () => void;
  deck: DeckItem;
  fact: FactItem;
  token: string;
  onSubmitted: () => void | Promise<void>;
}

export function SubmitFactFeedbackModal({
  open,
  onClose,
  deck,
  fact,
  token,
  onSubmitted,
}: SubmitFactFeedbackModalProps) {
  const [category, setCategory] = useState<FeedbackCategory>("other");
  const [message, setMessage] = useState("");
  const [proposeEdits, setProposeEdits] = useState(false);
  const [proposedEntries, setProposedEntries] = useState<Entry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setCategory("other");
    setMessage("");
    setProposeEdits(false);
    setProposedEntries(fact.entries.map((e) => ({ ...e })));
    setError("");
  }, [open, fact]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = message.trim();
    const hasProposal =
      proposeEdits && proposedEntries.length > 0 && !entriesEqual(proposedEntries, fact.entries);

    if (!hasProposal && !trimmed) {
      setError("Add a message or propose corrected entries.");
      return;
    }
    if (hasProposal && entriesEqual(proposedEntries, fact.entries)) {
      setError("Proposed entries must differ from the current fact.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await submitDeckFeedback(
        deck.id,
        {
          fact_id: fact.id,
          category,
          ...(trimmed ? { message: trimmed } : {}),
          ...(hasProposal ? { proposed_entries: proposedEntries } : {}),
        },
        token
      );
      onClose();
      await onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-feedback-title"
    >
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative z-50 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border bg-card p-6 shadow-lg flex flex-col gap-4">
        <h2 id="submit-feedback-title" className="text-lg font-semibold">
          Report to author
        </h2>
        <p className="text-sm text-muted-foreground">
          Send feedback about fact <span className="font-mono text-xs">{fact.id}</span> to the
          source deck author. Facts on imported decks are read-only; the author can accept
          proposals into their working copy and publish an update.
        </p>
        <div className="rounded border bg-muted/30 px-3 py-2 text-sm space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Current fact</p>
          {fact.entries.map((entry, i) => (
            <p key={i}>
              <span className="text-muted-foreground">
                {i < deck.fields.length ? deck.fields[i] : `Field ${i + 1}`}:{" "}
              </span>
              {entryToDisplayString(entry)}
            </p>
          ))}
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor="feedback-category">Category</Label>
            <select
              id="feedback-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
              disabled={submitting}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="feedback-message">Message</Label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={submitting}
              rows={4}
              maxLength={2000}
              placeholder="Describe the issue (required unless you propose corrected entries)"
              className="flex min-h-[4rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={proposeEdits}
              onChange={(e) => setProposeEdits(e.target.checked)}
              disabled={submitting}
              className="rounded border-input"
            />
            Propose corrected entries
          </label>
          {proposeEdits && (
            <div className="space-y-3 border-t pt-3">
              {proposedEntries.map((entry, i) => (
                <div key={i} className="space-y-1">
                  <Label htmlFor={`proposed-entry-${i}`}>
                    {i < deck.fields.length ? deck.fields[i] : `Field ${i + 1}`}
                  </Label>
                  <textarea
                    id={`proposed-entry-${i}`}
                    value={entry.text ?? ""}
                    onChange={(e) => {
                      const next = proposedEntries.map((ent, j) =>
                        j === i ? { ...ent, text: e.target.value } : ent
                      );
                      setProposedEntries(next);
                    }}
                    disabled={submitting}
                    rows={3}
                    className="flex min-h-[3rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Media references are kept from the snapshot; edit text fields only.
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Sending…" : "Send feedback"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
