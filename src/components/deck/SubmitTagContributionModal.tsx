import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DeckItem, FactItem } from "@/lib/api";

export type TagContributionScope = "deck" | "fact";

export interface StagedTagContribution {
  scope: TagContributionScope;
  factId?: string;
  addTags: string[];
  removeTags: string[];
  message?: string;
}

interface SubmitTagContributionModalProps {
  open: boolean;
  onClose: () => void;
  deck: DeckItem;
  fact?: FactItem | null;
  scope: TagContributionScope;
  /** Stage into the contributions box (pending) instead of sending immediately. */
  onStage: (payload: StagedTagContribution) => void | Promise<void>;
}

function splitTagNames(raw: string): string[] {
  return raw
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function SubmitTagContributionModal({
  open,
  onClose,
  deck,
  fact,
  scope,
  onStage,
}: SubmitTagContributionModalProps) {
  const [addTags, setAddTags] = useState("");
  const [removeTags, setRemoveTags] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setAddTags("");
    setRemoveTags("");
    setMessage("");
    setError("");
  }, [open, scope, fact?.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const add_tags = splitTagNames(addTags);
    const remove_tags = splitTagNames(removeTags);
    if (add_tags.length === 0 && remove_tags.length === 0) {
      setError("Add or remove at least one tag name.");
      return;
    }
    if (scope === "fact" && !fact) {
      setError("Fact is required for fact tag contributions.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const trimmed = message.trim();
      await onStage({
        scope,
        factId: scope === "fact" ? fact!.id : undefined,
        addTags: add_tags,
        removeTags: remove_tags,
        ...(trimmed ? { message: trimmed } : {}),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stage tag contribution");
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
      aria-labelledby="tag-contribution-title"
    >
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative z-50 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border bg-card p-6 shadow-lg flex flex-col gap-4">
        <h2 id="tag-contribution-title" className="text-lg font-semibold">
          {scope === "deck" ? "Suggest deck tag changes" : "Suggest fact tag changes"}
        </h2>
        <p className="text-sm text-muted-foreground">
          Adds this to your contributions box as pending. Open Contributions to review and send to
          the author. Deck: <span className="font-mono text-xs">{deck.id}</span>
        </p>
        {scope === "fact" && fact && (
          <p className="text-sm text-muted-foreground">
            Fact <span className="font-mono text-xs">{fact.id}</span>
          </p>
        )}
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor="add-tags">Tags to add (comma-separated)</Label>
            <Input
              id="add-tags"
              value={addTags}
              onChange={(e) => setAddTags(e.target.value)}
              disabled={submitting}
              placeholder="food, beginner"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="remove-tags">Tags to remove (comma-separated)</Label>
            <Input
              id="remove-tags"
              value={removeTags}
              onChange={(e) => setRemoveTags(e.target.value)}
              disabled={submitting}
              placeholder="outdated"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tag-contribution-message">Message (optional)</Label>
            <textarea
              id="tag-contribution-message"
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
