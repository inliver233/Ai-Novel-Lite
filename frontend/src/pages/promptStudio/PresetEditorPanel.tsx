import { Check, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";

import { useConfirm } from "../../components/ui/confirm";
import type { PromptStudioCategory, PromptStudioPresetDetail } from "./types";

type PromptStudioPanelError = {
  message: string;
  code: string;
  requestId?: string;
};

type Props = {
  category: PromptStudioCategory | null;
  selectedPresetId: string | null;
  onSelectPreset: (presetId: string) => void;
  presetDetail: PromptStudioPresetDetail | null;
  draftName: string;
  draftContent: string;
  onDraftNameChange: (value: string) => void;
  onDraftContentChange: (value: string) => void;
  loading: boolean;
  busy: boolean;
  hasChanges: boolean;
  error: PromptStudioPanelError | null;
  onCreatePreset: (name: string, content: string) => Promise<PromptStudioPresetDetail | null>;
  onSave: () => Promise<PromptStudioPresetDetail | null>;
  onActivate: () => Promise<PromptStudioPresetDetail | null>;
  onDelete: () => Promise<boolean>;
};

function PresetEditorPanelContent(props: Props) {
  const {
    busy,
    category,
    draftContent,
    draftName,
    error,
    hasChanges,
    loading,
    onActivate,
    onCreatePreset,
    onDelete,
    onDraftContentChange,
    onDraftNameChange,
    onSave,
    onSelectPreset,
    presetDetail,
    selectedPresetId,
  } = props;

  const confirm = useConfirm();

  const [creating, setCreating] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [newPresetContent, setNewPresetContent] = useState("");

  const presets = category?.presets ?? [];
  const canCreate = Boolean(category) && !busy && !loading;
  const canSave = Boolean(presetDetail) && hasChanges && !busy && !loading;
  const canActivate = Boolean(presetDetail) && !presetDetail?.is_active && !busy && !loading;
  const canDelete = Boolean(presetDetail) && !busy && !loading;

  const handleCreate = async () => {
    const created = await onCreatePreset(newPresetName, newPresetContent);
    if (!created) return;
    setCreating(false);
    setNewPresetName("");
    setNewPresetContent("");
  };

  const handleDelete = async () => {
    if (!presetDetail) return;
    const ok = await confirm.confirm({
      title: "删除预设？",
      description: `将删除「${presetDetail.name}」。该操作不可撤销。`,
      confirmText: "删除",
      cancelText: "取消",
      danger: true,
    });
    if (!ok) return;
    await onDelete();
  };

  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-ink">{category?.label ?? "请选择左侧分类"}</div>
          <div className="mt-1 text-xs text-subtext">
            {category?.task ? `任务标识：${category.task}` : "在当前分类下管理预设内容与生效状态。"}
          </div>
        </div>
        <div className="text-xs text-subtext">{busy || loading ? "处理中…" : ""}</div>
      </div>

      {category ? (
        <div className="mt-4 flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <select
              className="select min-w-0 flex-1"
              value={selectedPresetId ?? ""}
              disabled={!presets.length || busy || loading || creating}
              onChange={(event) => onSelectPreset(event.currentTarget.value)}
            >
              {presets.length === 0 ? <option value="">暂无预设</option> : null}
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.is_active ? `✓ ${preset.name}` : preset.name}
                </option>
              ))}
            </select>

            <button
              className="btn btn-secondary"
              disabled={!canCreate}
              onClick={() => setCreating((prev) => !prev)}
              type="button"
            >
              <Plus size={16} />
              <span>{creating ? "取消新建" : "新建"}</span>
            </button>
          </div>

          {!creating && presetDetail ? (
            <div className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-xs text-subtext">
              {presetDetail.is_active ? (
                <>
                  <Check size={14} className="text-accent" />
                  <span className="text-accent">当前生效预设</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>可切换为当前生效预设</span>
                </>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {error && !creating ? (
        <div className="mt-4 rounded-atelier border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-subtext">
          {error.message} ({error.code}) {error.requestId ? `| request_id: ${error.requestId}` : ""}
        </div>
      ) : null}

      {!category ? (
        <div className="mt-6 rounded-atelier border border-dashed border-border bg-canvas px-4 py-12 text-center text-sm text-subtext">
          请先在左侧选择一个分类。
        </div>
      ) : null}

      {category && creating ? (
        <div className="mt-6 grid gap-4">
          <div className="rounded-atelier border border-border bg-canvas p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <Plus size={16} />
              <span>新建预设</span>
            </div>
            <div className="mt-1 text-xs text-subtext">将创建到「{category.label}」分类下。</div>
          </div>

          <label className="grid gap-1">
            <span className="text-xs text-subtext">名称</span>
            <input
              className="input"
              value={newPresetName}
              onChange={(event) => setNewPresetName(event.target.value)}
              placeholder="例如：章节生成·简洁版"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-subtext">内容</span>
            <textarea
              className="textarea min-h-[400px] font-mono text-sm"
              value={newPresetContent}
              onChange={(event) => setNewPresetContent(event.target.value)}
              placeholder="请填写完整提示词模板内容"
            />
          </label>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button className="btn btn-secondary" onClick={() => setCreating(false)} type="button">
              取消
            </button>
            <button
              className="btn btn-primary"
              disabled={busy || loading}
              onClick={() => void handleCreate()}
              type="button"
            >
              <Plus size={16} />
              <span>创建预设</span>
            </button>
          </div>
        </div>
      ) : null}

      {category && !creating && presets.length === 0 ? (
        <div className="mt-6 rounded-atelier border border-dashed border-border bg-canvas px-4 py-12 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-surface text-subtext">
            <Sparkles size={18} />
          </div>
          <div className="mt-3 text-sm font-medium text-ink">当前分类还没有预设</div>
          <div className="mt-1 text-sm text-subtext">点击“新建”创建第一个分类预设。</div>
          <button
            className="btn btn-primary mt-4"
            disabled={!canCreate}
            onClick={() => setCreating(true)}
            type="button"
          >
            <Plus size={16} />
            <span>新建预设</span>
          </button>
        </div>
      ) : null}

      {category && !creating && presets.length > 0 && loading && !presetDetail ? (
        <div className="mt-6 rounded-atelier border border-border bg-canvas px-4 py-12 text-center text-sm text-subtext">
          正在加载预设内容…
        </div>
      ) : null}

      {category && !creating && presets.length > 0 && !loading && !presetDetail ? (
        <div className="mt-6 rounded-atelier border border-dashed border-border bg-canvas px-4 py-12 text-center text-sm text-subtext">
          请选择一个预设进行编辑。
        </div>
      ) : null}

      {category && !creating && presetDetail ? (
        <div className="mt-6 grid gap-4">
          <label className="grid gap-1">
            <span className="text-xs text-subtext">名称</span>
            <input
              className="input"
              disabled={busy || loading}
              value={draftName}
              onChange={(event) => onDraftNameChange(event.target.value)}
              placeholder="请输入预设名称"
            />
          </label>

          <label className="grid gap-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-subtext">内容</span>
              <span className="text-xs text-subtext">{draftContent.length} 字符</span>
            </div>
            <textarea
              className="textarea min-h-[420px] font-mono text-sm"
              disabled={busy || loading}
              value={draftContent}
              onChange={(event) => onDraftContentChange(event.target.value)}
              placeholder="请填写提示词模板内容"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-subtext">{hasChanges ? "存在未保存修改" : "内容已同步"}</div>
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn btn-primary" disabled={!canSave} onClick={() => void onSave()} type="button">
                <Save size={16} />
                <span>保存</span>
              </button>
              <button
                className="btn btn-secondary"
                disabled={!canActivate}
                onClick={() => void onActivate()}
                type="button"
              >
                <Check size={16} />
                <span>使用此预设</span>
              </button>
              <button
                className="btn btn-ghost text-accent hover:bg-accent/10"
                disabled={!canDelete}
                onClick={() => void handleDelete()}
                type="button"
              >
                <Trash2 size={16} />
                <span>删除</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PresetEditorPanel(props: Props) {
  const panelKey = `${props.category?.key ?? "none"}:${props.selectedPresetId ?? "none"}`;
  return <PresetEditorPanelContent key={panelKey} {...props} />;
}
