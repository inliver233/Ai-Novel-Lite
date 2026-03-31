import type { LLMPreset } from "../../../types";
import type { GenerateForm } from "../types";
import { AI_GENERATE_DRAWER_COPY } from "./aiGenerateDrawerCopy";

export type WritingStyle = {
  id: string;
  name: string;
  is_preset: boolean;
};

export type ContextToggleKey = Exclude<keyof GenerateForm["context"], "character_ids" | "entry_ids">;

export const AI_GENERATE_CONTEXT_TOGGLES: ReadonlyArray<{ key: ContextToggleKey; label: string; inputName: string }> = [
  { key: "include_world_setting", label: "世界观", inputName: "context_include_world_setting" },
  { key: "include_style_guide", label: "风格", inputName: "context_include_style_guide" },
  { key: "include_constraints", label: "约束", inputName: "context_include_constraints" },
  { key: "include_outline", label: "大纲", inputName: "context_include_outline" },
  { key: "include_smart_context", label: "智能上下文", inputName: "context_include_smart_context" },
  { key: "require_sequential", label: "严格顺序", inputName: "context_require_sequential" },
];

export function getAiGenerateDrawerState(args: { genForm: GenerateForm; preset: LLMPreset | null }) {
  const { genForm, preset } = args;
  const hasPromptOverride = genForm.prompt_override != null;
  return {
    hasPromptOverride,
    presetSummary: preset ? `${preset.provider} / ${preset.model}` : AI_GENERATE_DRAWER_COPY.llmMissing,
  };
}

export function getStyleHelperText(projectDefaultStyleName: string | null, stylesErrorCode: string | null) {
  const defaultName = projectDefaultStyleName ?? AI_GENERATE_DRAWER_COPY.basicSection.styleUnset;
  return `${AI_GENERATE_DRAWER_COPY.basicSection.styleDefaultPrefix}${defaultName}${
    stylesErrorCode ? `${AI_GENERATE_DRAWER_COPY.basicSection.styleLoadFailedPrefix}${stylesErrorCode}` : ""
  }`;
}
