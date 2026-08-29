"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { href: "/about", label: "About" },
  { href: "/api-docs", label: "API" },
  { href: "/analysis", label: "QnA Section" },
];

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header
      className={`glass-navbar fixed top-0 left-0 right-0 z-50 ${scrolled ? "scrolled" : ""}`}
    >
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "68px",
          padding: "0 clamp(1.5rem, 4vw, 4rem)",
          maxWidth: "100%",
          margin: "0 auto",
        }}
      >
        {/* ─── Logo ─── */}
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--navy-800)",
              padding: "4px",
            }}
          >
            <Image
              src="/images/pngImage2.png"
              alt="SatQuery AI"
              width={32}
              height={32}
              style={{ objectFit: "contain" }}
            />
          </div>
          <div>
            <span
              style={{
                fontSize: "1.125rem",
                fontWeight: 700,
                color: "var(--navy-800)",
                letterSpacing: "-0.01em",
                lineHeight: 1.2,
                display: "block",
              }}
            >
              SatQuery AI
            </span>
            <span
              style={{
                fontSize: "0.6875rem",
                color: "var(--grey-500)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                lineHeight: 1,
              }}
            >
              Remote Sensing Analysis
            </span>
          </div>
        </Link>

        {/* ─── Desktop Nav Links ─── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
          }}
          className="desktop-nav"
        >
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  padding: "0.5rem 1.25rem",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.9375rem",
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "var(--navy-800)" : "var(--grey-600)",
                  textDecoration: "none",
                  transition: "all 0.2s ease",
                  background: isActive ? "var(--blue-50)" : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = "var(--navy-800)";
                    e.currentTarget.style.background = "var(--grey-100)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = "var(--grey-600)";
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* ─── Mobile Hamburger ─── */}
        <button
          className="mobile-menu-btn"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation menu"
          style={{
            display: "none",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0.5rem",
            color: "var(--navy-800)",
          }}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* ─── Mobile Menu ─── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              overflow: "hidden",
              borderTop: "1px solid var(--grey-200)",
              background: "var(--surface-white)",
            }}
            className="mobile-nav"
          >
            <div style={{ padding: "1rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              {NAV_LINKS.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    style={{
                      padding: "0.75rem 1rem",
                      borderRadius: "var(--radius-md)",
                      fontSize: "1rem",
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? "var(--navy-800)" : "var(--grey-600)",
                      textDecoration: "none",
                      background: isActive ? "var(--blue-50)" : "transparent",
                    }}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Responsive Styles ─── */}
      <style jsx global>{`
        @media (max-width: 768px) {
          .desktop-nav {
            display: none !important;
          }
          .mobile-menu-btn {
            display: flex !important;
          }
        }
      `}</style>
    </header>
  );
}
