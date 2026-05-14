import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FamilyMember } from "@/types/family";
import { MessageCircle, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  WishStyle,
  generateWishMessage,
  buildWaUrl,
  cleanPhone,
  resolvePhone,
} from "@/lib/whatsappWish";

const STYLE_LABELS: Record<WishStyle, string> = {
  formal: "Formal",
  warm: "Warm Family",
  fun: "Fun / Casual",
};

interface WhatsAppWishButtonProps {
  member: FamilyMember;
  type: "birthday" | "anniversary";
  /** sm = icon-only trigger; default = labeled trigger */
  size?: "sm" | "default";
}

export function WhatsAppWishButton({
  member,
  type,
  size = "default",
}: WhatsAppWishButtonProps) {
  const [style, setStyle] = useState<WishStyle>("warm");
  const [open, setOpen] = useState(false);

  const rawPhone = resolvePhone(member);
  const hasPhone = Boolean(rawPhone);
  const cleaned  = rawPhone ? cleanPhone(rawPhone) : "";

  const message = generateWishMessage(member, type, style);
  const waUrl   = hasPhone ? buildWaUrl(cleaned, message) : "";

  const typeLabel = type === "birthday" ? "Birthday" : "Anniversary";

  // ── Disabled state ─────────────────────────────────────────────────────
  if (!hasPhone) {
    return (
      <Button
        type="button"
        size={size === "sm" ? "sm" : "default"}
        variant="outline"
        disabled
        title="No WhatsApp number available"
        className="gap-1.5 shrink-0"
      >
        <MessageCircle className="w-4 h-4 shrink-0" />
        {size !== "sm" && <span>Wish</span>}
      </Button>
    );
  }

  // ── Enabled state ───────────────────────────────────────────────────────
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size={size === "sm" ? "sm" : "default"}
          variant="outline"
          title={`Send ${typeLabel} Wish on WhatsApp`}
          className="gap-1.5 shrink-0 border-green-600/40 text-green-700 hover:bg-green-50 hover:border-green-600 hover:text-green-800 dark:text-green-400 dark:hover:bg-green-950/40 dark:border-green-700/40"
        >
          <MessageCircle className="w-4 h-4 shrink-0" />
          {size !== "sm" && <span>Wish</span>}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[min(90vw,320px)] p-4 space-y-3"
        align="end"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div>
          <p className="text-sm font-semibold leading-tight">
            {typeLabel} Wish 🎉
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Choose a message style, then open WhatsApp — the message is pre-filled.
            You tap Send.
          </p>
        </div>

        {/* Style selector */}
        <div className="flex gap-1.5">
          {(["formal", "warm", "fun"] as WishStyle[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStyle(s)}
              className={`flex-1 text-[11px] py-1.5 px-1 rounded-md border transition-colors font-medium ${
                style === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-accent text-foreground"
              }`}
            >
              {STYLE_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Message preview */}
        <div className="bg-muted rounded-lg p-3 max-h-36 overflow-y-auto">
          <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
            {message}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-0.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5 text-xs h-9"
            onClick={async () => {
              await navigator.clipboard.writeText(message);
              toast.success("Message copied!");
            }}
          >
            <Copy className="w-3.5 h-3.5" />
            Copy
          </Button>
          <Button
            type="button"
            size="sm"
            className="flex-1 gap-1.5 text-xs h-9 bg-green-600 hover:bg-green-700 text-white"
            onClick={() => {
              window.open(waUrl, "_blank", "noopener,noreferrer");
              setOpen(false);
            }}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open WhatsApp
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
