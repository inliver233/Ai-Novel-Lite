import { UI_COPY } from "./uiCopy";

export type RouteLayout = "home" | "paper" | "tool";

type RouteMeta = {
  suffix: string;
  title: string;
  layout: RouteLayout;
};

const ROUTE_META: RouteMeta[] = [
  { suffix: "/admin/users", title: UI_COPY.nav.adminUsers, layout: "tool" },
  { suffix: "/settings", title: UI_COPY.nav.projectSettings, layout: "paper" },
  { suffix: "/characters", title: UI_COPY.nav.characters, layout: "paper" },
  { suffix: "/entries", title: UI_COPY.nav.entries, layout: "paper" },
  { suffix: "/outline", title: UI_COPY.nav.outline, layout: "paper" },
  { suffix: "/wizard", title: UI_COPY.nav.wizard, layout: "tool" },
  { suffix: "/writing", title: UI_COPY.nav.writing, layout: "tool" },
  { suffix: "/preview", title: UI_COPY.nav.preview, layout: "paper" },
  { suffix: "/export", title: UI_COPY.nav.export, layout: "paper" },
  { suffix: "/search", title: UI_COPY.nav.search, layout: "tool" },
  { suffix: "/prompts", title: UI_COPY.nav.prompts, layout: "tool" },
  { suffix: "/prompt-studio", title: UI_COPY.nav.promptStudio, layout: "tool" },
  { suffix: "/prompt-templates", title: UI_COPY.nav.promptTemplates, layout: "tool" },
  { suffix: "/import", title: UI_COPY.nav.dataImport, layout: "tool" },
];

export function resolveRouteMeta(pathname: string): { title: string; layout: RouteLayout } {
  if (pathname === "/") return { title: UI_COPY.nav.home, layout: "home" };
  const match = ROUTE_META.find((it) => pathname.endsWith(it.suffix));
  return match ? { title: match.title, layout: match.layout } : { title: UI_COPY.brand.appName, layout: "tool" };
}
