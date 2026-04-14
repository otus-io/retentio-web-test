import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DropdownMenuProps {
  trigger?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  align?: "start" | "end";
}

export function DropdownMenu({
  trigger = "⋯",
  children,
  className,
  align = "end",
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={cn("relative inline-block", className)} ref={ref}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-10 w-10 p-0 shrink-0 text-lg font-bold text-foreground"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {trigger}
      </Button>
      {open && (
        <div
          className={cn(
            "absolute top-full z-50 mt-1 min-w-[10rem] rounded-md border bg-card py-1 shadow-md",
            align === "end" ? "right-0" : "left-0"
          )}
          role="menu"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

interface DropdownMenuItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "destructive";
  disabled?: boolean;
  className?: string;
}

export function DropdownMenuItem({
  children,
  onClick,
  variant = "default",
  disabled,
  className,
}: DropdownMenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className={cn(
        "flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
        variant === "destructive" && "text-destructive hover:bg-destructive/10 hover:text-destructive",
        className
      )}
      onClick={() => {
        onClick?.();
      }}
    >
      {children}
    </button>
  );
}
