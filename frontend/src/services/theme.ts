import { getCurrentUserId } from "./currentUser";
import { storageKey } from "./storageKeys";
import { DEFAULT_THEME_ID, listThemes, type ThemeId } from "../themes";

export type ThemeMode = "light" | "dark";

export type ThemeState = {
  themeId: ThemeId;
  mode: ThemeMode;
};

export function themeStorageKey(userId: string = getCurrentUserId()): string {
  return storageKey("theme", userId);
}

function normalizeThemeMode(value: unknown): ThemeMode | null {
  if (value === "light" || value === "dark") return value;
  return null;
}

function normalizeThemeId(value: unknown): ThemeId {
  if (typeof value !== "string") return DEFAULT_THEME_ID;
  const match = listThemes().find((theme) => theme.id === value);
  return match?.id ?? DEFAULT_THEME_ID;
}

export function readThemeState(): ThemeState | null {
  const raw = localStorage.getItem(themeStorageKey());
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;
    const mode = normalizeThemeMode(obj.mode);
    if (!mode) return null;
    return {
      themeId: normalizeThemeId(obj.themeId),
      mode,
    };
  } catch {
    return null;
  }
}

export function writeThemeState(state: ThemeState): void {
  localStorage.setItem(themeStorageKey(), JSON.stringify(state));
  applyThemeState(state);
}

export function applyThemeState(state: ThemeState): void {
  const root = document.documentElement;
  root.dataset.theme = state.themeId;
  if (state.mode === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}
