import { useCallback, useEffect, useId, useRef, useState } from "react";

const OPEN_EVENT = "terminal-option-layer-open";

/** Shared dismissal and exclusivity for menus, selects and autocomplete layers. */
export function useOptionLayer<T extends HTMLElement = HTMLButtonElement>() {
  const id = useId();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<T>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const show = useCallback(() => {
    document.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
    setOpen(true);
  }, [id]);

  useEffect(() => {
    const otherOpened = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id) close();
    };
    document.addEventListener(OPEN_EVENT, otherOpened);
    return () => document.removeEventListener(OPEN_EVENT, otherOpened);
  }, [id, close]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !layerRef.current?.contains(target)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close();
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", outside, true);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("focusin", outside, true);
      document.removeEventListener("keydown", escape, true);
    };
  }, [open, close]);

  return { id, open, triggerRef, layerRef, close, show };
}
