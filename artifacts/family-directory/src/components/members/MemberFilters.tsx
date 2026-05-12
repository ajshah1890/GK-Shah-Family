import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X, Filter } from "lucide-react";
import { FamilyMember } from "@/types/family";
import { useMemo, useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface MemberFiltersProps {
  members: FamilyMember[];
  onFilterChange: (filteredMembers: FamilyMember[]) => void;
}

export function MemberFilters({ members, onFilterChange }: MemberFiltersProps) {
  const [search, setSearch] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [cityFilter, setCityFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [professionFilter, setProfessionFilter] = useState("all");
  const [mainBranchFilter, setMainBranchFilter] = useState("all");
  const [subBranchFilter, setSubBranchFilter] = useState("all");
  const [bloodGroupFilter, setBloodGroupFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");

  const cities = useMemo(() => Array.from(new Set(members.map(m => m.city).filter(Boolean) as string[])).sort(), [members]);
  const countries = useMemo(() => Array.from(new Set(members.map(m => m.country).filter(Boolean) as string[])).sort(), [members]);
  const professions = useMemo(() => Array.from(new Set(members.map(m => m.profession).filter(Boolean) as string[])).sort(), [members]);
  const mainBranches = useMemo(() => Array.from(new Set(members.map(m => m.mainFamilyBranch).filter(Boolean) as string[])).sort(), [members]);
  const subBranches = useMemo(() => Array.from(new Set(members.map(m => m.subFamilyBranch).filter(Boolean) as string[])).sort(), [members]);
  const bloodGroups = useMemo(() => Array.from(new Set(members.map(m => m.bloodGroup).filter(Boolean) as string[])).sort(), [members]);
  const companies = useMemo(() => Array.from(new Set(members.map(m => m.company).filter(Boolean) as string[])).sort(), [members]);

  const searchSuggestions = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return members.filter(m => m.fullName.toLowerCase().includes(q)).slice(0, 6);
  }, [members, search]);

  // Use useEffect (not useMemo) to call onFilterChange — avoids setState-during-render
  useEffect(() => {
    let result = members;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(m =>
        m.fullName.toLowerCase().includes(q) ||
        (m.city && m.city.toLowerCase().includes(q)) ||
        (m.profession && m.profession.toLowerCase().includes(q)) ||
        (m.company && m.company.toLowerCase().includes(q)) ||
        (m.mainFamilyBranch && m.mainFamilyBranch.toLowerCase().includes(q)) ||
        (m.subFamilyBranch && m.subFamilyBranch.toLowerCase().includes(q))
      );
    }

    if (cityFilter !== "all") result = result.filter(m => m.city === cityFilter);
    if (countryFilter !== "all") result = result.filter(m => m.country === countryFilter);
    if (professionFilter !== "all") result = result.filter(m => m.profession === professionFilter);
    if (mainBranchFilter !== "all") result = result.filter(m => m.mainFamilyBranch === mainBranchFilter);
    if (subBranchFilter !== "all") result = result.filter(m => m.subFamilyBranch === subBranchFilter);
    if (bloodGroupFilter !== "all") result = result.filter(m => m.bloodGroup === bloodGroupFilter);
    if (companyFilter !== "all") result = result.filter(m => m.company === companyFilter);

    onFilterChange(result);
  }, [members, search, cityFilter, countryFilter, professionFilter, mainBranchFilter, subBranchFilter, bloodGroupFilter, companyFilter, onFilterChange]);

  const activeFiltersCount =
    (cityFilter !== "all" ? 1 : 0) +
    (countryFilter !== "all" ? 1 : 0) +
    (professionFilter !== "all" ? 1 : 0) +
    (mainBranchFilter !== "all" ? 1 : 0) +
    (subBranchFilter !== "all" ? 1 : 0) +
    (bloodGroupFilter !== "all" ? 1 : 0) +
    (companyFilter !== "all" ? 1 : 0);

  const clearFilters = () => {
    setCityFilter("all");
    setCountryFilter("all");
    setProfessionFilter("all");
    setMainBranchFilter("all");
    setSubBranchFilter("all");
    setBloodGroupFilter("all");
    setCompanyFilter("all");
    setSearch("");
  };

  return (
    <div className="space-y-4 mb-6 relative" data-testid="member-filters">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            data-testid="input-search"
            placeholder="Search by name, city, profession, branch..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 150)}
            className="pl-9 h-11 bg-card"
          />
          {isSearchFocused && search.trim() && searchSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-md z-50 overflow-hidden">
              {searchSuggestions.map(s => (
                <div
                  key={s.id}
                  data-testid={`suggestion-${s.id}`}
                  className="px-4 py-2 hover:bg-muted cursor-pointer text-sm"
                  onClick={() => setSearch(s.fullName)}
                >
                  <span className="font-medium">{s.fullName}</span>
                  {s.city && <span className="text-muted-foreground ml-2 text-xs">({s.city})</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="h-11 px-4 flex gap-2 border-border bg-card"
              data-testid="button-filters"
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 min-w-[20px] justify-center">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4 max-h-[80vh] overflow-y-auto" align="end">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium font-serif">Filter Members</h4>
                {activeFiltersCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2 text-xs" data-testid="button-clear-filters">
                    Clear all
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Main Branch</label>
                <Select value={mainBranchFilter} onValueChange={setMainBranchFilter}>
                  <SelectTrigger data-testid="select-main-branch"><SelectValue placeholder="All Branches" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {mainBranches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Sub Branch</label>
                <Select value={subBranchFilter} onValueChange={setSubBranchFilter}>
                  <SelectTrigger data-testid="select-sub-branch"><SelectValue placeholder="All Sub Branches" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sub Branches</SelectItem>
                    {subBranches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">City</label>
                  <Select value={cityFilter} onValueChange={setCityFilter}>
                    <SelectTrigger data-testid="select-city"><SelectValue placeholder="All Cities" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cities</SelectItem>
                      {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Country</label>
                  <Select value={countryFilter} onValueChange={setCountryFilter}>
                    <SelectTrigger data-testid="select-country"><SelectValue placeholder="All Countries" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Countries</SelectItem>
                      {countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Blood Group</label>
                  <Select value={bloodGroupFilter} onValueChange={setBloodGroupFilter}>
                    <SelectTrigger data-testid="select-blood-group"><SelectValue placeholder="All Groups" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Groups</SelectItem>
                      {bloodGroups.map(bg => <SelectItem key={bg} value={bg}>{bg}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Company</label>
                  <Select value={companyFilter} onValueChange={setCompanyFilter}>
                    <SelectTrigger data-testid="select-company"><SelectValue placeholder="All Companies" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Companies</SelectItem>
                      {companies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Profession</label>
                <Select value={professionFilter} onValueChange={setProfessionFilter}>
                  <SelectTrigger data-testid="select-profession"><SelectValue placeholder="All Professions" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Professions</SelectItem>
                    {professions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-muted-foreground mr-1">Active filters:</span>
          {mainBranchFilter !== "all" && (
            <Badge variant="secondary" className="flex items-center gap-1 font-normal bg-primary/10 text-primary border-primary/20">
              Main Branch: {mainBranchFilter}
              <X className="w-3 h-3 cursor-pointer" onClick={() => setMainBranchFilter("all")} />
            </Badge>
          )}
          {subBranchFilter !== "all" && (
            <Badge variant="secondary" className="flex items-center gap-1 font-normal bg-primary/10 text-primary border-primary/20">
              Sub Branch: {subBranchFilter}
              <X className="w-3 h-3 cursor-pointer" onClick={() => setSubBranchFilter("all")} />
            </Badge>
          )}
          {cityFilter !== "all" && (
            <Badge variant="secondary" className="flex items-center gap-1 font-normal bg-primary/10 text-primary border-primary/20">
              City: {cityFilter}
              <X className="w-3 h-3 cursor-pointer" onClick={() => setCityFilter("all")} />
            </Badge>
          )}
          {countryFilter !== "all" && (
            <Badge variant="secondary" className="flex items-center gap-1 font-normal bg-primary/10 text-primary border-primary/20">
              Country: {countryFilter}
              <X className="w-3 h-3 cursor-pointer" onClick={() => setCountryFilter("all")} />
            </Badge>
          )}
          {bloodGroupFilter !== "all" && (
            <Badge variant="secondary" className="flex items-center gap-1 font-normal bg-primary/10 text-primary border-primary/20">
              Blood Group: {bloodGroupFilter}
              <X className="w-3 h-3 cursor-pointer" onClick={() => setBloodGroupFilter("all")} />
            </Badge>
          )}
          {companyFilter !== "all" && (
            <Badge variant="secondary" className="flex items-center gap-1 font-normal bg-primary/10 text-primary border-primary/20">
              Company: {companyFilter}
              <X className="w-3 h-3 cursor-pointer" onClick={() => setCompanyFilter("all")} />
            </Badge>
          )}
          {professionFilter !== "all" && (
            <Badge variant="secondary" className="flex items-center gap-1 font-normal bg-primary/10 text-primary border-primary/20">
              Profession: {professionFilter}
              <X className="w-3 h-3 cursor-pointer" onClick={() => setProfessionFilter("all")} />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
