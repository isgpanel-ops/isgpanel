import * as React from "react";
import { cn } from "./utils"; // utils.js aynı klasörde

export function Card({ className, ...props }) {
  return (
    <div
      className={cn("rounded-lg border bg-white shadow-sm", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }) {
  return (
    <div
      className={cn("p-4 border-b flex items-center gap-2", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }) {
  return (
    <h3
      className={cn("text-base font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }) {
  return <div className={cn("p-4", className)} {...props} />;
}
