const NAV_ITEMS = [
  { label: 'Biblioteca', icon: '📚', href: '/', active: true },
  { label: 'Colecciones', icon: '🗂️', href: '#', active: false },
  { label: 'Favoritos', icon: '⭐', href: '#', active: false },
];

export function Sidebar() {
  return (
    <aside className="flex w-56 shrink-0 flex-col gap-1 border-r border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="mb-4 px-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        Consulta a tu PDF
      </p>
      {NAV_ITEMS.map((item) => (
        <a
          key={item.label}
          href={item.href}
          aria-disabled={!item.active}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            item.active
              ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50'
              : 'cursor-not-allowed text-zinc-400 dark:text-zinc-600'
          }`}
        >
          <span aria-hidden>{item.icon}</span>
          {item.label}
          {!item.active && <span className="ml-auto text-[10px]">pronto</span>}
        </a>
      ))}
    </aside>
  );
}
