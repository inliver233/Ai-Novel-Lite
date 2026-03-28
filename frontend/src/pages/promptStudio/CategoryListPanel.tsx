import clsx from "clsx";

import type { PromptStudioCategory } from "./types";

export function CategoryListPanel(props: {
  categories: PromptStudioCategory[];
  selectedKey: string;
  onSelect: (key: string) => void;
}) {
  const { categories, onSelect, selectedKey } = props;

  return (
    <div className="panel self-start p-3">
      <div className="px-2 text-sm font-semibold text-ink">分类</div>

      <nav className="mt-2 flex flex-col gap-0.5">
        {categories.length ? (
          categories.map((category) => {
            const activePreset = category.presets.find((p) => p.is_active)?.name ?? null;
            const selected = category.key === selectedKey;

            return (
              <button
                key={category.key}
                className={clsx(
                  "ui-transition-fast w-full rounded-atelier px-2.5 py-2 text-left",
                  selected
                    ? "bg-accent/10 text-ink"
                    : "text-subtext hover:bg-canvas hover:text-ink",
                )}
                onClick={() => onSelect(category.key)}
                type="button"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-medium">{category.label}</span>
                  <span className="shrink-0 tabular-nums text-[11px] text-subtext">
                    {category.presets.length}
                  </span>
                </div>
                {activePreset ? (
                  <div className="mt-0.5 truncate text-[11px] text-subtext">
                    生效：{activePreset}
                  </div>
                ) : null}
              </button>
            );
          })
        ) : (
          <div className="px-2.5 py-4 text-center text-sm text-subtext">暂无分类</div>
        )}
      </nav>
    </div>
  );
}
