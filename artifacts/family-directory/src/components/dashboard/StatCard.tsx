import { Card, CardContent } from "@/components/ui/card";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  description?: string;
  className?: string;
}

export function StatCard({ title, value, icon, description, className }: StatCardProps) {
  return (
    <Card className={cn("overflow-hidden min-w-0", className)}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between gap-2 pb-2">
          <h3 className="tracking-tight text-xs sm:text-sm font-medium text-muted-foreground truncate">
            {title}
          </h3>
          <div className="text-primary p-1.5 sm:p-2 bg-primary/10 rounded-full shrink-0">
            {icon}
          </div>
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="text-2xl sm:text-3xl font-bold font-serif truncate">{value}</div>
          {description && (
            <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-2 leading-snug">{description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
