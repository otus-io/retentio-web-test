import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { homeStrings } from "@/locales/home";

export default function HomePage() {
  const { token } = useAuth();
  const { lang } = useLocale();
  const t = homeStrings[lang];

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

      <main className="flex-1 px-4 py-10 md:py-16">
        <div className="mx-auto max-w-6xl space-y-20">
          <section className="rounded-2xl bg-muted/50 px-6 py-12 md:px-12 md:py-16 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-[2.5rem]">
              {t.heroTagline}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              {t.heroSubtitle}
            </p>
          </section>

          <div className="grid gap-8 md:grid-cols-2 md:gap-10 lg:gap-12">
            <section className="space-y-5">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground border-b border-border pb-2">
                {t.whatIsRetentioTitle}
              </h2>
              <p className="leading-relaxed text-muted-foreground">
                {t.whatIsRetentioDesc}
              </p>
            </section>

            <section className="space-y-5">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground border-b border-border pb-2">
                {t.whySrsTitle}
              </h2>
              <p className="leading-relaxed text-muted-foreground">{t.whySrsP1}</p>
              <p className="leading-relaxed text-muted-foreground">{t.whySrsP2}</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed">
                <li>{t.whySrsBullet1}</li>
                <li>{t.whySrsBullet2}</li>
                <li>{t.whySrsBullet3}</li>
              </ul>
              <p className="pt-2">
                <Link
                  to="/research"
                  className="inline-flex items-center gap-1 text-primary font-medium underline underline-offset-4 hover:no-underline"
                >
                  {t.whySrsLearnMore}
                  <span aria-hidden>→</span>
                </Link>
              </p>
            </section>
          </div>

          <section className="space-y-6">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground border-b border-border pb-2">
              {t.whatTitle}
            </h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="transition-shadow hover:shadow-md border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">{t.whatVerified}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">{t.whatVerifiedDesc}</p>
                </CardContent>
              </Card>
              <Card className="transition-shadow hover:shadow-md border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">{t.whatAlgorithm}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">{t.whatAlgorithmDesc}</p>
                </CardContent>
              </Card>
              <Card className="transition-shadow hover:shadow-md border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">{t.whatUi}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">{t.whatUiDesc}</p>
                </CardContent>
              </Card>
              <Card className="transition-shadow hover:shadow-md border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">{t.whatPremadeDecks}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">{t.whatPremadeDecksDesc}</p>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="space-y-5">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground border-b border-border pb-2">
              {t.featuresTitle}
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2 list-disc list-inside text-muted-foreground leading-relaxed">
              <li>{t.featureTagging}</li>
              <li>{t.featureHoliday}</li>
            </ul>
          </section>
        </div>
      </main>

      <footer className="border-t border-border bg-muted/30 py-6 text-center text-sm text-muted-foreground">
        <p>{t.footerTagline}</p>
      </footer>
    </div>
  );
}
