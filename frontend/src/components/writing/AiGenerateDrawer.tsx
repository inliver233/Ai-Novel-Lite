import { useCallback, useEffect, useId, useMemo, useState, type Dispatch, type SetStateAction } from "react";

import { ProgressBar } from "../ui/ProgressBar";
import { Drawer } from "../ui/Drawer";
import { useIsMobile } from "../../hooks/useIsMobile";
import type { Character, LLMPreset } from "../../types";
import { AiGenerateAdvancedSection } from "./aiGenerateDrawer/AiGenerateAdvancedSection";
import { AI_GENERATE_DRAWER_COPY } from "./aiGenerateDrawer/aiGenerateDrawerCopy";
import { AiGenerateDefaultSection } from "./aiGenerateDrawer/AiGenerateDefaultSection";
import { getAiGenerateDrawerState, getStyleHelperText } from "./aiGenerateDrawer/aiGenerateDrawerModels";
import { useAiGenerateStyles } from "./aiGenerateDrawer/useAiGenerateStyles";
import type { GenerateForm } from "./types";
import { WRITING_RUNTIME_COPY } from "./writingRuntimeCopy";

type Props = {
  open: boolean;
  generating: boolean;
  preset: LLMPreset | null;
  projectId?: string;
  activeChapter: boolean;
  dirty: boolean;
  saving?: boolean;
  genForm: GenerateForm;
  setGenForm: Dispatch<SetStateAction<GenerateForm>>;
  characters: Character[];
  entries: { id: string; title: string; tags: string[] }[];
  streamProgress?: { message: string; progress: number; status: string; charCount?: number } | null;
  onClose: () => void;
  onSave: () => void | Promise<unknown>;
  onSaveAndGenerateNext?: () => void | Promise<unknown>;
  onGenerateAppend: () => void;
  onGenerateReplace: () => void;
  onCancelGenerate?: () => void;
  onOpenPromptInspector: () => void;
};

export function AiGenerateDrawer(props: Props) {
  const titleId = useId();
  const advancedPanelId = useId();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const drawerState = useMemo(
    () => getAiGenerateDrawerState({ genForm: props.genForm, preset: props.preset }),
    [props.genForm, props.preset],
  );
  const styles = useAiGenerateStyles({ open: props.open, projectId: props.projectId });
  const styleHelperText = useMemo(
    () => getStyleHelperText(styles.projectDefaultStyle?.name ?? null, styles.stylesError?.code ?? null),
    [styles.projectDefaultStyle?.name, styles.stylesError?.code],
  );

  const isMobile = useIsMobile();

  const closeDrawer = useCallback(() => {
    setAdvancedOpen(false);
    props.onClose();
  }, [props]);

  useEffect(() => {
    if (!props.open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeDrawer();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeDrawer, props.open]);

  return (
    <Drawer
      open={props.open}
      onClose={closeDrawer}
      side={isMobile ? "bottom" : "right"}
      ariaLabelledBy={titleId}
      panelClassName="h-[85dvh] sm:h-full w-full overflow-y-auto rounded-t-atelier border-t border-border bg-canvas p-4 shadow-sm sm:max-w-md sm:rounded-none sm:border-t-0 sm:border-l sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-content text-2xl text-ink" id={titleId}>
            {AI_GENERATE_DRAWER_COPY.title}
          </div>
          <div className="mt-1 text-xs text-subtext">{drawerState.presetSummary}</div>
          {drawerState.hasPromptOverride ? (
            <div className="mt-2 callout-warning">{WRITING_RUNTIME_COPY.promptOverrideWarning}</div>
          ) : null}
        </div>
        <button className="btn btn-secondary" aria-label="关闭" onClick={closeDrawer} type="button">
          {AI_GENERATE_DRAWER_COPY.close}
        </button>
      </div>

      <div className="mt-5 grid gap-4">
        <AiGenerateDefaultSection
          generating={props.generating}
          genForm={props.genForm}
          setGenForm={props.setGenForm}
          characters={props.characters}
          entries={props.entries}
          stylesLoading={styles.stylesLoading}
          presets={styles.presets}
          userStyles={styles.userStyles}
          styleHelperText={styleHelperText}
        />

        {props.genForm.stream && props.generating ? (
          <div className="panel p-3">
            <div className="flex items-center justify-between gap-2 text-xs text-subtext">
              <span className="truncate">
                {props.streamProgress?.message ?? AI_GENERATE_DRAWER_COPY.streamConnecting}
              </span>
              <span className="shrink-0">{props.streamProgress?.progress ?? 0}%</span>
            </div>
            <ProgressBar ariaLabel="章节流式生成进度" value={props.streamProgress?.progress ?? 0} />
            {props.onCancelGenerate ? (
              <div className="flex justify-end">
                <button className="btn btn-secondary" onClick={props.onCancelGenerate} type="button">
                  {AI_GENERATE_DRAWER_COPY.cancelGenerate}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <AiGenerateAdvancedSection
          advancedOpen={advancedOpen}
          advancedPanelId={advancedPanelId}
          generating={props.generating}
          genForm={props.genForm}
          setAdvancedOpen={setAdvancedOpen}
          setGenForm={props.setGenForm}
        />

        <div className="panel p-3 text-xs text-subtext">{AI_GENERATE_DRAWER_COPY.autosaveHint}</div>
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button
          className="btn btn-secondary"
          disabled={props.generating || !props.activeChapter}
          onClick={props.onOpenPromptInspector}
          type="button"
        >
          {AI_GENERATE_DRAWER_COPY.actions.promptInspector}
          {drawerState.hasPromptOverride ? AI_GENERATE_DRAWER_COPY.actions.promptInspectorOverrideSuffix : ""}
        </button>
        {drawerState.hasPromptOverride ? (
          <button
            className="btn btn-secondary"
            disabled={props.generating}
            onClick={() => props.setGenForm((current) => ({ ...current, prompt_override: null }))}
            type="button"
          >
            {AI_GENERATE_DRAWER_COPY.actions.resetPromptOverride}
          </button>
        ) : null}
        <button
          className="btn btn-primary"
          disabled={props.generating || !props.activeChapter}
          onClick={props.onGenerateReplace}
          type="button"
        >
          {props.generating ? AI_GENERATE_DRAWER_COPY.actions.generating : AI_GENERATE_DRAWER_COPY.actions.generate}
        </button>
        {props.onSaveAndGenerateNext ? (
          <button
            className="btn btn-primary"
            disabled={props.generating || props.saving || !props.activeChapter}
            onClick={() => void props.onSaveAndGenerateNext?.()}
            type="button"
          >
            {props.saving ? AI_GENERATE_DRAWER_COPY.actions.saving : AI_GENERATE_DRAWER_COPY.actions.saveAndContinue}
          </button>
        ) : null}
        <button
          className="btn btn-secondary"
          disabled={props.generating || !props.activeChapter}
          onClick={props.onGenerateAppend}
          type="button"
        >
          {props.generating
            ? AI_GENERATE_DRAWER_COPY.actions.generating
            : AI_GENERATE_DRAWER_COPY.actions.appendGenerate}
        </button>
        <button
          className="btn btn-secondary"
          disabled={props.generating || props.saving || !props.activeChapter || !props.dirty}
          onClick={() => void props.onSave()}
          type="button"
        >
          {props.saving ? AI_GENERATE_DRAWER_COPY.actions.saving : AI_GENERATE_DRAWER_COPY.actions.save}
        </button>
      </div>
    </Drawer>
  );
}
