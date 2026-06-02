import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { importDeck, type CatalogDeckItem } from "@/lib/api";
import { formatCatalogPublishedAt } from "@/lib/catalog";

interface CatalogDeckDetailProps {
  deck: CatalogDeckItem;
  token?: string | null;
  currentUsername?: string | null;
  onImported?: () => void | Promise<void>;
}

function isOwnCatalogDeck(deck: CatalogDeckItem, username: string | null | undefined): boolean {
  if (!username?.trim()) return false;
  return deck.owner.localeCompare(username.trim(), undefined, { sensitivity: "accent" }) === 0;
}

export function CatalogDeckDetail({ deck, token, currentUsername, onImported }: CatalogDeckDetailProps) {
  const navigate = useNavigate();
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const description = deck.description?.trim() ?? "";
  const ownDeck = isOwnCatalogDeck(deck, currentUsername);

  async function handleImport() {
    if (ownDeck) return;
    if (!token) {
      navigate("/login", { state: { from: { pathname: `/catalog/${deck.id}` } } });
      return;
    }
    setImportError("");
    setImporting(true);
    try {
      const res = await importDeck({ source_deck_id: deck.id }, token);
      await onImported?.();
      navigate(`/decks/${res.data.id}`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">{deck.name}</h1>
        {description ? (
          <p className="text-base leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {description}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          by {deck.owner} · {deck.fact_count} facts · version {deck.published_version} · published{" "}
          {formatCatalogPublishedAt(deck.published_at)}
        </p>
      </div>

      {deck.fields.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-foreground">Fields</h2>
          <p className="text-sm text-muted-foreground">{deck.fields.join(" · ")}</p>
        </section>
      ) : null}

      {deck.deck_tag_names && deck.deck_tag_names.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-foreground">Tags</h2>
          <div className="flex flex-wrap gap-1.5">
            {deck.deck_tag_names.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {importError ? (
        <p className="text-sm text-destructive" role="alert">
          {importError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        {ownDeck ? (
          <>
            <p className="text-sm text-muted-foreground">
              This is your published deck. Study or edit it from your deck list.
            </p>
            <Button type="button" variant="default" asChild>
              <Link to={`/decks/${deck.id}`}>Open in my decks</Link>
            </Button>
          </>
        ) : token ? (
          <Button type="button" disabled={importing} onClick={() => void handleImport()}>
            {importing ? "Importing…" : "Import into my library"}
          </Button>
        ) : (
          <Button type="button" asChild>
            <Link to="/login" state={{ from: { pathname: `/catalog/${deck.id}` } }}>
              Log in to import
            </Link>
          </Button>
        )}
        <Button type="button" variant="outline" asChild>
          <Link to="/">Back to catalog</Link>
        </Button>
      </div>
    </div>
  );
}
