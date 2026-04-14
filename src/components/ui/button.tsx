import { forwardRef, cloneElement, isValidElement, ReactElement } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
}

const sizeClasses = {
  default: "h-10 px-4 py-2",
  sm: "h-9 px-3 text-sm",
  lg: "h-11 px-8 text-base",
  icon: "h-10 w-10 p-0",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, children, ...props }, ref) => {
    const classes = cn(
      "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      variant === "default" && "bg-primary text-primary-foreground hover:bg-primary/90",
      variant === "secondary" && "bg-muted text-muted-foreground hover:bg-muted/80",
      variant === "destructive" && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      variant === "outline" && "border border-input bg-background hover:bg-accent",
      variant === "ghost" && "hover:bg-accent hover:text-accent-foreground",
      variant === "link" && "text-primary underline-offset-4 hover:underline",
      sizeClasses[size],
      className
    );
    if (asChild && isValidElement(children)) {
      return cloneElement(children as ReactElement<{ className?: string; ref?: React.Ref<unknown> }>, {
        className: cn(classes, (children as ReactElement).props.className),
        ref,
        ...props,
      });
    }
    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
export { Button };
