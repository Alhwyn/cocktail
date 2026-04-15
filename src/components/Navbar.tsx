const links = [
  { href: "#spirits", label: "Spirits", active: true },
] as const;

export function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-black/5 bg-museum-bg/90 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <a
          href="/"
          className="min-w-0 truncate font-semibold tracking-tight text-museum-fg"
        >
          cocktails.app
        </a>

        <nav
          className="hidden items-center gap-1 md:flex"
          aria-label="Primary"
        >
          {links.map(({ href, label, active }) => (
            <a
              key={href}
              href={href}
              className={
                active
                  ? "rounded-full bg-museum-fg px-3 py-1.5 text-sm font-medium text-museum-bg"
                  : "rounded-full px-3 py-1.5 text-sm font-medium text-museum-muted transition-colors hover:text-museum-fg"
              }
            >
              {label}
            </a>
          ))}
        </nav>

        <button
          type="button"
          className="shrink-0 rounded-full bg-museum-fg px-4 py-2 text-sm font-medium text-museum-bg transition-opacity hover:opacity-90"
        >
          Sign In
        </button>
      </div>
    </header>
  );
}
