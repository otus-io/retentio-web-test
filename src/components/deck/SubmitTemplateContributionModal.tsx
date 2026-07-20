import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { submitTemplateContribution, type DeckItem, type FactItem } from "@/lib/api";

interface SubmitTemplateContributionModalProps {
  open: boolean;
  onClose: () => void;
  deck: DeckItem;
  fact: FactItem;
  /** One card template [[front indexes],[back indexes]]. */
  template: number[][];
  token: string;
  onSubmitted: () => void | Promise<void>;
}

export function SubmitTemplateContributionModal({
  open,
  onClose,
  fact,
  template,
  token,
  onSubmitted,
}: SubmitTemplateContributionModalProps) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setMessage("");
    setError("");
  }, [open, fact.id, template]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!Array.isArray(template) || template.length < 2) {
      setError("Current card has no valid template to contribute.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const trimmed = message.trim();
      await submitTemplateContribution(
        deck.id,
        fact.id,
        {
          template,
          ...(trimmed ? { message: trimmed } : {}),
        },
        token
      );
      onClose();
      await onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit template");
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
      aria-labelledby="template-contribution-title"
    >
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative z-50 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border bg-card p-6 shadow-lg flex flex-col gap-4">
        <h2 id="template-contribution-title" className="text-lg font-semibold">
          Contribute card template
        </h2>
        <p className="text-sm text-muted-foreground">
          Suggest this card layout for fact{" "}
          <span className="font-mono text-xs">{fact.id}</span>. Scheduling and review history are
          not shared.
        </p>
        <pre className="rounded border bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
          {JSON.stringify(template)}
        </pre>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor="template-contribution-message">Message (optional)</Label>
            <textarea
              id="template-contribution-message"
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
              {submitting ? "Sending…" : "Send template"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
