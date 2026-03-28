import { List } from "lucide-react";

import type { OutlineListItem } from "../../types";

export function WritingToolbar(props: {
  outlines: OutlineListItem[];
  activeOutlineId: string;
  chaptersCount: number;
  batchProgressText: string;
  aiGenerateDisabled: boolean;
  onSwitchOutline: (outlineId: string) => void;
  onOpenChapterList: () => void;
  onOpenBatch: () => void;
  onOpenHistory: () => void;
  onOpenAiGenerate: () => void;
  onCreateChapter: () => void;
}) {
  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-subtext">当前大纲</span>
          <select
            className="select w-auto"
            name="active_outline_id"
            value={props.activeOutlineId}
            onChange={(e) => props.onSwitchOutline(e.target.value)}
          >
            {props.outlines.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
                {o.has_chapters ? "（已有章节）" : ""}
              </option>
            ))}
          </select>
          <span className="text-xs text-subtext">共 {props.chaptersCount} 章</span>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn btn-secondary lg:hidden" onClick={props.onOpenChapterList} type="button">
            <List size={16} />
            章节列表
          </button>
          <button className="btn btn-primary" onClick={props.onCreateChapter} type="button">
            新增章节
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-subtext">生成</span>
        <button
          className="btn btn-secondary"
          disabled={props.aiGenerateDisabled}
          onClick={props.onOpenAiGenerate}
          type="button"
        >
          AI 生成
        </button>
        <button
          className="btn btn-secondary"
          aria-label="Open batch generation (writing_open_batch_generation)"
          onClick={props.onOpenBatch}
          type="button"
        >
          批量生成{props.batchProgressText}
        </button>
        <button
          className="btn btn-secondary"
          aria-label="Open generation history (writing_open_generation_history)"
          onClick={props.onOpenHistory}
          type="button"
        >
          生成记录
        </button>
      </div>

      <div className="mt-3 text-xs text-subtext">
        提示：生成默认不会自动保存；若章节有未保存修改，会在生成前提示“保存并生成 / 直接生成”。
      </div>
    </div>
  );
}
