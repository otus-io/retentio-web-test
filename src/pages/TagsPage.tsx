import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import {
  createTag,
  deleteTag,
  getTagFacts,
  listTags,
  updateTag,
  type TagFactRef,
  type TagItem,
} from "@/lib/tags";
import { filterTagsByQuery } from "@/lib/tagSearch";

function formatUsedOn(usedOn: string[] | undefined): string {
  if (!usedOn || usedOn.length === 0) return "unused";
  return usedOn.join(", ");
}

export default function TagsPage() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [query, setQuery] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TagItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<TagItem | null>(null);
  const [factsTag, setFactsTag] = useState<TagItem | null>(null);
  const [facts, setFacts] = useState<TagFactRef[]>([]);
  const [factsLoading, setFactsLoading] = useState(false);
  const [factsError, setFactsError] = useState("");

  const fetchTags = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const res = await listTags(token);
      const sorted = [...(res.data.tags ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      );
      setTags(sorted);
    } catch (e) {
      setTags([]);
      setError(e instanceof Error ? e.message : "Failed to load tags");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchTags();
  }, [fetchTags]);

  const filtered = useMemo(() => filterTagsByQuery(tags, query), [tags, query]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  function openCreate() {
    setEditing(null);
    setFormName("");
    setFormDescription("");
    setFormError("");
    setFormOpen(true);
    setSuccess("");
  }

  function openEdit(tag: TagItem) {
    setEditing(tag);
    setFormName(tag.name);
    setFormDescription(tag.description ?? "");
    setFormError("");
    setFormOpen(true);
    setSuccess("");
  }

  async function handleSaveForm(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    const name = formName.trim();
    if (!name) {
      setFormError("Name is required");
      return;
    }
    setFormSaving(true);
    setFormError("");
    try {
      if (editing) {
        await updateTag(
          editing.id,
          { name, description: formDescription },
          token
        );
        setSuccess(`Updated “${name}”.`);
      } else {
        await createTag({ name, description: formDescription || undefined }, token);
        setSuccess(`Created “${name}”.`);
      }
      setFormOpen(false);
      await fetchTags();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setFormSaving(false);
    }
  }

  async function handleDelete(tag: TagItem) {
    if (!token) return;
    setError("");
    setSuccess("");
    try {
      const res = await deleteTag(tag.id, token);
      setDeleteTarget(null);
      if (factsTag?.id === tag.id) {
        setFactsTag(null);
        setFacts([]);
      }
      setSuccess(
        `Deleted “${tag.name}” (untagged ${res.data.decks_untagged} deck${
          res.data.decks_untagged === 1 ? "" : "s"
        }).`
      );
      await fetchTags();
    } catch (e) {
      setDeleteTarget(null);
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function openFacts(tag: TagItem) {
    if (!token) return;
    setFactsTag(tag);
    setFacts([]);
    setFactsError("");
    setFactsLoading(true);
    try {
      const res = await getTagFacts(tag.id, token);
      setFacts(res.data.facts ?? []);
    } catch (e) {
      setFactsError(e instanceof Error ? e.message : "Failed to load facts");
    } finally {
      setFactsLoading(false);
    }
  }

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Tags</h1>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link to="/decks">Deck</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/tags">Tags</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/media">Media</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/profile">Profile</Link>
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              Logout
            </Button>
          </nav>
        </div>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <CardTitle>Your tags ({tags.length})</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tags…"
                className="w-44 sm:w-56"
                aria-label="Search tags"
              />
              <Button type="button" size="sm" onClick={openCreate}>
                Create tag
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}

            {formOpen && (
              <form onSubmit={handleSaveForm} className="rounded-lg border p-4 space-y-4">
                <h3 className="text-sm font-medium">{editing ? "Edit tag" : "Create tag"}</h3>
                {formError && <p className="text-sm text-destructive">{formError}</p>}
                <div className="space-y-2">
                  <Label htmlFor="tag-name">Name</Label>
                  <Input
                    id="tag-name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                    maxLength={50}
                    placeholder="e.g. GRE"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tag-description">Description</Label>
                  <textarea
                    id="tag-description"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={2}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder="Optional"
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={formSaving}>
                    {formSaving ? "Saving…" : editing ? "Save" : "Create"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={formSaving}
                    onClick={() => setFormOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            {loading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground">
                {tags.length === 0
                  ? "No tags yet. Create one, or add tags when creating decks/facts."
                  : "No tags match your search."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Name</th>
                      <th className="text-left py-2 font-medium">Description</th>
                      <th className="text-left py-2 font-medium">Decks</th>
                      <th className="text-left py-2 font-medium">Facts</th>
                      <th className="text-left py-2 font-medium">Used on</th>
                      <th className="text-right py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((tag) => (
                      <tr key={tag.id} className="border-b last:border-0">
                        <td className="py-2 font-medium">{tag.name}</td>
                        <td className="py-2 text-muted-foreground max-w-[12rem] truncate">
                          {tag.description || "—"}
                        </td>
                        <td className="py-2 text-muted-foreground">{tag.deck_count ?? "—"}</td>
                        <td className="py-2 text-muted-foreground">{tag.fact_count ?? "—"}</td>
                        <td className="py-2 text-muted-foreground">{formatUsedOn(tag.used_on)}</td>
                        <td className="py-2 text-right">
                          <DropdownMenu>
                            <DropdownMenuItem onClick={() => openEdit(tag)}>Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void openFacts(tag)}>
                              View facts
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeleteTarget(tag)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {factsTag && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Facts with “{factsTag.name}”</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={() => setFactsTag(null)}>
                Close
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {factsError && <p className="text-sm text-destructive">{factsError}</p>}
              {factsLoading ? (
                <p className="text-muted-foreground">Loading…</p>
              ) : facts.length === 0 ? (
                <p className="text-muted-foreground">No facts have this tag.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {facts.map((f) => (
                    <li key={`${f.deck_id}:${f.fact_id}`} className="font-mono">
                      <Link
                        to={`/decks/${f.deck_id}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {f.deck_id}
                      </Link>
                      <span className="text-muted-foreground"> / {f.fact_id}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        <Dialog
          open={deleteTarget !== null}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title="Delete tag?"
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="destructive"
          onConfirm={() => deleteTarget && void handleDelete(deleteTarget)}
        >
          {deleteTarget && (
            <>
              Delete “{deleteTarget.name}”? This removes all deck and fact associations for this
              tag.
            </>
          )}
        </Dialog>
      </div>
    </div>
  );
}
