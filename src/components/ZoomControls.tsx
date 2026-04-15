type ZoomControlsProps = {
  onZoomIn: () => void;
  onZoomOut: () => void;
};

export function ZoomControls({ onZoomIn, onZoomOut }: ZoomControlsProps) {
  return (
    <div className="pointer-events-auto absolute bottom-5 left-5 z-30 flex items-center rounded-full bg-white/95 py-1 pl-1 pr-1 shadow-md ring-1 ring-black/10">
      <button
        type="button"
        aria-label="Zoom out"
        onClick={onZoomOut}
        className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-medium text-museum-fg transition-colors hover:bg-black/5"
      >
        −
      </button>
      <button
        type="button"
        aria-label="Zoom in"
        onClick={onZoomIn}
        className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-medium text-museum-fg transition-colors hover:bg-black/5"
      >
        +
      </button>
    </div>
  );
}
