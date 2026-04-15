import type { CocktailCard } from "../data/cocktails";
import type { PanZoomTransform } from "../hooks/useCanvasPanZoom";

/** Stable ±6° tilt per cocktail so frames don't jump on re-render. */
function polaroidTiltDeg(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return (h & 1) === 0 ? -6 : 6;
}

type PointerHandlers = {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLElement>) => void;
};

type HeroCanvasProps = {
  cocktails: CocktailCard[];
  selectedCocktailId: string | null;
  canvasWidth: number;
  canvasHeight: number;
  transform: PanZoomTransform;
  dragging: boolean;
  pointerHandlers: PointerHandlers;
  onWheel: (e: React.WheelEvent<HTMLElement>) => void;
  onSelectCocktail: (cocktail: CocktailCard) => void;
};

export function HeroCanvas({
  cocktails,
  selectedCocktailId,
  canvasWidth,
  canvasHeight,
  transform,
  dragging,
  pointerHandlers,
  onWheel,
  onSelectCocktail,
}: HeroCanvasProps) {
  return (
    <div
      className={`absolute inset-0 z-10 touch-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
      style={{ touchAction: "none" }}
      {...pointerHandlers}
      onWheel={onWheel}
    >
      <div
        className="absolute left-0 top-0 will-change-transform"
        style={{
          width: canvasWidth,
          height: canvasHeight,
          transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})`,
          transformOrigin: "0 0",
        }}
      >
        {cocktails.map(c => (
          <article
            key={c.id}
            className="absolute w-44 select-none"
            style={{
              left: c.x,
              top: c.y,
              transform: `rotate(${polaroidTiltDeg(c.id)}deg)`,
            }}
          >
            <button
              type="button"
              className={`flex w-full flex-col bg-white px-2.5 pt-2.5 pb-5 text-left shadow-[0_12px_28px_rgba(15,23,42,0.16),0_4px_8px_rgba(15,23,42,0.08)] transition-transform duration-150 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-museum-fg ${
                selectedCocktailId === c.id ? "ring-2 ring-museum-fg" : ""
              }`}
              aria-pressed={selectedCocktailId === c.id}
              onPointerDown={e => e.stopPropagation()}
              onClick={() => onSelectCocktail(c)}
            >
              <div className="w-full overflow-hidden bg-neutral-100">
                <img
                  src={c.image}
                  alt=""
                  width={180}
                  height={240}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="pointer-events-none aspect-[3/4] h-auto w-full object-cover"
                />
              </div>
              <p className="mt-3 px-0.5 text-center text-sm font-medium leading-snug text-museum-muted">
                {c.name}
              </p>
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
