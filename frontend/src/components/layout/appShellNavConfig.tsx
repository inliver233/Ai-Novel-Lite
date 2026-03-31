import type { LucideIcon } from "lucide-react";
import {
  Bot,
  BookOpen,
  BookText,
  FileDown,
  FileText,
  PenLine,
  Settings,
  Sparkles,
  TableOfContents,
  Users,
} from "lucide-react";

import { UI_COPY } from "../../lib/uiCopy";

export type AppShellProjectNavGroup = "workbench" | "view" | "aiConfig";

export type AppShellProjectNavItem = {
  id: string;
  group: AppShellProjectNavGroup;
  icon: LucideIcon;
  label: string;
  ariaLabel: string;
  to: (projectId: string) => string;
};

export const APP_SHELL_PRIMARY_PROJECT_NAV_GROUPS: AppShellProjectNavGroup[] = ["workbench", "view", "aiConfig"];

export const APP_SHELL_PROJECT_NAV_GROUP_TITLES: Record<AppShellProjectNavGroup, string> = {
  workbench: UI_COPY.nav.groupWorkbench,
  view: UI_COPY.nav.groupView,
  aiConfig: UI_COPY.nav.groupAiConfig,
};

export const APP_SHELL_PROJECT_NAV_ITEMS: ReadonlyArray<AppShellProjectNavItem> = [
  {
    id: "writing",
    group: "workbench",
    icon: PenLine,
    label: UI_COPY.nav.writing,
    ariaLabel: "写作 (nav_writing)",
    to: (projectId) => `/projects/${projectId}/writing`,
  },
  {
    id: "outline",
    group: "workbench",
    icon: TableOfContents,
    label: UI_COPY.nav.outline,
    ariaLabel: "大纲 (nav_outline)",
    to: (projectId) => `/projects/${projectId}/outline`,
  },
  {
    id: "characters",
    group: "workbench",
    icon: Users,
    label: UI_COPY.nav.characters,
    ariaLabel: "角色卡 (nav_characters)",
    to: (projectId) => `/projects/${projectId}/characters`,
  },
  {
    id: "entries",
    group: "workbench",
    icon: FileText,
    label: UI_COPY.nav.entries,
    ariaLabel: "条目 (nav_entries)",
    to: (projectId) => `/projects/${projectId}/entries`,
  },
  {
    id: "preview",
    group: "view",
    icon: BookOpen,
    label: UI_COPY.nav.preview,
    ariaLabel: "预览 (nav_preview)",
    to: (projectId) => `/projects/${projectId}/preview`,
  },
  {
    id: "export",
    group: "view",
    icon: FileDown,
    label: UI_COPY.nav.export,
    ariaLabel: "导出 (nav_export)",
    to: (projectId) => `/projects/${projectId}/export`,
  },
  {
    id: "prompts",
    group: "aiConfig",
    icon: Bot,
    label: UI_COPY.nav.prompts,
    ariaLabel: "模型配置 (nav_prompts)",
    to: (projectId) => `/projects/${projectId}/prompts`,
  },
  {
    id: "promptStudio",
    group: "aiConfig",
    icon: Sparkles,
    label: UI_COPY.nav.promptStudio,
    ariaLabel: "提示词工作室 (nav_prompt_studio)",
    to: (projectId) => `/projects/${projectId}/prompt-studio`,
  },
  {
    id: "settings",
    group: "aiConfig",
    icon: Settings,
    label: UI_COPY.nav.projectSettings,
    ariaLabel: "项目设置 (nav_settings)",
    to: (projectId) => `/projects/${projectId}/settings`,
  },
  {
    id: "search",
    group: "workbench",
    icon: BookText,
    label: UI_COPY.nav.search,
    ariaLabel: "搜索引擎 (nav_search)",
    to: (projectId) => `/projects/${projectId}/search`,
  },
];

export function getAppShellProjectNavItems(group: AppShellProjectNavGroup): AppShellProjectNavItem[] {
  return APP_SHELL_PROJECT_NAV_ITEMS.filter((item) => item.group === group);
}
