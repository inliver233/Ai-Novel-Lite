import { ProgressBar } from "./ProgressBar";

export type GenerationFloatingCardProps = {
  open: boolean;
  title: string;
  message?: string;
  progress: number;
  onExpand: () => void;
  onCancel: () => void;
};

export function GenerationFloatingCard(props: GenerationFloatingCardProps) {
  if (!props.open) return null;

  return (
    <div className="fixed inset-x-4 bottom-24 z-40 flex justify-center sm:inset-auto sm:bottom-8 sm:right-8 sm:justify-end">
      <div className="w-full max-w-sm rounded-atelier border border-border bg-surface/90 p-3 shadow-sm backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm text-ink">{props.title}</div>
            <div className="mt-1 truncate text-xs text-subtext">{props.message ?? "处理中..."}</div>
          </div>
          <div className="shrink-0 text-xs text-subtext">{Math.max(0, Math.min(100, props.progress))}%</div>
        </div>
        <ProgressBar ariaLabel={props.title} className="mt-2" value={props.progress} />
        <div className="mt-3 flex justify-end gap-2">
          <button className="btn btn-secondary" onClick={props.onExpand} type="button">
            展开
          </button>
          <button className="btn btn-secondary" onClick={props.onCancel} type="button">
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
