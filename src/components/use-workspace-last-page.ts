"use client";

import { useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { getWorkspaceForPath, type WorkspaceId, getWorkspaceById } from "./workspace";

const STORAGE_KEY = "lichtengros.workspace.last-page";

type LastPageMap = Partial<Record<WorkspaceId, string>>;

function readMap(): LastPageMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as LastPageMap) : {};
  } catch {
    return {};
  }
}

function writeMap(map: LastPageMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage unavailable (private mode, quota) — silently ignore
  }
}

export function useWorkspaceLastPage() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    const ws = getWorkspaceForPath(pathname);
    const map = readMap();
    if (map[ws.id] === pathname) return;
    writeMap({ ...map, [ws.id]: pathname });
  }, [pathname]);

  const getTargetForWorkspace = useCallback((id: WorkspaceId): string => {
    const map = readMap();
    return map[id] ?? getWorkspaceById(id).landingPath;
  }, []);

  return { getTargetForWorkspace };
}
