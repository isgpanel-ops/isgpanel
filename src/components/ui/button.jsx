import * as React from "react";
import { cn } from "./utils";

const Button = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={cn(
        "px-4 py-2 rounded-md bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
});
Button.displayName = "Button";

export { Button };
