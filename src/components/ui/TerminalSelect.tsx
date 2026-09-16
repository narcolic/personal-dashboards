import { createPortal } from "react-dom";
import { useState, type KeyboardEvent } from "react";
import { useOptionLayer } from "./useOptionLayer";
import { useLayerPosition } from "./useLayerPosition";

export type TerminalSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
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
  invalid = false,
  describedBy,
  id,
  modern = false,
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
  invalid?: boolean;
  describedBy?: string;
  id?: string;
  modern?: boolean;
}) {
  const {
    open,
    close,
    show,
    triggerRef: buttonRef,
    layerRef: menuRef,
    id: listboxId,
  } = useOptionLayer();
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const menuPosition = useLayerPosition(buttonRef, open);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = options[selectedIndex];

  const openMenu = () => {
    if (disabled) return;
    const firstEnabled = options.findIndex((option) => !option.disabled);
    setFocusedIndex(
      selectedIndex >= 0 && !options[selectedIndex]?.disabled ? selectedIndex : firstEnabled,
    );
    show();
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
        close();
      }
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      close();
    }
  };

  return (
    <div className={`relative min-w-0 ${className}`}>
      <button
        id={id}
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-required={required}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={
          open && focusedIndex >= 0 ? `${listboxId}-${focusedIndex}` : undefined
        }
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={handleKeyDown}
        className={`flex w-full items-center justify-between gap-3 rounded-lg border bg-background/70 px-3 text-left text-foreground outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          size === "sm" ? "h-9 text-xs" : modern ? "h-11 text-sm" : "h-10 text-sm"
        } ${
          invalid
            ? "border-destructive ring-1 ring-destructive/20"
            : open
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
              className={`option-layer terminal-scrollbar fixed z-[100] max-h-64 overflow-y-auto rounded-lg border border-border/70 bg-popover/95 p-1.5 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.95)] backdrop-blur-xl ${modern ? "font-analytics" : ""}`}
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
                    tabIndex={-1}
                    onMouseEnter={() => setFocusedIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onChange(option.value);
                      close();
                      buttonRef.current?.focus();
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left ${modern ? "text-sm" : "text-[11px] uppercase tracking-[0.08em]"} transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
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
