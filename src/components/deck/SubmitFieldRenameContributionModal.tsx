import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DeckItem } from "@/lib/api";

export interface StagedFieldRenameContribution {
  proposedFields: string[];
  message?: string;
}

interface SubmitFieldRenameContributionModalProps {
  open: boolean;
  onClose: () => void;
  deck: DeckItem;
  /** Stage into the contributions box (pending) instead of sending immediately. */
  onStage: (payload: StagedFieldRenameContribution) => void | Promise<void>;
}

export function SubmitFieldRenameContributionModal({
  open,
  onClose,
  deck,
  onStage,
}: SubmitFieldRenameContributionModalProps) {
  const [fields, setFields] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setFields([...deck.fields]);
    setMessage("");
    setError("");
  }, [open, deck.fields]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const proposed = fields.map((f) => f.trim());
    if (proposed.some((f) => !f)) {
      setError("Every field label must be non-empty.");
      return;
    }
    if (proposed.length !== deck.fields.length) {
      setError("Field count must match the source deck (rename only).");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const trimmed = message.trim();
      await onStage({
        proposedFields: proposed,
        ...(trimmed ? { message: trimmed } : {}),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stage field rename");
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
      aria-labelledby="field-rename-contribution-title"
    >
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative z-50 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border bg-card p-6 shadow-lg flex flex-col gap-4">
        <h2 id="field-rename-contribution-title" className="text-lg font-semibold">
          Suggest field renames
        </h2>
        <p className="text-sm text-muted-foreground">
          Adds this to your contributions box as pending. Open Contributions to review and send.
          Field count must stay the same.
        </p>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="space-y-3">
            {fields.map((label, i) => (
              <div key={i} className="space-y-1">
                <Label htmlFor={`proposed-field-${i}`}>
                  Field {i + 1}
                  {deck.fields[i] ? ` (was “${deck.fields[i]}”)` : ""}
                </Label>
                <Input
                  id={`proposed-field-${i}`}
                  value={label}
                  onChange={(e) => {
                    const next = [...fields];
                    next[i] = e.target.value;
                    setFields(next);
                  }}
                  disabled={submitting}
                />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="field-rename-message">Message (optional)</Label>
            <textarea
              id="field-rename-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={submitting}
              rows={3}
              maxLength={2000}
              className="flex min-h-[3rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Saving…" : "Add to contributions"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
