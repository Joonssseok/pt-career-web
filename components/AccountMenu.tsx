"use client";

import { createContext, useContext, useEffect, useId, useState } from "react";
import { usePathname } from "next/navigation";

const MenuContext = createContext<{
  open: string | null;
  toggle: (id: string) => void;
}>({ open: null, toggle: () => {} });
export function AccountMenu({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const selected = pathname.startsWith("/my/damoa")
    ? "damoa"
    : pathname.startsWith("/expert/edit")
      ? "profile"
      : pathname.startsWith("/my/account") ||
          pathname.startsWith("/my/terms") ||
          pathname.startsWith("/my/delete-account")
        ? "account"
        : null;
  const [open, setOpen] = useState<string | null>(selected);
  useEffect(() => {
    setOpen(selected);
  }, [selected]);
  return (
    <MenuContext.Provider
      value={{
        open,
        toggle: (id) => setOpen((current) => (current === id ? null : id)),
      }}
    >
      <nav aria-label="마이페이지 메뉴" className="space-y-3">
        {children}
      </nav>
    </MenuContext.Provider>
  );
}
export function AccountMenuSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  const { open, toggle } = useContext(MenuContext);
  const panelId = useId();
  const expanded = open === id;
  return (
    <div>
      <button
        type="button"
        onClick={() => toggle(id)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className={`flex min-h-12 w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-bold transition-colors ${expanded ? "bg-blue-50 text-primary" : "text-slate-950 hover:bg-slate-50"}`}
      >
        {title}
        <span aria-hidden="true" className="text-xs text-slate-400">
          {expanded ? "▾" : "▸"}
        </span>
      </button>
      <div
        id={panelId}
        hidden={!expanded}
        className="mt-2 space-y-1 border-l border-blue-100 pl-2 ml-3"
      >
        {expanded && children}
      </div>
    </div>
  );
}
