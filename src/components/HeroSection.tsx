import { useLayoutEffect, useRef, useState } from "react";
import { museumLayoutFromItems, type CocktailCard } from "../data/cocktails";
import { useCanvasPanZoom } from "../hooks/useCanvasPanZoom";
import { HeroCanvas } from "./HeroCanvas";
import { ZoomControls } from "./ZoomControls";

type MuseumApiOk = {
  ok: true;
  cocktails: {
    id: string;
    name: string;
    image: string;
    description: string;
    ingredients: string[];
  }[];
};
type MuseumApiErr = { ok: false; error?: string; cocktails?: [] };

export function HeroSection() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [cocktails, setCocktails] = useState<CocktailCard[]>([]);
  const [selectedCocktailId, setSelectedCocktailId] = useState<string | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(1200);
  const [canvasHeight, setCanvasHeight] = useState(800);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { transform, setTransform, dragging, pointerHandlers, onWheel, zoomByFactorAtRect } =
    useCanvasPanZoom({
      scale: 1,
      tx: 0,
      ty: 0,
    });

  useLayoutEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/museum/cocktails");
        const body = (await res.json()) as MuseumApiOk | MuseumApiErr;
        if (cancelled) return;
        if (!res.ok || !body.ok) {
          setLoadError(
            "error" in body && body.error ? body.error : "Could not load museum cocktails",
          );
          return;
        }
        const usable = body.cocktails.filter(c => c.image);
        const { cocktails: laidOut, width, height } = museumLayoutFromItems(usable);
        setCocktails(laidOut);
        setSelectedCocktailId(current =>
          laidOut.some(c => c.id === current) ? current : null,
        );
        setCanvasWidth(width);
        setCanvasHeight(height);
        setLoadError(null);
      } catch {
        if (!cancelled) setLoadError("Could not load museum cocktails");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useLayoutEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setTransform({
      scale: 1,
      tx: (r.width - canvasWidth) / 2,
      ty: (r.height - canvasHeight) / 2,
    });
  }, [setTransform, canvasWidth, canvasHeight]);

  const zoomAnchor = () => {
    const el = heroRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      rect,
    };
  };

  const handleZoomIn = () => {
    const a = zoomAnchor();
    if (a) zoomByFactorAtRect(1.15, a.x, a.y, a.rect);
  };

  const handleZoomOut = () => {
    const a = zoomAnchor();
    if (a) zoomByFactorAtRect(1 / 1.15, a.x, a.y, a.rect);
  };

  const selectedCocktail = cocktails.find(c => c.id === selectedCocktailId) ?? null;

  return (
    <section className="relative h-[calc(100vh-56px)]">
      <div
        ref={heroRef}
        className="relative h-full w-full overflow-hidden bg-museum-bg"
      >
        {loadError && (
          <p
            className="absolute inset-x-0 top-4 z-20 mx-auto max-w-md rounded-lg bg-museum-fg/10 px-4 py-2 text-center text-sm text-museum-fg"
            role="alert"
          >
            {loadError}
          </p>
        )}
        <HeroCanvas
          cocktails={cocktails}
          selectedCocktailId={selectedCocktailId}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          transform={transform}
          dragging={dragging}
          pointerHandlers={pointerHandlers}
          onWheel={onWheel}
          onSelectCocktail={cocktail => setSelectedCocktailId(cocktail.id)}
        />
        <aside className="pointer-events-none absolute inset-x-4 bottom-4 z-20 sm:left-4 sm:right-auto sm:max-w-sm">
          <div className="pointer-events-auto rounded-2xl bg-white/95 p-4 shadow-[0_20px_45px_rgba(15,23,42,0.18)] ring-1 ring-black/5 backdrop-blur">
            {selectedCocktail ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-museum-muted/70">
                      Cocktail Details
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-museum-fg">
                      {selectedCocktail.name}
                    </h2>
                  </div>
                  <button
                    type="button"
                    className="rounded-full px-2 py-1 text-sm text-museum-muted transition hover:bg-black/5"
                    onClick={() => setSelectedCocktailId(null)}
                  >
                    Close
                  </button>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-museum-fg">Ingredients</h3>
                  {selectedCocktail.ingredients.length > 0 ? (
                    <ul className="mt-2 space-y-1.5 text-sm text-museum-muted">
                      {selectedCocktail.ingredients.map(ingredient => (
                        <li key={ingredient}>{ingredient}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-museum-muted">
                      Ingredients are not available for this cocktail yet.
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-museum-fg">Description</h3>
                  <p className="mt-2 text-sm leading-6 text-museum-muted">
                    {selectedCocktail.description || "Description is not available for this cocktail yet."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-museum-muted/70">
                  Cocktail Details
                </p>
                <p className="text-sm leading-6 text-museum-muted">
                  Click any cocktail card to see its ingredients and description.
                </p>
              </div>
            )}
          </div>
        </aside>
        <ZoomControls onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} />
      </div>
    </section>
  );
}
