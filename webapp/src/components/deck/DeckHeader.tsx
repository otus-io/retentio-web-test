import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface DeckHeaderProps {
  onLogout: () => void;
}

export function DeckHeader({ onLogout }: DeckHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-2xl font-semibold">Deck</h1>
      <nav className="flex items-center gap-2">
        <Link
          to="/profile"
          className="inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          Profile
        </Link>
        <Link
          to="/media"
          className="inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          Media
        </Link>
        <Button variant="outline" onClick={onLogout}>
          Logout
        </Button>
      </nav>
    </div>
  );
}
