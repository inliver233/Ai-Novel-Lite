import type { LLMProvider } from "../../../types";
import { describeModelListState, deriveLlmModuleAccessState, type LlmModuleAccessState } from "../llmConnectionState";
import type { TaskOverrideSectionProps } from "./cardTypes";

const PROVIDER_OPTIONS: Array<{ value: LLMProvider; label: string }> = [
  { value: "openai", label: "openai（官方）" },
  { value: "openai_responses", label: "openai_responses（官方 /v1/responses）" },
  { value: "openai_compatible", label: "openai_compatible（中转/本地）" },
  { value: "openai_responses_compatible", label: "openai_responses_compatible（中转 /v1/responses）" },
  { value: "anthropic", label: "anthropic（Claude）" },
  { value: "gemini", label: "gemini" },
];

function RemoteStateNotice(props: { state: LlmModuleAccessState; className?: string }) {
  const toneClass =
    props.state.tone === "success" ? "border-success/30 bg-success/10" : "border-warning/30 bg-warning/10";
  const titleClass = props.state.tone === "success" ? "text-success" : "text-warning";

  return (
    <div className={`rounded-atelier border p-3 ${toneClass}${props.className ? ` ${props.className}` : ""}`}>
      <div className={`text-xs font-medium ${titleClass}`}>{props.state.title}</div>
      <div className="mt-1 text-[11px] text-subtext">{props.state.detail}</div>
    </div>
  );
}

export function TaskOverrideSection(props: TaskOverrideSectionProps) {
  return (
    <div className="rounded-atelier border border-border/70 bg-canvas p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <div className="text-sm font-semibold text-ink">任务模块覆盖</div>
          <div className="text-xs text-subtext">
            按流程拆分模型。每个模块都可绑定独立 API 配置库，未绑定则回退项目主配置。
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="select min-w-[240px]"
            disabled={props.addableTasks.length === 0}
            value={props.selectedAddTaskKey}
            onChange={(event) => props.onSelectAddTaskKey(event.currentTarget.value)}
          >
            <option value="">选择要新增的任务模块</option>
            {props.addableTasks.map((task) => (
              <option key={task.key} value={task.key}>
                [{task.group}] {task.label}
              </option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            disabled={!props.selectedAddTaskKey}
            onClick={props.onAddTaskModule}
            type="button"
          >
            新增模块
          </button>
        </div>
      </div>

      {props.taskModules.length === 0 ? (
        <div className="mt-4 rounded-atelier border border-dashed border-border p-4 text-xs text-subtext">
          暂无任务级覆盖。当前所有流程都使用主模块。
        </div>
      ) : (
        <div className="mt-4 grid gap-4">
          {props.taskModules.map((task) => {
            const boundProfile = task.llm_profile_id
              ? (props.profiles.find((profile) => profile.id === task.llm_profile_id) ?? null)
              : null;
            const taskAccessState = deriveLlmModuleAccessState({
              scope: "task",
              moduleProvider: task.form.provider,
              selectedProfile: props.selectedProfile,
              boundProfile,
            });
            const effectiveProfile = taskAccessState.effectiveProfile;
            const taskModelListHelpText = describeModelListState(task.modelList, taskAccessState);
            const testing = Boolean(props.taskTesting[task.task_key]);
            const profileBusy = Boolean(props.taskProfileBusy[task.task_key]);
            const taskBusy = task.saving || task.deleting || profileBusy;
            const taskUiLocked = taskBusy || testing;
            const isCompatibleProvider =
              task.form.provider === "openai_compatible" || task.form.provider === "openai_responses_compatible";
            const showPenaltyInputs = task.form.provider === "openai" || task.form.provider === "openai_compatible";
            const showReasoningEffort =
              task.form.provider === "openai" ||
              task.form.provider === "openai_compatible" ||
              task.form.provider === "openai_responses" ||
              task.form.provider === "openai_responses_compatible";
            const isAnthropicProvider = task.form.provider === "anthropic";
            const isGeminiProvider = task.form.provider === "gemini";
            const draftApiKey = props.taskApiKeyDrafts[task.task_key] ?? "";
            const datalistId = `task-${task.task_key}-models`;

            return (
              <div className="rounded-atelier border border-border/70 bg-canvas p-3" key={task.task_key}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="grid gap-1">
                    <div className="text-sm font-semibold text-ink">
                      [{task.group}] {task.label}
                    </div>
                    <div className="text-xs text-subtext">{task.description}</div>
                    <div className="text-[11px] text-subtext">任务键：{task.task_key}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {task.dirty ? (
                      <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] text-warning">未保存</span>
                    ) : null}
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={task.modelList.loading || taskUiLocked || Boolean(taskAccessState.actionReason)}
                      onClick={() => props.onReloadTaskModels(task.task_key)}
                      title={taskAccessState.actionReason ?? undefined}
                      type="button"
                    >
                      {task.modelList.loading ? "拉取中…" : "拉取模型列表"}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={taskUiLocked || Boolean(taskAccessState.actionReason)}
                      onClick={() => props.onTestTaskConnection(task.task_key)}
                      title={taskAccessState.actionReason ?? undefined}
                      type="button"
                    >
                      {testing ? "测试中…" : "测试连接"}
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={!task.dirty || taskUiLocked}
                      onClick={() => props.onSaveTask(task.task_key)}
                      type="button"
                    >
                      {task.saving ? "保存中..." : "保存模块"}
                    </button>
                    <button
                      className="btn btn-ghost btn-sm text-accent hover:bg-accent/10"
                      disabled={taskUiLocked}
                      onClick={() => props.onDeleteTask(task.task_key)}
                      type="button"
                    >
                      {task.deleting ? "删除中..." : "删除模块"}
                    </button>
                  </div>
                </div>

                <RemoteStateNotice className="mt-3" state={taskAccessState} />

                <div className="mt-3 grid gap-1">
                  <span className="text-xs text-subtext">任务模块绑定的 API 配置库</span>
                  <select
                    className="select"
                    disabled={taskUiLocked}
                    value={task.llm_profile_id ?? ""}
                    onChange={(event) => props.onTaskProfileChange(task.task_key, event.currentTarget.value || null)}
                  >
                    <option value="">（回退主配置）</option>
                    {props.profiles.map((profile) => (
                      <option key={`${task.task_key}-${profile.id}`} value={profile.id}>
                        {profile.name} · {profile.provider}/{profile.model}
                      </option>
                    ))}
                  </select>
                  <div className="text-[11px] text-subtext">
                    选择后该任务优先使用该配置库的 API Key。留空表示继承项目主配置绑定的 API Key。
                  </div>
                  {effectiveProfile ? (
                    <>
                      <div className="text-[11px] text-subtext">
                        当前生效配置：{effectiveProfile.name}（{effectiveProfile.provider}/{effectiveProfile.model}）
                        {!boundProfile ? "，来源：主配置回退" : "，来源：任务绑定配置"}
                        {effectiveProfile.has_api_key
                          ? `，已保存 Key：${effectiveProfile.masked_api_key ?? "（已保存）"}`
                          : "，尚未保存 Key"}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <input
                          className="input flex-1 min-w-[220px]"
                          disabled={taskUiLocked}
                          placeholder={
                            boundProfile
                              ? "输入该任务绑定配置库的新 Key（共享给复用该配置库的模块）"
                              : "输入主配置的新 Key（将影响回退到主配置的任务）"
                          }
                          type="password"
                          value={draftApiKey}
                          onChange={(event) => props.onTaskApiKeyDraftChange(task.task_key, event.currentTarget.value)}
                        />
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={taskUiLocked || !draftApiKey.trim()}
                          onClick={() => props.onSaveTaskApiKey(task.task_key)}
                          type="button"
                        >
                          保存 Key
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={taskUiLocked || !effectiveProfile.has_api_key}
                          onClick={() => props.onClearTaskApiKey(task.task_key)}
                          type="button"
                        >
                          清除 Key
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-[11px] text-subtext">
                      当前未绑定任务配置且项目主配置为空，请先绑定配置库或设置主配置。
                    </div>
                  )}
                </div>

                <div className="mt-3 grid gap-3">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
                    <label className="grid gap-1 xl:col-span-1">
                      <span className="text-xs text-subtext">服务商（provider）</span>
                      <select
                        className="select"
                        disabled={taskUiLocked}
                        value={task.form.provider}
                        onChange={(event) => {
                          const provider = event.currentTarget.value as LLMProvider;
                          props.onTaskFormChange(task.task_key, (previous) => ({
                            ...previous,
                            provider: provider,
                            max_tokens: "",
                            text_verbosity: "",
                            reasoning_effort: "",
                            anthropic_thinking_enabled: false,
                            anthropic_thinking_budget_tokens: "",
                            gemini_thinking_budget: "",
                            gemini_include_thoughts: false,
                          }));
                        }}
                      >
                        {PROVIDER_OPTIONS.map((option) => (
                          <option key={`${task.task_key}-${option.value}`} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-1 xl:col-span-1">
                      <span className="text-xs text-subtext">模型（model）</span>
                      <input
                        className="input"
                        disabled={taskUiLocked}
                        list={datalistId}
                        value={task.form.model}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          props.onTaskFormChange(task.task_key, (previous) => ({
                            ...previous,
                            model: value,
                          }));
                        }}
                      />
                      <datalist id={datalistId}>
                        {task.modelList.options.map((option) => (
                          <option key={`${task.task_key}-${option.id}`} value={option.id}>
                            {option.display_name}
                          </option>
                        ))}
                      </datalist>
                      <div className="text-[11px] text-subtext">{taskModelListHelpText}</div>
                    </label>

                    <label className="grid gap-1 md:col-span-2 xl:col-span-2">
                      <span className="text-xs text-subtext">接口地址（base_url）</span>
                      <input
                        className="input"
                        disabled={taskUiLocked}
                        placeholder={isCompatibleProvider ? "https://your-gateway.example.com/v1" : undefined}
                        value={task.form.base_url}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          props.onTaskFormChange(task.task_key, (previous) => ({
                            ...previous,
                            base_url: value,
                          }));
                        }}
                      />
                    </label>

                    <label className="grid gap-1 xl:col-span-1">
                      <span className="text-xs text-subtext">temperature</span>
                      <input
                        className="input"
                        disabled={taskUiLocked}
                        type="text"
                        value={task.form.temperature}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          props.onTaskFormChange(task.task_key, (previous) => ({
                            ...previous,
                            temperature: value,
                          }));
                        }}
                      />
                    </label>

                    <label className="grid gap-1 xl:col-span-2">
                      <span className="text-xs text-subtext">max_tokens / max_output_tokens</span>
                      <input
                        className="input"
                        disabled={taskUiLocked}
                        type="text"
                        value={task.form.max_tokens}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          props.onTaskFormChange(task.task_key, (previous) => ({
                            ...previous,
                            max_tokens: value,
                          }));
                        }}
                      />
                    </label>

                    <label className="grid gap-1 xl:col-span-1">
                      <span className="text-xs text-subtext">timeout_seconds</span>
                      <input
                        className="input"
                        disabled={taskUiLocked}
                        type="text"
                        value={task.form.timeout_seconds}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          props.onTaskFormChange(task.task_key, (previous) => ({
                            ...previous,
                            timeout_seconds: value,
                          }));
                        }}
                      />
                    </label>
                  </div>

                  <details className="rounded-atelier border border-border/60 bg-canvas/40 p-3">
                    <summary className="ui-transition-fast cursor-pointer select-none text-xs text-subtext hover:text-ink">
                      更多参数
                    </summary>
                    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <label className="grid gap-1">
                        <span className="text-xs text-subtext">top_p</span>
                        <input
                          className="input"
                          disabled={taskUiLocked}
                          type="text"
                          value={task.form.top_p}
                          onChange={(event) => {
                            const value = event.currentTarget.value;
                            props.onTaskFormChange(task.task_key, (previous) => ({
                              ...previous,
                              top_p: value,
                            }));
                          }}
                        />
                      </label>

                      {showPenaltyInputs ? (
                        <>
                          <label className="grid gap-1">
                            <span className="text-xs text-subtext">presence_penalty</span>
                            <input
                              className="input"
                              disabled={taskUiLocked}
                              type="text"
                              value={task.form.presence_penalty}
                              onChange={(event) => {
                                const value = event.currentTarget.value;
                                props.onTaskFormChange(task.task_key, (previous) => ({
                                  ...previous,
                                  presence_penalty: value,
                                }));
                              }}
                            />
                          </label>

                          <label className="grid gap-1">
                            <span className="text-xs text-subtext">frequency_penalty</span>
                            <input
                              className="input"
                              disabled={taskUiLocked}
                              type="text"
                              value={task.form.frequency_penalty}
                              onChange={(event) => {
                                const value = event.currentTarget.value;
                                props.onTaskFormChange(task.task_key, (previous) => ({
                                  ...previous,
                                  frequency_penalty: value,
                                }));
                              }}
                            />
                          </label>
                        </>
                      ) : (
                        <label className="grid gap-1">
                          <span className="text-xs text-subtext">top_k</span>
                          <input
                            className="input"
                            disabled={taskUiLocked}
                            type="text"
                            value={task.form.top_k}
                            onChange={(event) => {
                              const value = event.currentTarget.value;
                              props.onTaskFormChange(task.task_key, (previous) => ({
                                ...previous,
                                top_k: value,
                              }));
                            }}
                          />
                        </label>
                      )}

                      <label className="grid gap-1">
                        <span className="text-xs text-subtext">stop（逗号分隔）</span>
                        <input
                          className="input"
                          disabled={taskUiLocked}
                          value={task.form.stop}
                          onChange={(event) => {
                            const value = event.currentTarget.value;
                            props.onTaskFormChange(task.task_key, (previous) => ({
                              ...previous,
                              stop: value,
                            }));
                          }}
                        />
                      </label>

                      {showReasoningEffort ? (
                        <label className="grid gap-1">
                          <span className="text-xs text-subtext">reasoning_effort</span>
                          <select
                            className="select"
                            disabled={taskUiLocked}
                            value={task.form.reasoning_effort}
                            onChange={(event) => {
                              const value = event.currentTarget.value;
                              props.onTaskFormChange(task.task_key, (previous) => ({
                                ...previous,
                                reasoning_effort: value,
                              }));
                            }}
                          >
                            <option value="">默认</option>
                            <option value="minimal">minimal</option>
                            <option value="low">low</option>
                            <option value="medium">medium</option>
                            <option value="high">high</option>
                          </select>
                        </label>
                      ) : null}

                      {isAnthropicProvider ? (
                        <>
                          <label className="flex items-center gap-2 md:col-span-2 xl:col-span-1">
                            <input
                              checked={task.form.anthropic_thinking_enabled}
                              disabled={taskUiLocked}
                              type="checkbox"
                              onChange={(event) => {
                                const checked = event.currentTarget.checked;
                                props.onTaskFormChange(task.task_key, (previous) => ({
                                  ...previous,
                                  anthropic_thinking_enabled: checked,
                                }));
                              }}
                            />
                            <span className="text-sm text-ink">启用 thinking</span>
                          </label>

                          <label className="grid gap-1">
                            <span className="text-xs text-subtext">thinking.budget_tokens</span>
                            <input
                              className="input"
                              disabled={taskUiLocked || !task.form.anthropic_thinking_enabled}
                              type="text"
                              value={task.form.anthropic_thinking_budget_tokens}
                              onChange={(event) => {
                                const value = event.currentTarget.value;
                                props.onTaskFormChange(task.task_key, (previous) => ({
                                  ...previous,
                                  anthropic_thinking_budget_tokens: value,
                                }));
                              }}
                            />
                            {!task.form.anthropic_thinking_enabled ? (
                              <div className="text-[11px] text-subtext">启用后可设置思考预算</div>
                            ) : null}
                          </label>
                        </>
                      ) : null}

                      {isGeminiProvider ? (
                        <>
                          <label className="grid gap-1">
                            <span className="text-xs text-subtext">thinkingConfig.thinkingBudget</span>
                            <input
                              className="input"
                              disabled={taskUiLocked}
                              type="text"
                              value={task.form.gemini_thinking_budget}
                              onChange={(event) => {
                                const value = event.currentTarget.value;
                                props.onTaskFormChange(task.task_key, (previous) => ({
                                  ...previous,
                                  gemini_thinking_budget: value,
                                }));
                              }}
                            />
                          </label>

                          <label className="flex items-center gap-2 md:col-span-2 xl:col-span-1">
                            <input
                              checked={task.form.gemini_include_thoughts}
                              disabled={taskUiLocked}
                              type="checkbox"
                              onChange={(event) => {
                                const checked = event.currentTarget.checked;
                                props.onTaskFormChange(task.task_key, (previous) => ({
                                  ...previous,
                                  gemini_include_thoughts: checked,
                                }));
                              }}
                            />
                            <span className="text-sm text-ink">thinkingConfig.includeThoughts</span>
                          </label>
                        </>
                      ) : null}

                      <label className="grid gap-1 md:col-span-2 xl:col-span-3">
                        <span className="text-xs text-subtext">extra（JSON，高级扩展）</span>
                        <textarea
                          className="textarea atelier-mono"
                          disabled={taskUiLocked}
                          rows={3}
                          value={task.form.extra}
                          onChange={(event) => {
                            const value = event.currentTarget.value;
                            props.onTaskFormChange(task.task_key, (previous) => ({
                              ...previous,
                              extra: value,
                            }));
                          }}
                        />
                        <div className="text-[11px] text-subtext">
                          保留少量 JSON 扩展参数；优先使用上面的结构化控件。
                        </div>
                      </label>
                    </div>
                  </details>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
