import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { homeStrings } from "@/locales/home";
import { researchStrings } from "@/locales/research";

export default function ManualPage() {
  const { token } = useAuth();
  const { lang } = useLocale();
  const t = homeStrings[lang];
  const r = researchStrings[lang];

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
              to="/decks"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              deck
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
        <article className="mx-auto max-w-3xl space-y-6">
          <p>
            <Link
              to="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← {r.backToHome}
            </Link>
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl border-b border-border pb-3">
            {t.manualTitle}
          </h1>
          <p className="leading-relaxed text-muted-foreground">{t.manualIntro}</p>
        </article>
      </main>
    </div>
  );
}
