"use client";

import { useEffect, useState } from "react";

type Tab = { id: string; label: string; badge?: number | string | null };

export function ProduktTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState<string>(tabs[0]?.id ?? "");

  // Scroll-spy: highlight the tab whose section is currently in view
  useEffect(() => {
    const sections = tabs
      .map((t) => document.getElementById(`section-${t.id}`))
      .filter((el): el is HTMLElement => el != null);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const id = visible[0].target.id.replace("section-", "");
          setActive(id);
        }
      },
      { rootMargin: "-60px 0px -70% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [tabs]);

  function scrollTo(id: string) {
    const el = document.getElementById(`section-${id}`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const y = rect.top + window.scrollY - 60;
    window.scrollTo({ top: y, behavior: "smooth" });
    setActive(id);
  }

  return (
    <div
      className="-mx-6 flex gap-1 overflow-x-auto border-b border-border/60 px-6 pb-0"
      role="tablist"
    >
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => scrollTo(t.id)}
            className={`-mb-[1px] flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition-colors ${
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {t.badge != null && (
              <span className="font-mono text-[10.5px] text-muted-foreground/70">{t.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
