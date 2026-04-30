import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { searchPlaces, type PhotonHit } from "@/geocode/photon";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: PhotonHit | null;
  onChange: (hit: PhotonHit | null) => void;
  placeholder?: string;
  required?: boolean;
}

export function PlaceField({ label, value, onChange, placeholder, required }: Props) {
  const id = useId();
  const [query, setQuery] = useState(value?.label ?? "");
  const [hits, setHits] = useState<PhotonHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const ctrlRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value?.label ?? "");
  }, [value]);

  useEffect(() => {
    if (!open || query.length < 2 || query === value?.label) return;
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchPlaces(query, 6, ctrl.signal);
        setHits(results);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, open, value?.label]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={containerRef} className="relative space-y-1">
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
        {required && <span className="text-brand-coral"> *</span>}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <Input
          id={id}
          className="pl-9"
          value={query}
          placeholder={placeholder ?? "Search for a city or address"}
          autoComplete="off"
          onChange={e => {
            setQuery(e.target.value);
            setOpen(true);
            if (e.target.value.length === 0) onChange(null);
          }}
          onFocus={() => setOpen(true)}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-faint" />
        )}
      </div>
      {open && hits.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-card"
        >
          {hits.map((hit, i) => (
            <li key={`${hit.label}-${i}`} role="option" aria-selected={value?.label === hit.label}>
              <button
                type="button"
                className={cn(
                  "block w-full px-3 py-2 text-left text-sm hover:bg-slate-50",
                  value?.label === hit.label && "bg-brand-mint/40",
                )}
                onClick={() => {
                  onChange(hit);
                  setQuery(hit.label);
                  setOpen(false);
                }}
              >
                <p className="font-semibold text-ink">{hit.label}</p>
                {hit.country && <p className="text-xs text-ink-faint">{hit.country}</p>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
