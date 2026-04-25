import type { Zone, ScaleCalibration } from "@/types/workspace";

const STORAGE_KEY = "bisaware-workspace";

export type PersistedState = {
  zones: Zone[];
  scale: ScaleCalibration | null;
};

export function saveWorkspace(state: PersistedState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to save workspace:", e);
  }
}

export function loadWorkspace(): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error("Failed to load workspace:", e);
    return null;
  }
}

export function clearWorkspace(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("Failed to clear workspace:", e);
  }
}
