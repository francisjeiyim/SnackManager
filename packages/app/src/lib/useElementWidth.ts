import { useCallback, useRef, useState } from "react";

/**
 * Tracks the content-box width of an element via ResizeObserver.
 * Returns a callback ref, so it works even when the element mounts later
 * (e.g. behind a loading gate).
 */
export function useElementWidth<T extends HTMLElement>(): [(node: T | null) => void, number] {
  const [width, setWidth] = useState(0);
  const roRef = useRef<ResizeObserver | null>(null);

  const setRef = useCallback((node: T | null) => {
    roRef.current?.disconnect();
    if (!node) return;
    setWidth(node.clientWidth);
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(e.contentRect.width);
    });
    ro.observe(node);
    roRef.current = ro;
  }, []);

  return [setRef, width];
}
