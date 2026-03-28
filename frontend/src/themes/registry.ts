import type { ThemeId, ThemeMeta } from "./types";

export const DEFAULT_THEME_ID: ThemeId = "paper-ink";

export const THEMES: ThemeMeta[] = [
  {
    id: "paper-ink",
    name: "纸墨",
    nameEn: "Paper Ink",
    description: "温润纸张与墨色对比的默认主题。",
  },
  {
    id: "ink-wash",
    name: "墨洗",
    nameEn: "Ink Wash",
    description: "占位：RF-019 将补全主题配色与细节。",
  },
];

export function getTheme(id: ThemeId): ThemeMeta | undefined {
  return THEMES.find((theme) => theme.id === id);
}

export function listThemes(): ThemeMeta[] {
  return THEMES;
}

