import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { homeStrings } from "@/locales/home";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  researchStrings,
  RESEARCH_REPORT_URL,
} from "@/locales/research";

export default function ResearchPage() {
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
        <article className="mx-auto max-w-3xl space-y-8">
          <p>
            <Link
              to="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← {r.backToHome}
            </Link>
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl border-b border-border pb-3">
            {r.title}
          </h1>

          <p className="leading-relaxed text-muted-foreground">{r.summaryP1}</p>
          <p className="leading-relaxed text-muted-foreground">{r.summaryP2}</p>
          <p className="leading-relaxed text-muted-foreground">{r.summaryP3}</p>

          <h2 className="text-xl font-semibold tracking-tight text-foreground pt-4 border-b border-border pb-2">
            {r.sectionSpacing}
          </h2>
          <p className="leading-relaxed text-muted-foreground">{r.summaryP4}</p>
          <p className="leading-relaxed text-muted-foreground">{r.summaryP5}</p>

          <h2 className="text-xl font-semibold tracking-tight text-foreground pt-4 border-b border-border pb-2">
            {r.sectionForgetting}
          </h2>
          <p className="leading-relaxed text-muted-foreground">{r.summaryP6}</p>
          <p className="leading-relaxed text-muted-foreground">{r.summaryP7}</p>

          <h2 className="text-xl font-semibold tracking-tight text-foreground pt-4 border-b border-border pb-2">
            {r.sectionAlgorithms}
          </h2>
          <p className="leading-relaxed text-muted-foreground">{r.summaryP8}</p>
          <p className="leading-relaxed text-muted-foreground">{r.summaryP9}</p>

          <h2 className="text-xl font-semibold tracking-tight text-foreground pt-4 border-b border-border pb-2">
            {r.sectionPractice}
          </h2>
          <p className="leading-relaxed text-muted-foreground">{r.summaryP10}</p>
          <p className="leading-relaxed text-muted-foreground">{r.summaryP11}</p>

          <p className="pt-6 border-t border-border">
            <a
              href={RESEARCH_REPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-4 hover:no-underline"
            >
              {r.readFullReport} →
            </a>
            <span className="text-muted-foreground text-sm ml-1">
              (Yudame Research — Algorithms for Life, Ep. 1)
            </span>
          </p>
        </article>
      </main>
    </div>
  );
}
