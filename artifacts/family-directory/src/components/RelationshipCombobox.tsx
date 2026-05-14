import { useState, useEffect, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FamilyMember } from "@/types/family";
import { ChevronDown, Check, X } from "lucide-react";

interface RelationshipComboboxProps {
  value: string;
  onChange: (val: string) => void;
  /** Called when the user explicitly selects "None" — distinct from onChange("") so
   *  the parent can track intentional clears vs un-hydrated empty values. */
  onClear?: () => void;
  members: FamilyMember[];
  placeholder: string;
  excludeId?: string;
  excludeGender?: "Male" | "Female";
}

export function RelationshipCombobox({
  value,
  onChange,
  onClear,
  members,
  placeholder,
  excludeId,
  excludeGender,
}: RelationshipComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const base = members.filter((m) => {
    if (!m.id?.trim()) return false;
    if (m.id === excludeId) return false;
    if (excludeGender && m.gender === excludeGender) return false;
    return true;
  });

  const filtered = search.trim()
    ? base.filter((m) => {
        const q = search.toLowerCase();
        return (
          m.fullName?.toLowerCase().includes(q) ||
          m.city?.toLowerCase().includes(q) ||
          m.mainFamilyBranch?.toLowerCase().includes(q) ||
          m.subFamilyBranch?.toLowerCase().includes(q) ||
          m.generation?.toLowerCase().includes(q)
        );
      })
    : base;

  // When not searching, float the selected member to the top so it's immediately visible
  const sorted = search.trim()
    ? filtered
    : [
        ...filtered.filter((m) => m.id === value),
        ...filtered.filter((m) => m.id !== value),
      ];

  const selected = value ? members.find((m) => m.id === value) : null;

  // Auto-scroll to the selected item every time the popover opens
  useEffect(() => {
    if (!open || !value) return;
    requestAnimationFrame(() => {
      const el = listRef.current?.querySelector<HTMLElement>('[data-selected="true"]');
      el?.scrollIntoView({ block: "nearest" });
    });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelect(id: string) {
    if (id === "") {
      onChange("");
      onClear?.();
    } else {
      onChange(id);
    }
    setOpen(false);
    setSearch("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-auto min-h-10 px-3 py-1.5 text-left"
        >
          {selected ? (
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="truncate text-sm font-medium leading-tight">
                {selected.fullName || selected.id}
              </div>
              {(selected.generation || selected.city || selected.mainFamilyBranch) && (
                <div className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                  {[selected.generation, selected.city, selected.mainFamilyBranch]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground text-sm flex-1">{placeholder}</span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[min(92vw,400px)] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Search box */}
        <div className="p-2 border-b border-border">
          <Input
            placeholder="Search by name, city or branch…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
            autoFocus
          />
        </div>

        {/* List */}
        <div ref={listRef} className="max-h-64 overflow-y-auto overscroll-contain">
          {/* Explicit "None" / clear option */}
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors flex items-center gap-2"
            onClick={() => handleSelect("")}
          >
            <X className="w-3.5 h-3.5 shrink-0" />
            <span>None</span>
          </button>

          {sorted.map((m) => {
            const isSelected = value === m.id;
            return (
              <button
                type="button"
                key={m.id}
                data-selected={isSelected ? "true" : undefined}
                className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                  isSelected ? "bg-accent/60 hover:bg-accent" : "hover:bg-accent"
                }`}
                onClick={() => handleSelect(m.id)}
              >
                {isSelected ? (
                  <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{m.fullName || m.id}</div>
                  {(m.generation || m.city || m.mainFamilyBranch) && (
                    <div className="text-[11px] text-muted-foreground truncate">
                      {[m.generation, m.city, m.mainFamilyBranch].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
              </button>
            );
          })}

          {sorted.length === 0 && (
            <p className="px-3 py-6 text-sm text-muted-foreground text-center">
              No matches for &ldquo;{search}&rdquo;
            </p>
          )}
        </div>

        {/* Footer count */}
        {sorted.length > 0 && (
          <div className="px-3 py-1 border-t border-border text-[10px] text-muted-foreground text-right">
            {sorted.length} member{sorted.length !== 1 ? "s" : ""}
            {search && ` matching "${search}"`}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
