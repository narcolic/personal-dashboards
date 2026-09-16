import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]';

export function useDialogFocus(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
  busy: boolean,
) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [ref]);
  useEffect(() => {
    const ownedLayers = () =>
      Array.from(ref.current?.querySelectorAll("[aria-controls]") ?? [])
        .map((trigger) => document.getElementById(trigger.getAttribute("aria-controls") ?? ""))
        .filter((node): node is HTMLElement => Boolean(node));
    const belongs = (node: Node) =>
      ref.current?.contains(node) || ownedLayers().some((layer) => layer.contains(node));
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busy) onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = [
        ...Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []),
        ...ownedLayers().flatMap((layer) =>
          Array.from(layer.querySelectorAll<HTMLElement>(FOCUSABLE)),
        ),
      ].filter((node) => node.getClientRects().length > 0);
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first || !belongs(document.activeElement as Node))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !belongs(document.activeElement as Node))
      ) {
        event.preventDefault();
        first?.focus();
      }
    };
    const focusin = (event: FocusEvent) => {
      if (!belongs(event.target as Node))
        ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    };
    document.addEventListener("keydown", keydown);
    document.addEventListener("focusin", focusin);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.removeEventListener("focusin", focusin);
    };
  }, [ref, onClose, busy]);
}
