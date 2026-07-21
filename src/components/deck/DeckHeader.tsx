import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface DeckHeaderProps {
  onLogout: () => void;
}

export function DeckHeader({ onLogout }: DeckHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-4">
      <nav className="flex items-center gap-2">
        <Link
          to="/decks"
          className="inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          Deck
        </Link>
        <Link
          to="/tags"
          className="inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          Tags
        </Link>
        <Link
          to="/media"
          className="inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          Media
        </Link>
        <Link
          to="/profile"
          className="inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          Profile
        </Link>
        <Button variant="outline" onClick={onLogout}>
          Logout
        </Button>
      </nav>
    </div>
  );
}
