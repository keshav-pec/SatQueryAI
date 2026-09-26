"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { Wordmark } from "./Logo";

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const inConsole = pathname?.startsWith("/analysis");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors ${scrolled || inConsole ? "glass border-x-0 border-t-0" : "border-b border-transparent"}`}
      style={{ height: "var(--nav-h)" }}
    >
      <nav className="mx-auto flex h-full items-center justify-between px-5 md:px-8" style={{ maxWidth: inConsole ? "none" : 1320 }}>
        <Link href="/" className="shrink-0" aria-label="SatQuery AI home">
          <Wordmark />
        </Link>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/api-docs"
            className={`rounded-lg px-3.5 py-2 text-[14px] font-medium transition-colors ${pathname?.startsWith("/api-docs") ? "bg-white/[0.07] text-ink" : "text-ink-2 hover:text-ink"}`}
          >
            API
          </Link>
          {!inConsole && (
            <Link href="/analysis" className="btn btn-primary btn-sm">
              Launch console <ArrowRight size={15} />
            </Link>
          )}
        </div>

        <button className="icon-btn md:hidden" aria-label="Toggle menu" onClick={() => setOpen((v) => !v)}>
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </nav>
      {open && (
        <div className="glass border-x-0 px-5 pb-4 pt-2 md:hidden">
          <Link href="/api-docs" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-[15px] text-ink-2 hover:bg-white/5 hover:text-ink">
            API
          </Link>
          {!inConsole && (
            <Link href="/analysis" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-[15px] text-ink-2 hover:bg-white/5 hover:text-ink">
              Launch console
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
