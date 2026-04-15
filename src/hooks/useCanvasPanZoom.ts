import { useCallback, useRef, useState } from "react";

const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;

export type PanZoomTransform = {
  scale: number;
  tx: number;
  ty: number;
};

function clampScale(s: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

export function useCanvasPanZoom(initialTransform: PanZoomTransform) {
  const [transform, setTransform] = useState<PanZoomTransform>(initialTransform);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });

  const setTransformFromWheel = useCallback(
    (e: React.WheelEvent<HTMLElement>) => {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * 0.001);
      setTransform(t => {
        const nextScale = clampScale(t.scale * factor);
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const worldX = (mx - t.tx) / t.scale;
        const worldY = (my - t.ty) / t.scale;
        return {
          scale: nextScale,
          tx: mx - worldX * nextScale,
          ty: my - worldY * nextScale,
        };
      });
    },
    []
  );

  const zoomByFactorAtRect = useCallback(
    (factor: number, anchorClientX: number, anchorClientY: number, rect: DOMRect) => {
      setTransform(t => {
        const nextScale = clampScale(t.scale * factor);
        const mx = anchorClientX - rect.left;
        const my = anchorClientY - rect.top;
        const worldX = (mx - t.tx) / t.scale;
        const worldY = (my - t.ty) / t.scale;
        return {
          scale: nextScale,
          tx: mx - worldX * nextScale,
          ty: my - worldY * nextScale,
        };
      });
    },
    []
  );

  const pointerHandlers = {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      draggingRef.current = true;
      setDragging(true);
      lastPointer.current = { x: e.clientX, y: e.clientY };
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      if (!draggingRef.current) return;
      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      setTransform(t => ({ ...t, tx: t.tx + dx, ty: t.ty + dy }));
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      draggingRef.current = false;
      setDragging(false);
    },
    onPointerCancel: (e: React.PointerEvent<HTMLElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      draggingRef.current = false;
      setDragging(false);
    },
  } as const;

  return {
    transform,
    setTransform,
    dragging,
    pointerHandlers,
    onWheel: setTransformFromWheel,
    zoomByFactorAtRect,
  };
}
