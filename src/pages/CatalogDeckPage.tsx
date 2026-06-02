import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { CatalogDeckDetail } from "@/components/catalog/CatalogDeckDetail";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { request, type CatalogDeckItem, type ProfileRes } from "@/lib/api";
import { fetchCatalogDeckById } from "@/lib/catalog";
import { homeStrings } from "@/locales/home";

export default function CatalogDeckPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { token } = useAuth();
  const { lang } = useLocale();
  const t = homeStrings[lang];

  const [deck, setDeck] = useState<CatalogDeckItem | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setUsername(null);
      return;
    }
    let cancelled = false;
    void request<ProfileRes>("/api/profile", { token })
      .then((res) => {
        if (!cancelled) setUsername(res.data.username);
      })
      .catch(() => {
        if (!cancelled) setUsername(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!id) {
      setDeck(null);
      setError("Deck not found");
      setLoading(false);
      return;
    }

    const routed = (location.state as { deck?: CatalogDeckItem } | null)?.deck;
    if (routed?.id === id) {
      setDeck(routed);
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    void fetchCatalogDeckById(id, token)
      .then((found) => {
        if (cancelled) return;
        if (found) {
          setDeck(found);
          setError("");
        } else {
          setDeck(null);
          setError("This deck is not in the public catalog.");
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setDeck(null);
        setError(err instanceof Error ? err.message : "Could not load deck");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, token, location.state]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border/80 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link
            to="/"
            className="text-xl font-semibold tracking-tight text-foreground hover:text-primary transition-colors"
          >
            Retentio
          </Link>
          <nav className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link
              to="/manual"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {t.help}
            </Link>
            {token ? (
              <Button asChild variant="default">
                <Link to="/profile">{t.dashboard}</Link>
              </Button>
            ) : (
              <Button asChild variant="ghost">
                <Link to="/login">{t.logIn}</Link>
              </Button>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 px-4 py-10 md:py-14">
        <div className="mx-auto max-w-2xl">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading deck…</p>
          ) : error || !deck ? (
            <div className="space-y-4">
              <p className="text-sm text-destructive" role="alert">
                {error || "Deck not found"}
              </p>
              <Button type="button" variant="outline" asChild>
                <Link to="/">Back to catalog</Link>
              </Button>
            </div>
          ) : (
            <CatalogDeckDetail deck={deck} token={token} currentUsername={username} />
          )}
        </div>
      </main>
    </div>
  );
}
