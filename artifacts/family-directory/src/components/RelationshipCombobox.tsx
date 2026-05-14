import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FamilyMember } from "@/types/family";
import { ChevronDown, Check, X } from "lucide-react";

interface RelationshipComboboxProps {
  value: string;
  onChange: (val: string) => void;
  members: FamilyMember[];
  placeholder: string;
  excludeId?: string;
  excludeGender?: "Male" | "Female";
}

export function RelationshipCombobox({
  value,
  onChange,
  members,
  placeholder,
  excludeId,
  excludeGender,
}: RelationshipComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = members.filter((m) => {
    if (!m.id?.trim()) return false;
    if (m.id === excludeId) return false;
    if (excludeGender && m.gender === excludeGender) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.fullName?.toLowerCase().includes(q) ||
      m.city?.toLowerCase().includes(q) ||
      m.mainFamilyBranch?.toLowerCase().includes(q) ||
      m.subFamilyBranch?.toLowerCase().includes(q)
    );
  });

  const selected = value ? members.find((m) => m.id === value) : null;

  function handleSelect(id: string) {
    onChange(id);
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
          className="w-full justify-between font-normal h-10 px-3"
        >
          <span className="truncate">
            {selected ? (
              selected.fullName || selected.id
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(90vw,360px)] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="p-2 border-b border-border">
          <Input
            placeholder="Search by name, city or branch…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
            autoFocus
          />
        </div>

        <div className="max-h-64 overflow-y-auto overscroll-contain">
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors flex items-center gap-2"
            onClick={() => handleSelect("")}
          >
            <X className="w-3.5 h-3.5 shrink-0" />
            <span>None</span>
          </button>

          {filtered.map((m) => (
            <button
              type="button"
              key={m.id}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2"
              onClick={() => handleSelect(m.id)}
            >
              {value === m.id ? (
                <Check className="w-3.5 h-3.5 text-primary shrink-0" />
              ) : (
                <span className="w-3.5 h-3.5 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{m.fullName || m.id}</div>
                {(m.city || m.mainFamilyBranch) && (
                  <div className="text-xs text-muted-foreground truncate">
                    {[m.city, m.mainFamilyBranch].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
            </button>
          ))}

          {filtered.length === 0 && (
            <p className="px-3 py-6 text-sm text-muted-foreground text-center">
              No matches for "{search}"
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
