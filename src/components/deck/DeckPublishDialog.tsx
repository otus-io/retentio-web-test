import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import {
  isPublishedSourceDeck,
  publishDeck,
  type DeckItem,
} from "@/lib/api";

interface DeckPublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deck: DeckItem;
  onPublished: (result: { published_version: number; visibility: string }) => void | Promise<void>;
}

export function DeckPublishDialog({
  open,
  onOpenChange,
  deck,
  onPublished,
}: DeckPublishDialogProps) {
  const { token, authReady } = useAuth();
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const firstPublish = !isPublishedSourceDeck(deck);

  async function handlePublish() {
    if (!authReady || !token) {
      setError("Session expired. Please sign in again.");
      return;
    }
    setError("");
    setPublishing(true);
    try {
      const res = await publishDeck(
        deck.id,
        { visibility: firstPublish ? "public" : undefined },
        token
      );
      onOpenChange(false);
      await onPublished(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!publishing) onOpenChange(next);
      }}
      title={firstPublish ? "Publish deck for sharing?" : "Publish update?"}
      confirmLabel={publishing ? "Publishing…" : firstPublish ? "Publish" : "Publish update"}
      cancelLabel="Cancel"
      onConfirm={() => void handlePublish()}
    >
      <div className="space-y-3 text-sm text-foreground">
        {firstPublish ? (
          <>
            <p>
              Publishing makes this deck importable by others. The first publish must be{" "}
              <strong>public</strong>.
            </p>
            <p className="text-destructive font-medium">
              Once published, you cannot delete this deck or change who can import it (visibility
              is permanent).
            </p>
          </>
        ) : (
          <p>
            This creates a new snapshot version for importers. They must review and accept the
            update before it affects their study copy.
          </p>
        )}
        {deck.published_version != null && deck.published_version > 0 && (
          <p className="text-muted-foreground">
            Current published version: v{deck.published_version}
          </p>
        )}
        {error && <p className="text-destructive">{error}</p>}
        {publishing && (
          <p className="text-muted-foreground" aria-live="polite">
            Publishing…
          </p>
        )}
      </div>
    </Dialog>
  );
}
