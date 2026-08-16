'use client';

import { usePathname } from 'next/navigation';
import { Library, MessageSquare, FolderOpen, Star, BookOpen } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Biblioteca', icon: Library, href: '/' },
  { label: 'Consulta', icon: MessageSquare, href: '/chat' },
  { label: 'Colecciones', icon: FolderOpen, href: '/collections' },
  { label: 'Favoritos', icon: Star, href: '/favorites' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-1 border-r border-stone-200 bg-stone-100 p-4 dark:border-stone-800 dark:bg-stone-950">
      <div className="mb-5 flex items-center gap-2 px-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-600 text-white">
          <BookOpen size={16} strokeWidth={2.25} />
        </div>
        <p className="text-sm font-semibold text-stone-900 dark:text-stone-50">Consulta a tu PDF</p>
      </div>
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
        const Icon = item.icon;
        return (
          <a
            key={item.label}
            href={item.href}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? 'bg-orange-100 text-orange-900 dark:bg-orange-500/15 dark:text-orange-300'
                : 'text-stone-600 hover:bg-stone-200/70 dark:text-stone-400 dark:hover:bg-stone-800/70'
            }`}
          >
            <Icon size={17} strokeWidth={2} />
            {item.label}
          </a>
        );
      })}
    </aside>
  );
}
