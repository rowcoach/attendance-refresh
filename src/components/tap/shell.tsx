import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export function ScreenHeader({
  title,
  subtitle,
  right,
  color,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  color?: string | null;
}) {
  return (
    <header
      className="border-b-4 border-foreground bg-card px-4 py-4"
      style={color ? { borderBottomColor: color } : undefined}
    >
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display truncate text-3xl uppercase leading-none tracking-tight">
            {title}
          </h1>
          {subtitle ? (
            <p className="label-caps mt-1 truncate text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {right}
      </div>
    </header>
  );
}

export function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="mx-auto w-full max-w-3xl px-4">{children}</div>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    present: "bg-present/15 text-present border-present/40",
    excused: "bg-excused/15 text-excused border-excused/40",
    unexcused: "bg-unexcused/15 text-unexcused border-unexcused/40",
    pending: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span
      className={`label-caps inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] ${
        map[status] ?? map["pending"]
      }`}
    >
      {status}
    </span>
  );
}

export function CoachLink() {
  return (
    <Link to="/auth" className="label-caps text-xs text-muted-foreground underline">
      Coach sign in
    </Link>
  );
}