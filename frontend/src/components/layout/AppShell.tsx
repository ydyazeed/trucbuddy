import { Link, NavLink, Outlet, useParams } from "react-router-dom";
import { Map as MapIcon, ListChecks, FileText } from "lucide-react";

import { ThreeDots } from "@/components/ui/three-dots";
import { useOnline } from "@/store/network";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "map", label: "Map", icon: MapIcon },
  { to: "timeline", label: "Timeline", icon: ListChecks },
  { to: "logs", label: "Logs", icon: FileText },
] as const;

export function AppShell() {
  const params = useParams();
  const online = useOnline();
  const inTrip = !!params.id;
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link to="/trips" className="flex items-center gap-3" aria-label="TrucBuddy home">
            <ThreeDots />
            <span className="text-lg font-extrabold tracking-tight">TrucBuddy</span>
          </Link>
          {!online && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
              Offline
            </span>
          )}
        </div>
      </header>
      <main className={cn("mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-4", inTrip && "pb-32")}>
        <Outlet />
      </main>
      {inTrip && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[var(--safe-bottom)]">
          <div className="mx-auto grid max-w-3xl grid-cols-3">
            {tabs.map(tab => (
              <NavLink
                key={tab.to}
                to={`/trips/${params.id}/${tab.to}`}
                className={({ isActive }) =>
                  cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold",
                    isActive ? "text-brand-teal" : "text-ink-subtle",
                  )
                }
              >
                <tab.icon className="h-5 w-5" />
                {tab.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
