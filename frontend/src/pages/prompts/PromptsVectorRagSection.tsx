import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { RequestIdBadge } from "../../components/ui/RequestIdBadge";
import type { ProjectSettings } from "../../types";

import type { VectorEmbeddingDryRunResult, VectorRagForm, VectorRerankDryRunResult } from "./models";

type DryRunErrorState = {
  message: string;
  code: string;
  requestId?: string;
};

type DryRunState<T> = {
  requestId: string;
  result: T;
};

export type PromptsVectorRagSectionProps = {
  baselineSettings: ProjectSettings | null;
  vectorForm: VectorRagForm;
  setVectorForm: Dispatch<SetStateAction<VectorRagForm>>;
  vectorRerankTopKDraft: string;
  setVectorRerankTopKDraft: Dispatch<SetStateAction<string>>;
  vectorRerankTimeoutDraft: string;
  setVectorRerankTimeoutDraft: Dispatch<SetStateAction<string>>;
  vectorRerankHybridAlphaDraft: string;
  setVectorRerankHybridAlphaDraft: Dispatch<SetStateAction<string>>;
  vectorApiKeyDraft: string;
  setVectorApiKeyDraft: Dispatch<SetStateAction<string>>;
  vectorApiKeyClearRequested: boolean;
  setVectorApiKeyClearRequested: Dispatch<SetStateAction<boolean>>;
  rerankApiKeyDraft: string;
  setRerankApiKeyDraft: Dispatch<SetStateAction<string>>;
  rerankApiKeyClearRequested: boolean;
  setRerankApiKeyClearRequested: Dispatch<SetStateAction<boolean>>;
  savingVector: boolean;
  vectorRagDirty: boolean;
  vectorApiKeyDirty: boolean;
  rerankApiKeyDirty: boolean;
  embeddingProviderPreview: string;
  embeddingDryRunLoading: boolean;
  embeddingDryRun: DryRunState<VectorEmbeddingDryRunResult> | null;
  embeddingDryRunError: DryRunErrorState | null;
  rerankDryRunLoading: boolean;
  rerankDryRun: DryRunState<VectorRerankDryRunResult> | null;
  rerankDryRunError: DryRunErrorState | null;
  onSave: () => void;
  onRunEmbeddingDryRun: () => void;
  onRunRerankDryRun: () => void;
};

export function PromptsVectorRagSection(props: PromptsVectorRagSectionProps) {
  const [activeTab, setActiveTab] = useState<'embedding' | 'rerank'>('embedding');

  // Destructure commonly used props
  const { vectorForm, setVectorForm, savingVector, vectorRagDirty, vectorApiKeyDirty, rerankApiKeyDirty, onSave } =
    props;

  const anyDirty = vectorRagDirty || vectorApiKeyDirty || rerankApiKeyDirty;
  const isTestDisabled = savingVector || props.embeddingDryRunLoading || props.rerankDryRunLoading || anyDirty;

  return (
    <section className="panel p-6" id="rag-config" aria-label="向量检索配置">
      {/* Header: Tab Toggle + Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Tab Toggle */}
        <div className="inline-flex rounded-atelier border border-border">
          <button
            className={`px-4 py-1.5 text-sm ui-transition-fast ${
              activeTab === 'embedding'
                ? 'bg-accent/10 text-accent font-medium'
                : 'text-subtext hover:text-ink hover:bg-canvas'
            }`}
            onClick={() => setActiveTab('embedding')}
            type="button"
          >
            Embedding
          </button>
          <button
            className={`px-4 py-1.5 text-sm ui-transition-fast ${
              activeTab === 'rerank'
                ? 'bg-accent/10 text-accent font-medium'
                : 'text-subtext hover:text-ink hover:bg-canvas'
            }`}
            onClick={() => setActiveTab('rerank')}
            type="button"
          >
            Rerank
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button className="btn btn-primary" disabled={savingVector || !anyDirty} onClick={onSave} type="button">
            保存
          </button>
          <button
            className="btn btn-secondary"
            disabled={isTestDisabled}
            onClick={activeTab === 'embedding' ? props.onRunEmbeddingDryRun : props.onRunRerankDryRun}
            type="button"
          >
            {(activeTab === 'embedding' ? props.embeddingDryRunLoading : props.rerankDryRunLoading)
              ? '测试中...'
              : '测试'}
          </button>
        </div>
      </div>

      {/* Dirty hint */}
      {anyDirty ? <div className="mt-2 text-[11px] text-warning">有未保存的更改，请先保存再测试。</div> : null}

      {/* Form Fields (different data per tab, same layout) */}
      {props.baselineSettings ? (
        <div className="mt-4 grid gap-3">
          {activeTab === 'embedding' ? (
            <>
              {/* Embedding fields */}
              <label className="grid gap-1">
                <span className="text-xs text-subtext">接口地址</span>
                <input
                  className="input"
                  value={vectorForm.vector_embedding_base_url}
                  onChange={(e) => setVectorForm((v) => ({ ...v, vector_embedding_base_url: e.target.value }))}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-subtext">API Key</span>
                <input
                  className="input"
                  type="password"
                  autoComplete="off"
                  value={props.vectorApiKeyDraft}
                  onChange={(e) => {
                    props.setVectorApiKeyDraft(e.target.value);
                    props.setVectorApiKeyClearRequested(false);
                  }}
                />
              </label>
              <button
                className="btn btn-ghost btn-sm text-subtext"
                disabled={props.savingVector}
                onClick={() => {
                  props.setVectorApiKeyDraft("");
                  props.setVectorApiKeyClearRequested(true);
                }}
                type="button"
              >
                清除 Key
              </button>
              <label className="grid gap-1">
                <span className="text-xs text-subtext">模型名称</span>
                <input
                  className="input"
                  value={vectorForm.vector_embedding_model}
                  onChange={(e) => setVectorForm((v) => ({ ...v, vector_embedding_model: e.target.value }))}
                />
              </label>
            </>
          ) : (
            <>
              {/* Rerank fields */}
              <label className="grid gap-1">
                <span className="text-xs text-subtext">接口地址</span>
                <input
                  className="input"
                  value={vectorForm.vector_rerank_base_url}
                  onChange={(e) => {
                    const next = e.target.value;
                    setVectorForm((v) => {
                      const shouldAutoSetProvider = !v.vector_rerank_provider.trim() && next.trim().length > 0;
                      return {
                        ...v,
                        vector_rerank_base_url: next,
                        ...(shouldAutoSetProvider ? { vector_rerank_provider: 'external_rerank_api' } : {}),
                      };
                    });
                  }}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-subtext">API Key</span>
                <input
                  className="input"
                  type="password"
                  autoComplete="off"
                  value={props.rerankApiKeyDraft}
                  onChange={(e) => {
                    props.setRerankApiKeyDraft(e.target.value);
                    props.setRerankApiKeyClearRequested(false);
                  }}
                />
              </label>
              <button
                className="btn btn-ghost btn-sm text-subtext"
                disabled={props.savingVector}
                onClick={() => {
                  props.setRerankApiKeyDraft("");
                  props.setRerankApiKeyClearRequested(true);
                }}
                type="button"
              >
                清除 Key
              </button>
              <label className="grid gap-1">
                <span className="text-xs text-subtext">模型名称</span>
                <input
                  className="input"
                  value={vectorForm.vector_rerank_model}
                  onChange={(e) => setVectorForm((v) => ({ ...v, vector_rerank_model: e.target.value }))}
                />
              </label>
            </>
          )}
        </div>
      ) : (
        <div className="mt-4 text-xs text-subtext">正在加载向量检索配置...</div>
      )}

      {/* Collapsible Parameters (different content per tab) */}
      {props.baselineSettings ? (
        <details className="mt-4 rounded-atelier border border-border bg-canvas p-4">
          <summary className="ui-transition-fast cursor-pointer select-none text-sm font-medium text-ink hover:text-ink">
            参数设置
          </summary>
          <div className="mt-4 grid gap-4">
            {activeTab === 'embedding' ? (
              <>
                {/* Embedding parameters */}
                <label className="grid gap-1">
                  <span className="text-xs text-subtext">Embedding 提供方（provider）</span>
                  <select
                    className="select"
                    value={vectorForm.vector_embedding_provider}
                    onChange={(e) => setVectorForm((v) => ({ ...v, vector_embedding_provider: e.target.value }))}
                  >
                    <option value="">（使用后端环境变量）</option>
                    <option value="openai_compatible">openai_compatible</option>
                    <option value="azure_openai">azure_openai</option>
                    <option value="google">google</option>
                    <option value="custom">custom</option>
                    <option value="local_proxy">local_proxy</option>
                    <option value="sentence_transformers">sentence_transformers</option>
                  </select>
                </label>

                {/* Azure-specific fields */}
                {props.embeddingProviderPreview === 'azure_openai' ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-1">
                      <span className="text-xs text-subtext">Azure 部署名</span>
                      <input
                        className="input"
                        value={vectorForm.vector_embedding_azure_deployment}
                        onChange={(e) =>
                          setVectorForm((v) => ({ ...v, vector_embedding_azure_deployment: e.target.value }))
                        }
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-xs text-subtext">Azure API 版本</span>
                      <input
                        className="input"
                        value={vectorForm.vector_embedding_azure_api_version}
                        onChange={(e) =>
                          setVectorForm((v) => ({ ...v, vector_embedding_azure_api_version: e.target.value }))
                        }
                      />
                    </label>
                  </div>
                ) : null}

                {/* SentenceTransformers field */}
                {props.embeddingProviderPreview === 'sentence_transformers' ? (
                  <label className="grid gap-1">
                    <span className="text-xs text-subtext">SentenceTransformers 模型</span>
                    <input
                      className="input"
                      value={vectorForm.vector_embedding_sentence_transformers_model}
                      onChange={(e) =>
                        setVectorForm((v) => ({
                          ...v,
                          vector_embedding_sentence_transformers_model: e.target.value,
                        }))
                      }
                    />
                  </label>
                ) : null}
              </>
            ) : (
              <>
                {/* Rerank parameters */}
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    className="checkbox"
                    checked={vectorForm.vector_rerank_enabled}
                    onChange={(e) => setVectorForm((v) => ({ ...v, vector_rerank_enabled: e.target.checked }))}
                    type="checkbox"
                  />
                  启用 rerank
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs text-subtext">重排算法（method）</span>
                    <select
                      className="select"
                      value={vectorForm.vector_rerank_method}
                      onChange={(e) => setVectorForm((v) => ({ ...v, vector_rerank_method: e.target.value }))}
                    >
                      <option value="auto">auto</option>
                      <option value="rapidfuzz_token_set_ratio">rapidfuzz_token_set_ratio</option>
                      <option value="token_overlap">token_overlap</option>
                    </select>
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs text-subtext">候选数量（top_k）</span>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={1000}
                      value={props.vectorRerankTopKDraft}
                      onBlur={() => {
                        const raw = props.vectorRerankTopKDraft.trim();
                        if (!raw) {
                          props.setVectorRerankTopKDraft(String(vectorForm.vector_rerank_top_k));
                          return;
                        }
                        const next = Math.floor(Number(raw));
                        if (!Number.isFinite(next)) {
                          props.setVectorRerankTopKDraft(String(vectorForm.vector_rerank_top_k));
                          return;
                        }
                        const clamped = Math.max(1, Math.min(1000, next));
                        setVectorForm((v) => ({ ...v, vector_rerank_top_k: clamped }));
                        props.setVectorRerankTopKDraft(String(clamped));
                      }}
                      onChange={(e) => props.setVectorRerankTopKDraft(e.target.value)}
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs text-subtext">超时时间（秒）</span>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={120}
                      value={props.vectorRerankTimeoutDraft}
                      onBlur={() => {
                        const raw = props.vectorRerankTimeoutDraft.trim();
                        if (!raw) {
                          setVectorForm((v) => ({ ...v, vector_rerank_timeout_seconds: null }));
                          props.setVectorRerankTimeoutDraft("");
                          return;
                        }
                        const next = Math.floor(Number(raw));
                        if (!Number.isFinite(next)) {
                          props.setVectorRerankTimeoutDraft(
                            vectorForm.vector_rerank_timeout_seconds != null
                              ? String(vectorForm.vector_rerank_timeout_seconds)
                              : "",
                          );
                          return;
                        }
                        const clamped = Math.max(1, Math.min(120, next));
                        setVectorForm((v) => ({ ...v, vector_rerank_timeout_seconds: clamped }));
                        props.setVectorRerankTimeoutDraft(String(clamped));
                      }}
                      onChange={(e) => props.setVectorRerankTimeoutDraft(e.target.value)}
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs text-subtext">混合权重（hybrid_alpha）</span>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={props.vectorRerankHybridAlphaDraft}
                      onBlur={() => {
                        const raw = props.vectorRerankHybridAlphaDraft.trim();
                        if (!raw) {
                          setVectorForm((v) => ({ ...v, vector_rerank_hybrid_alpha: null }));
                          props.setVectorRerankHybridAlphaDraft("");
                          return;
                        }
                        const next = Number(raw);
                        if (!Number.isFinite(next)) {
                          props.setVectorRerankHybridAlphaDraft(
                            vectorForm.vector_rerank_hybrid_alpha != null
                              ? String(vectorForm.vector_rerank_hybrid_alpha)
                              : "",
                          );
                          return;
                        }
                        const clamped = Math.max(0, Math.min(1, next));
                        setVectorForm((v) => ({ ...v, vector_rerank_hybrid_alpha: clamped }));
                        props.setVectorRerankHybridAlphaDraft(String(clamped));
                      }}
                      onChange={(e) => props.setVectorRerankHybridAlphaDraft(e.target.value)}
                    />
                  </label>
                </div>

                <label className="grid gap-1">
                  <span className="text-xs text-subtext">Rerank 提供方</span>
                  <select
                    className="select"
                    value={vectorForm.vector_rerank_provider}
                    onChange={(e) => setVectorForm((v) => ({ ...v, vector_rerank_provider: e.target.value }))}
                  >
                    <option value="">（使用后端环境变量）</option>
                    <option value="external_rerank_api">external_rerank_api</option>
                  </select>
                </label>
              </>
            )}
          </div>
        </details>
      ) : null}

      {/* Test results (compact, below params) */}
      {props.embeddingDryRunError && activeTab === 'embedding' ? (
        <div className="mt-3 rounded-atelier border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
          Embedding 测试失败：{props.embeddingDryRunError.message}
          <RequestIdBadge requestId={props.embeddingDryRunError.requestId} className="ml-2" />
        </div>
      ) : null}
      {props.embeddingDryRun && activeTab === 'embedding' ? (
        <div className="mt-3 rounded-atelier border border-success/30 bg-success/5 px-3 py-2 text-xs text-subtext">
          Embedding 测试通过：dims={props.embeddingDryRun.result.dims ?? '?'}，
          耗时={props.embeddingDryRun.result.timings_ms?.total ?? '?'}ms
        </div>
      ) : null}
      {props.rerankDryRunError && activeTab === 'rerank' ? (
        <div className="mt-3 rounded-atelier border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
          Rerank 测试失败：{props.rerankDryRunError.message}
          <RequestIdBadge requestId={props.rerankDryRunError.requestId} className="ml-2" />
        </div>
      ) : null}
      {props.rerankDryRun && activeTab === 'rerank' ? (
        <div className="mt-3 rounded-atelier border border-success/30 bg-success/5 px-3 py-2 text-xs text-subtext">
          Rerank 测试通过：method={props.rerankDryRun.result.method ?? '?'}，
          耗时={props.rerankDryRun.result.timings_ms?.total ?? '?'}ms
        </div>
      ) : null}
    </section>
  );
}
