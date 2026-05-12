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
import { useMemo, useState } from "react";
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
  const [cityFilter, setCityFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [professionFilter, setProfessionFilter] = useState("all");

  const cities = useMemo(() => {
    const unique = new Set(members.map(m => m.city).filter(Boolean) as string[]);
    return Array.from(unique).sort();
  }, [members]);

  const branches = useMemo(() => {
    const unique = new Set(members.map(m => m.familyBranch).filter(Boolean) as string[]);
    return Array.from(unique).sort();
  }, [members]);

  const countries = useMemo(() => {
    const unique = new Set(members.map(m => m.country).filter(Boolean) as string[]);
    return Array.from(unique).sort();
  }, [members]);

  const professions = useMemo(() => {
    const unique = new Set(members.map(m => m.profession).filter(Boolean) as string[]);
    return Array.from(unique).sort();
  }, [members]);

  // Apply filters whenever state changes
  useMemo(() => {
    let result = members;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(m => 
        m.fullName.toLowerCase().includes(q) ||
        (m.city && m.city.toLowerCase().includes(q)) ||
        (m.profession && m.profession.toLowerCase().includes(q)) ||
        (m.company && m.company.toLowerCase().includes(q))
      );
    }

    if (cityFilter !== "all") {
      result = result.filter(m => m.city === cityFilter);
    }

    if (branchFilter !== "all") {
      result = result.filter(m => m.familyBranch === branchFilter);
    }

    if (countryFilter !== "all") {
      result = result.filter(m => m.country === countryFilter);
    }

    if (professionFilter !== "all") {
      result = result.filter(m => m.profession === professionFilter);
    }

    onFilterChange(result);
  }, [members, search, cityFilter, branchFilter, countryFilter, professionFilter, onFilterChange]);

  const activeFiltersCount = (cityFilter !== "all" ? 1 : 0) + 
                             (branchFilter !== "all" ? 1 : 0) + 
                             (countryFilter !== "all" ? 1 : 0) +
                             (professionFilter !== "all" ? 1 : 0);

  const clearFilters = () => {
    setCityFilter("all");
    setBranchFilter("all");
    setCountryFilter("all");
    setProfessionFilter("all");
    setSearch("");
  };

  return (
    <div className="space-y-4 mb-6">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, city, profession..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11 bg-card"
          />
        </div>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-11 px-4 flex gap-2 border-border bg-card">
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
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2 text-xs">
                    Clear all
                  </Button>
                )}
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">City</label>
                <Select value={cityFilter} onValueChange={setCityFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Cities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cities</SelectItem>
                    {cities.map(city => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Country</label>
                <Select value={countryFilter} onValueChange={setCountryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Countries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Countries</SelectItem>
                    {countries.map(country => (
                      <SelectItem key={country} value={country}>{country}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Family Branch</label>
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map(branch => (
                      <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Profession</label>
                <Select value={professionFilter} onValueChange={setProfessionFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Professions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Professions</SelectItem>
                    {professions.map(prof => (
                      <SelectItem key={prof} value={prof}>{prof}</SelectItem>
                    ))}
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
          {branchFilter !== "all" && (
            <Badge variant="secondary" className="flex items-center gap-1 font-normal bg-primary/10 text-primary border-primary/20">
              Branch: {branchFilter}
              <X className="w-3 h-3 cursor-pointer" onClick={() => setBranchFilter("all")} />
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
