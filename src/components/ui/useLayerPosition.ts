import { useEffect, useState, type CSSProperties, type RefObject } from "react";

export function useLayerPosition(
  triggerRef: RefObject<HTMLElement | null>,
  open: boolean,
  maxHeight = 256,
) {
  const [position, setPosition] = useState<CSSProperties>();
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(rect.width, window.innerWidth - 16);
      const below = Math.max(0, window.innerHeight - rect.bottom - 14);
      const above = Math.max(0, rect.top - 14);
      const useBelow = below >= Math.min(180, maxHeight) || below >= above;
      setPosition({
        width,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        maxHeight: Math.max(32, Math.min(maxHeight, useBelow ? below : above)),
        ...(useBelow ? { top: rect.bottom + 6 } : { bottom: window.innerHeight - rect.top + 6 }),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [triggerRef, open, maxHeight]);
  return position;
}
