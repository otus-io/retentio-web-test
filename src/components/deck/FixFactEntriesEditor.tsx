import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AudioPreviewButton } from "@/components/media/AudioPreviewButton";
import {
  request,
  uploadMultipart,
  type Entry,
  type FactItem,
  type UploadMediaRes,
} from "@/lib/api";
import {
  getElevenLabsApiKey,
  getElevenLabsVoiceId,
  synthesizeWithElevenLabs,
} from "@/lib/fixFactTts";
import { cn } from "@/lib/utils";

type AudioProposal = { kind: "audio"; col: number; blob: Blob; objectUrl: string };
type Proposal = AudioProposal | null;

function cloneEntries(entries: Entry[]): Entry[] {
  return entries.map((e) => ({ ...e }));
}

export function FixFactEntriesEditor({
  deckId,
  fields,
  factId,
  token,
  initialEntries,
  ttsModel,
  highlightCol,
  onFactUpdated,
  disabled,
}: {
  deckId: string;
  fields: string[];
  factId: string;
  token: string;
  initialEntries: Entry[];
  ttsModel: string;
  /** Column index to emphasize (e.g. scored entry on Quality page). */
  highlightCol?: number | null;
  onFactUpdated?: (fact: FactItem) => void;
  disabled?: boolean;
}) {
  const [entries, setEntries] = useState<Entry[]>(() => cloneEntries(initialEntries));
  const [savedTexts, setSavedTexts] = useState<string[]>(() =>
    cloneEntries(initialEntries).map((e) => e.text ?? "")
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [proposal, setProposal] = useState<Proposal>(null);
  const proposalUrlRef = useRef<string | null>(null);
  const proposalReviewRef = useRef<HTMLDivElement | null>(null);
  const syncedFromParentRef = useRef<string>("");

  const replaceProposal = useCallback((next: Proposal) => {
    setProposal((prev) => {
      if (prev?.kind === "audio" && prev.objectUrl) {
        URL.revokeObjectURL(prev.objectUrl);
      }
      if (next?.kind === "audio") {
        proposalUrlRef.current = next.objectUrl;
      } else {
        proposalUrlRef.current = null;
      }
      return next;
    });
  }, []);

  const clearProposal = useCallback(() => {
    replaceProposal(null);
  }, [replaceProposal]);

  useEffect(() => {
    return () => {
      if (proposalUrlRef.current) URL.revokeObjectURL(proposalUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!proposal) return;
    proposalReviewRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [proposal]);

  useEffect(() => {
    const key = `${factId}:${JSON.stringify(initialEntries ?? [])}`;
    if (syncedFromParentRef.current === key) return;
    syncedFromParentRef.current = key;
    const cloned = cloneEntries(initialEntries);
    setEntries(cloned);
    setSavedTexts(cloned.map((e) => e.text ?? ""));
    clearProposal();
    setError("");
    setNotice("");
  }, [factId, initialEntries, clearProposal]);

  const canRegenAudio = Boolean(getElevenLabsApiKey() && getElevenLabsVoiceId());
  const columnCount = Math.max(fields.length, entries.length, 1);

  async function patchEntries(next: Entry[]) {
    await request(`/api/decks/${encodeURIComponent(deckId)}/facts/${encodeURIComponent(factId)}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ entries: next }),
    });
    const cloned = cloneEntries(next);
    syncedFromParentRef.current = `${factId}:${JSON.stringify(cloned)}`;
    setEntries(cloned);
    setSavedTexts(cloned.map((e) => e.text ?? ""));
    onFactUpdated?.({ id: factId, entries: cloned });
  }

  function setEntryText(col: number, text: string) {
    setEntries((prev) => {
      const next = cloneEntries(prev);
      while (next.length <= col) next.push({ text: "" });
      next[col] = { ...next[col], text };
      return next;
    });
  }

  function isTextDirty(col: number): boolean {
    return (entries[col]?.text ?? "") !== (savedTexts[col] ?? "");
  }

  async function handleSaveText(col: number) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = cloneEntries(entries);
      while (next.length <= col) next.push({ text: "" });
      await patchEntries(next);
      setNotice(`Saved text for column ${col}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save text failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRegenAudio(col: number) {
    const text = (entries[col]?.text ?? "").trim();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const blob = await synthesizeWithElevenLabs({
        text,
        modelId: ttsModel,
      });
      const objectUrl = URL.createObjectURL(blob);
      replaceProposal({ kind: "audio", col, blob, objectUrl });
      setNotice("New audio ready — review below, then Apply or Discard.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "TTS failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleApply() {
    if (!proposal) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = cloneEntries(entries);
      while (next.length <= proposal.col) next.push({ text: "" });
      const formData = new FormData();
      formData.append("file", proposal.blob, `${factId}_${proposal.col}.mp3`);
      formData.append("deck_id", deckId);
      const clientId = `eloc-${factId}-${proposal.col}-${proposal.blob.size}-${Date.now()}`;
      const res = (await uploadMultipart(
        "/api/media",
        formData,
        token,
        clientId
      )) as UploadMediaRes;
      const mediaId = res?.data?.id != null ? String(res.data.id).trim() : "";
      if (!mediaId) throw new Error("Upload response missing media id");
      next[proposal.col] = { ...next[proposal.col], audio: mediaId };
      await patchEntries(next);
      clearProposal();
      setNotice(`Patched audio → ${mediaId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Apply failed");
    } finally {
      setBusy(false);
    }
  }

  const locked = Boolean(disabled || busy);

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {notice && (
        <p className="text-sm text-green-800 dark:text-green-200 rounded border border-green-600/40 bg-green-600/10 px-3 py-2">
          {notice}
        </p>
      )}
      <ul className="space-y-3 list-none">
        {Array.from({ length: columnCount }, (_, col) => {
          const name = fields[col] ?? "";
          const entry = entries[col] ?? {};
          const text = entry.text ?? "";
          const audio = entry.audio?.trim() ?? "";
          const proposedHere = proposal && proposal.col === col;
          const highlighted = highlightCol != null && col === highlightCol;
          return (
            <li
              key={`${name}-${col}`}
              className={cn(
                "rounded-lg border p-3 space-y-2 text-sm",
                proposedHere && "border-2 border-amber-600/50",
                highlighted && !proposedHere && "bg-accent/70"
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {col}: {name || `#${col}`}
                </span>
                {proposedHere && (
                  <span className="rounded-full bg-amber-600/20 px-2 py-0.5 text-xs">
                    pending review
                  </span>
                )}
              </div>
              <textarea
                aria-label={`Text for column ${col}`}
                className="min-h-[4.5rem] w-full rounded-md border border-input bg-background px-2 py-1.5 font-mono text-xs whitespace-pre-wrap break-words"
                value={text}
                disabled={locked}
                placeholder="(empty)"
                onChange={(e) => setEntryText(col, e.target.value)}
              />
              <div className="flex flex-wrap items-center gap-2">
                {audio ? (
                  <>
                    <AudioPreviewButton mediaId={audio} token={token} />
                    <span className="font-mono text-xs text-muted-foreground">{audio}</span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">No audio</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {isTextDirty(col) && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={locked}
                    onClick={() => void handleSaveText(col)}
                  >
                    Save text
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={locked || !text.trim() || !canRegenAudio}
                  onClick={() => void handleRegenAudio(col)}
                >
                  Regenerate audio
                </Button>
              </div>
              {proposedHere && proposal && (
                <div
                  ref={proposalReviewRef}
                  className="rounded-md border border-amber-600/40 bg-amber-500/10 p-3 space-y-3"
                >
                  <p className="text-xs text-muted-foreground">
                    Review proposed audio — Apply to save, or Discard to keep the current value.
                  </p>
                  <audio
                    key={proposal.objectUrl}
                    src={proposal.objectUrl}
                    controls
                    className="w-full"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={locked}
                      onClick={() => void handleApply()}
                    >
                      Apply
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={locked}
                      onClick={clearProposal}
                    >
                      Discard
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
