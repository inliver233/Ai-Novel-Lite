import type { Dispatch, SetStateAction } from "react";

import type { GenerateForm } from "../types";
import { AI_GENERATE_DRAWER_COPY } from "./aiGenerateDrawerCopy";

type Props = {
  advancedOpen: boolean;
  advancedPanelId: string;
  generating: boolean;
  genForm: GenerateForm;
  setAdvancedOpen: Dispatch<SetStateAction<boolean>>;
  setGenForm: Dispatch<SetStateAction<GenerateForm>>;
};

export function AiGenerateAdvancedSection(props: Props) {
  return (
    <div className="panel p-3">
      <button
        className="ui-focus-ring ui-pressable flex w-full items-center justify-between gap-3 rounded-atelier px-2 py-2 text-left hover:bg-canvas"
        aria-controls={props.advancedPanelId}
        aria-expanded={props.advancedOpen}
        onClick={() => props.setAdvancedOpen((open) => !open)}
        type="button"
      >
        <span className="text-sm font-medium text-ink">{AI_GENERATE_DRAWER_COPY.advancedSection.title}</span>
        <span aria-hidden="true" className="text-xs text-subtext">
          {props.advancedOpen
            ? AI_GENERATE_DRAWER_COPY.advancedSection.collapse
            : AI_GENERATE_DRAWER_COPY.advancedSection.expand}
        </span>
      </button>

      {!props.advancedOpen ? (
        <div className="mt-2 text-[11px] text-subtext">{AI_GENERATE_DRAWER_COPY.advancedSection.collapsedHint}</div>
      ) : null}

      {props.advancedOpen ? (
        <div className="mt-3 grid gap-2" id={props.advancedPanelId}>
          <label className="flex items-center justify-between gap-3 text-sm text-ink">
            <span>{AI_GENERATE_DRAWER_COPY.advancedSection.stream}</span>
            <input
              className="checkbox"
              checked={props.genForm.stream}
              disabled={props.generating}
              name="stream"
              onChange={(event) => {
                const checked = event.target.checked;
                props.setGenForm((current) => ({ ...current, stream: checked }));
              }}
              type="checkbox"
            />
          </label>
        </div>
      ) : (
        <div id={props.advancedPanelId} hidden />
      )}
    </div>
  );
}
