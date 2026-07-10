import * as React from "react";
import { cn } from "./utils";

const Input = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500",
        className
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
