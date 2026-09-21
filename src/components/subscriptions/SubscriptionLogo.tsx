import { subscriptionLogoByKey, type SubscriptionLogoOption } from "@/lib/subscription-logos";

export function SubscriptionLogo({
  logoKey,
  name,
  size = "md",
}: {
  logoKey?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const option = logoKey ? subscriptionLogoByKey.get(logoKey) : undefined;
  const color = option?.color ?? (option?.icon ? `#${option.icon.hex}` : undefined);
  const isGeneric = !option || Boolean(option.generic);
  const special = option?.special;
  const sizeClass =
    size === "sm" ? "size-8 text-xs" : size === "lg" ? "size-14 text-lg" : "size-11 text-sm";

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-lg border font-bold tracking-tight ${sizeClass} ${
        isGeneric
          ? "border-primary/20 bg-primary/10 text-primary"
          : option?.image
            ? "border-white bg-white"
            : special === "nintendo"
              ? "border-[#E60012] bg-[#E60012]"
              : special === "amazon"
                ? "border-white bg-white"
                : "border-border/70 bg-secondary/40"
      }`}
      style={isGeneric || special || option?.image ? undefined : { color }}
    >
      {option?.image ? (
        <img className="size-full rounded-lg object-contain" src={option.image} alt="" />
      ) : option?.special === "microsoft" ? (
        <svg className="size-[58%]" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="0" y="0" width="11" height="11" fill="#F25022" />
          <rect x="13" y="0" width="11" height="11" fill="#7FBA00" />
          <rect x="0" y="13" width="11" height="11" fill="#00A4EF" />
          <rect x="13" y="13" width="11" height="11" fill="#FFB900" />
        </svg>
      ) : option?.special === "nintendo" ? (
        <span className="rounded-full border-[1.5px] border-white px-1 text-[0.48em] font-black italic leading-[1.35] tracking-[-0.08em] text-white">
          Nintendo
        </span>
      ) : option?.special === "amazon" ? (
        <span className="flex flex-col items-center leading-none">
          <span className="text-[0.56em] font-black tracking-[-0.12em] text-[#111]">amazon</span>
          <svg className="mt-0.5 h-[20%] w-[82%]" viewBox="0 0 48 9" fill="none" aria-hidden="true">
            <path
              d="M3 2.5c10 7 26 7 40 .3"
              stroke="#FF9900"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path d="m40 2.8 5-.5-2.4 4" fill="#FF9900" />
          </svg>
        </span>
      ) : option?.icon ? (
        <svg className="size-[58%]" viewBox="0 0 24 24" fill="currentColor">
          <path d={option.icon.path} />
        </svg>
      ) : option?.generic ? (
        <GenericMark kind={option.generic} />
      ) : (
        (option?.initials ?? (name.trim().slice(0, 1).toUpperCase() || "•"))
      )}
    </span>
  );
}

function GenericMark({ kind }: { kind: SubscriptionLogoOption["generic"] }) {
  return (
    <svg
      className="size-[58%]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === "play" && <path d="M4 6h16v12H4z M10 9l5 3-5 3z" />}
      {kind === "music" && (
        <path d="M9 18V5l11-2v13 M9 18c0 3-6 4-6 1s6-4 6-1z M20 16c0 3-6 4-6 1s6-4 6-1z" />
      )}
      {kind === "cloud" && <path d="M7 18h11a4 4 0 0 0 .1-8A6 6 0 0 0 6.5 9 4.5 4.5 0 0 0 7 18z" />}
      {kind === "software" && <path d="M4 5h16v14H4z M4 9h16 M8 13l-2 2 2 2 M16 13l2 2-2 2" />}
      {kind === "game" && (
        <path d="M8 9h8c2 0 3 1 4 4l1 4c.5 2-1 3-2.5 2l-3-2h-7l-3 2C4 20 2.5 19 3 17l1-4c1-3 2-4 4-4z M8 12v4 M6 14h4 M16 13h.01 M18 15h.01" />
      )}
      {kind === "shield" && <path d="M12 3l8 3v5c0 5-3 8-8 10-5-2-8-5-8-10V6z M9 12l2 2 4-4" />}
      {kind === "other" && <path d="M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z" />}
    </svg>
  );
}
