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
    description: "灰墨水洗风格，素雅安静的书卷气息。",
  },
];

export function getTheme(id: ThemeId): ThemeMeta | undefined {
  return THEMES.find((theme) => theme.id === id);
}

export function listThemes(): ThemeMeta[] {
  return THEMES;
}
