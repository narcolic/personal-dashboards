import { BrandMark } from "@/components/brand/BrandMark";

type BrandLockupProps = {
  className?: string;
  compact?: boolean;
  tagline?: string;
};

export function BrandLockup({ className, compact = false, tagline }: BrandLockupProps) {
  return (
    <div className={`inline-flex items-center ${compact ? "gap-2" : "gap-3"} ${className ?? ""}`}>
      <BrandMark
        decorative
        className={`${compact ? "h-[22px] w-[22px]" : "h-9 w-9"} shrink-0 text-foreground`}
      />
      <div className="min-w-0">
        <div
          className={`${compact ? "text-[11px] tracking-[0.18em]" : "text-sm tracking-[0.22em]"} font-bold text-foreground`}
        >
          TERMINAL HUB
        </div>
        {tagline ? (
          <div className="mt-1 text-[10px] tracking-[0.08em] text-muted-foreground">{tagline}</div>
        ) : null}
      </div>
    </div>
  );
}
