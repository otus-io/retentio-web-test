import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  entryToDisplayString,
  submitFactAddContribution,
  submitFactEditContribution,
  submitFactReport,
  type DeckItem,
  type FactItem,
} from "@/lib/api";

export type FactContributionKind = "edit" | "add" | "report";

interface SubmitFactContributionModalProps {
  open: boolean;
  onClose: () => void;
  deck: DeckItem;
  fact: FactItem;
  kind: FactContributionKind;
  token: string;
  onSubmitted: (kind: FactContributionKind) => void | Promise<void>;
}

const TITLES: Record<FactContributionKind, string> = {
  edit: "Send edit to author",
  add: "Send new fact to author",
  report: "Report to author",
};

const SUBMIT_LABELS: Record<FactContributionKind, string> = {
  edit: "Send edit",
  add: "Send fact",
  report: "Send report",
};

const HELPERS: Record<FactContributionKind, string> = {
  edit: "Your private overlay will be sent as a proposal. The author can accept it into their working copy.",
  add: "This local-only fact will be sent as a proposal. The fact must have been added on this imported deck.",
  report: "Sends a message-only report about this fact. It does not share your private overlay.",
};

export function SubmitFactContributionModal({
  open,
  onClose,
  deck,
  fact,
  kind,
  token,
  onSubmitted,
}: SubmitFactContributionModalProps) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setMessage("");
    setError("");
  }, [open, fact, kind]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = message.trim();
    if (kind === "report" && !trimmed) {
      setError("Add a message describing the issue.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      if (kind === "report") {
        await submitFactReport(deck.id, fact.id, { message: trimmed }, token);
      } else if (kind === "edit") {
        await submitFactEditContribution(
          deck.id,
          fact.id,
          trimmed ? { message: trimmed } : {},
          token
        );
      } else {
        await submitFactAddContribution(
          deck.id,
          fact.id,
          trimmed ? { message: trimmed } : {},
          token
        );
      }
      onClose();
      await onSubmitted(kind);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit contribution");
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
      aria-labelledby="submit-contribution-title"
    >
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative z-50 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border bg-card p-6 shadow-lg flex flex-col gap-4">
        <h2 id="submit-contribution-title" className="text-lg font-semibold">
          {TITLES[kind]}
        </h2>
        <p className="text-sm text-muted-foreground">{HELPERS[kind]}</p>
        <p className="text-sm text-muted-foreground">
          Fact <span className="font-mono text-xs">{fact.id}</span>
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
            <Label htmlFor="contribution-message">
              Message{kind === "report" ? "" : " (optional)"}
            </Label>
            <textarea
              id="contribution-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={submitting}
              rows={4}
              maxLength={2000}
              placeholder={
                kind === "report" ? "Describe the issue" : "Optional note for the author"
              }
              className="flex min-h-[4rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Sending…" : SUBMIT_LABELS[kind]}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
