import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export type TerminalSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type MenuPosition = {
  bottom?: number;
  left: number;
  top?: number;
  width: number;
};

export function TerminalSelect({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder,
  className = "",
  size = "md",
  disabled = false,
  required = false,
}: {
  value: string;
  options: TerminalSelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
  size?: "sm" | "md";
  disabled?: boolean;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = options[selectedIndex];

  useEffect(() => {
    if (!open) return;

    const positionMenu = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;

      const viewportPadding = 8;
      const width = Math.min(rect.width, window.innerWidth - viewportPadding * 2);
      const left = Math.min(
        Math.max(viewportPadding, rect.left),
        window.innerWidth - width - viewportPadding,
      );
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      setMenuPosition(
        spaceBelow >= 180 || spaceBelow >= spaceAbove
          ? { left, top: rect.bottom + 4, width }
          : { bottom: window.innerHeight - rect.top + 4, left, width },
      );
    };
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    positionMenu();
    document.addEventListener("pointerdown", closeOnOutsideClick);
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [open]);

  const openMenu = () => {
    if (disabled) return;
    const firstEnabled = options.findIndex((option) => !option.disabled);
    setFocusedIndex(
      selectedIndex >= 0 && !options[selectedIndex]?.disabled ? selectedIndex : firstEnabled,
    );
    setOpen(true);
  };

  const moveFocus = (direction: 1 | -1) => {
    if (options.length === 0) return;
    let nextIndex = focusedIndex;
    for (let count = 0; count < options.length; count += 1) {
      nextIndex = (nextIndex + direction + options.length) % options.length;
      if (!options[nextIndex]?.disabled) {
        setFocusedIndex(nextIndex);
        return;
      }
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) openMenu();
      else moveFocus(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && open) {
      event.preventDefault();
      const option = options[focusedIndex];
      if (option && !option.disabled) {
        onChange(option.value);
        setOpen(false);
      }
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className={`relative min-w-0 ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-required={required}
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={
          open && focusedIndex >= 0 ? `${listboxId}-${focusedIndex}` : undefined
        }
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleKeyDown}
        className={`flex w-full items-center justify-between gap-3 rounded-lg border bg-background/70 px-3 text-left text-foreground outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          size === "sm" ? "h-9 text-xs" : "h-10 text-sm"
        } ${
          open
            ? "border-primary/60 ring-1 ring-primary/20"
            : "border-border/70 hover:border-primary/50 focus-visible:border-primary/60 focus-visible:ring-1 focus-visible:ring-primary/20"
        }`}
      >
        <span className={`min-w-0 truncate ${selectedOption ? "" : "text-muted-foreground"}`}>
          {selectedOption?.label ?? placeholder ?? "—"}
        </span>
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 shrink-0 rotate-45 border-b border-r border-primary transition-transform ${
            open ? "rotate-[225deg] translate-y-0.5" : ""
          }`}
        />
      </button>

      {open && menuPosition && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              id={listboxId}
              role="listbox"
              aria-label={ariaLabel}
              className="terminal-scrollbar fixed z-[100] max-h-64 overflow-y-auto rounded-lg border border-border/70 bg-popover/95 p-1.5 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.95)] backdrop-blur-xl"
              style={menuPosition}
            >
              {options.map((option, index) => {
                const selected = option.value === value;
                const focused = index === focusedIndex;
                return (
                  <button
                    id={`${listboxId}-${index}`}
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={option.disabled}
                    onMouseEnter={() => setFocusedIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                      buttonRef.current?.focus();
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em] transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
                      selected
                        ? "bg-primary/12 text-primary"
                        : focused
                          ? "bg-secondary/55 text-foreground"
                          : "text-foreground hover:bg-secondary/55"
                    }`}
                  >
                    <span className="truncate">{option.label}</span>
                    {selected ? (
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
