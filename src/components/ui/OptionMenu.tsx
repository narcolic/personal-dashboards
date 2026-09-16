import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useOptionLayer } from "./useOptionLayer";

export type OptionMenuItem = { label: ReactNode; onSelect: () => void; destructive?: boolean };

export function OptionMenu({
  label,
  children,
  items,
  className = "",
  width = 224,
}: {
  label: string;
  children: ReactNode;
  items: OptionMenuItem[];
  className?: string;
  width?: number;
}) {
  const { id, open, triggerRef, layerRef, close, show } = useOptionLayer();
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  }>();
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuWidth = Math.min(width, window.innerWidth - 16);
      const height = Math.min(items.length * 44 + 12, window.innerHeight - 16);
      const below = window.innerHeight - rect.bottom - 12;
      const top = below >= height ? rect.bottom + 6 : Math.max(8, rect.top - height - 6);
      setPosition({
        left: Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8)),
        top,
        width: menuWidth,
        maxHeight: Math.max(44, window.innerHeight - top - 8),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, width, items.length, triggerRef]);
  const focusItem = (index: number) => {
    const buttons = layerRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]");
    if (buttons?.length) buttons[(index + buttons.length) % buttons.length]?.focus();
  };
  useEffect(() => {
    if (open && position && !layerRef.current?.contains(document.activeElement))
      layerRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [open, position, layerRef]);
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        className={className}
        onClick={() => (open ? close() : show())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            show();
          }
        }}
      >
        {children}
      </button>
      {open && position
        ? createPortal(
            <div
              ref={layerRef}
              id={id}
              role="menu"
              aria-label={label}
              style={position}
              className="option-layer fixed z-[100] overflow-auto rounded-xl border border-border bg-popover p-1.5 shadow-2xl"
              onKeyDown={(event) => {
                const buttons = Array.from(
                  layerRef.current?.querySelectorAll("[role=menuitem]") ?? [],
                );
                const index = buttons.indexOf(document.activeElement as Element);
                if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                  event.preventDefault();
                  focusItem(
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? buttons.length - 1
                        : index + (event.key === "ArrowDown" ? 1 : -1),
                  );
                }
              }}
            >
              {items.map((item, index) => (
                <button
                  key={index}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    close();
                    triggerRef.current?.focus();
                    item.onSelect();
                  }}
                  className={`block w-full rounded-lg px-3 py-2.5 text-left text-xs transition-colors hover:bg-secondary/60 focus:bg-secondary/60 focus:outline-none ${item.destructive ? "text-destructive" : "text-foreground"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
