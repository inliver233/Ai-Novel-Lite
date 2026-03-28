import { Moon, Sun } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";

import { transition } from "../../lib/motion";
import { readThemeState, writeThemeState } from "../../services/theme";
import { DEFAULT_THEME_ID, listThemes, type ThemeId } from "../../themes";

export function ThemeToggle() {
  const themes = useMemo(() => listThemes(), []);
  const initial = useMemo(() => {
    const persisted = readThemeState();
    const root = document.documentElement;
    const mode = persisted?.mode ?? (root.classList.contains("dark") ? "dark" : "light");
    const domThemeId = themes.find((theme) => theme.id === root.dataset.theme)?.id ?? DEFAULT_THEME_ID;
    const themeId = persisted?.themeId ?? domThemeId;
    return { mode, themeId };
  }, [themes]);

  const [mode, setMode] = useState<"light" | "dark">(initial.mode);
  const [themeId, setThemeId] = useState<ThemeId>(initial.themeId);
  const reduceMotion = useReducedMotion();

  const Icon = mode === "dark" ? Sun : Moon;
  const label = mode === "dark" ? "切换到亮色" : "切换到暗色";
  const showThemePicker = themes.length >= 2;

  const toggleModeButton = (
    <button
      className="btn btn-secondary btn-icon"
      onClick={() => {
        const next = mode === "dark" ? "light" : "dark";
        setMode(next);
        writeThemeState({ themeId, mode: next });
      }}
      aria-label={label}
      title={label}
      type="button"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={mode}
          className="inline-flex"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, rotate: -90, scale: 0.9 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, rotate: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, rotate: 90, scale: 0.9 }}
          transition={reduceMotion ? { duration: 0.01 } : transition.fast}
        >
          <Icon size={18} />
        </motion.span>
      </AnimatePresence>
    </button>
  );

  if (!showThemePicker) return toggleModeButton;

  return (
    <div className="flex items-center gap-2">
      {toggleModeButton}
      <select
        className="select w-auto"
        aria-label="主题"
        title="主题"
        value={themeId}
        onChange={(e) => {
          const next = themes.find((theme) => theme.id === e.target.value)?.id ?? DEFAULT_THEME_ID;
          setThemeId(next);
          writeThemeState({ themeId: next, mode });
        }}
      >
        {themes.map((theme) => (
          <option key={theme.id} value={theme.id}>
            {theme.name}
          </option>
        ))}
      </select>
    </div>
  );
}
