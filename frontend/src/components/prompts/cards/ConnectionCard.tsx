import type { ConnectionCardProps } from "./cardTypes";

type AccessStatusMeta = {
  label: string;
  badgeClassName: string;
  detail: string;
};

function getAccessStatusMeta(props: ConnectionCardProps): AccessStatusMeta {
  if (props.mainAccessState.stage === "ready") {
    return {
      label: "ready",
      badgeClassName: "bg-success/10 text-success",
      detail: props.mainAccessState.detail,
    };
  }

  if (props.mainAccessState.stage === "missing_key") {
    return {
      label: "missing_key",
      badgeClassName: "bg-warning/10 text-warning",
      detail: props.mainAccessState.detail,
    };
  }

  if (props.mainAccessState.stage === "missing_profile") {
    return {
      label: "missing_profile",
      badgeClassName: "border border-border/60 bg-canvas text-subtext",
      detail: props.mainAccessState.detail,
    };
  }

  return {
    label: props.mainAccessState.stage,
    badgeClassName: "bg-warning/10 text-warning",
    detail: props.mainAccessState.detail,
  };
}

export function ConnectionCard(props: ConnectionCardProps) {
  const accessStatus = getAccessStatusMeta(props);

  return (
    <section className="surface rounded-atelier border border-border p-4" aria-label="连接配置">
      <div className="grid gap-1">
        <div className="text-base font-semibold text-ink">连接配置</div>
        <div className="text-xs text-subtext">管理 API 配置库与密钥</div>
      </div>

      <div className="mt-4 grid gap-4">
        <div className="rounded-atelier border border-border/60 bg-canvas p-4">
          <div className="text-sm font-medium text-ink">配置快速切换</div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 sm:col-span-2">
              <span className="text-xs text-subtext">选择现有配置</span>
              <select
                className="select"
                disabled={props.profileBusy}
                name="profile_select"
                value={props.selectedProfileId ?? ""}
                onChange={(event) => props.onSelectProfile(event.currentTarget.value || null)}
              >
                <option value="">（未绑定后端配置）</option>
                {props.profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} · {profile.provider}/{profile.model}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-subtext">新建配置名</span>
              <input
                className="input"
                disabled={props.profileBusy}
                name="profile_name"
                placeholder="例如：主网关"
                value={props.profileName}
                onChange={(event) => props.onChangeProfileName(event.currentTarget.value)}
              />
            </label>
          </div>

          {props.selectedProfile ? (
            <div className="mt-3 grid gap-1 text-xs text-subtext">
              <div>
                <span className="text-ink">名称：</span>
                {props.selectedProfile.name}
              </div>
              <div>
                <span className="text-ink">Provider：</span>
                {props.selectedProfile.provider}
              </div>
              <div>
                <span className="text-ink">Model：</span>
                {props.selectedProfile.model}
              </div>
              <div>
                <span className="text-ink">API Key：</span>
                {props.selectedProfile.masked_api_key ?? (props.selectedProfile.has_api_key ? "（已保存）" : "未保存")}
              </div>
            </div>
          ) : (
            <div className="mt-3 text-xs text-subtext">当前未绑定 profile。请先选择或新建配置，再保存 API Key。</div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="btn btn-secondary px-3 py-2 text-xs"
              disabled={props.profileBusy}
              onClick={props.onCreateProfile}
              type="button"
            >
              保存为新配置
            </button>
            <button
              className="btn btn-secondary px-3 py-2 text-xs"
              disabled={props.profileBusy || !props.selectedProfileId}
              onClick={props.onUpdateProfile}
              type="button"
            >
              更新当前配置
            </button>
            <button
              className="btn btn-ghost px-3 py-2 text-xs text-accent hover:bg-accent/10"
              disabled={props.profileBusy || !props.selectedProfileId}
              onClick={props.onDeleteProfile}
              type="button"
            >
              删除当前配置
            </button>
          </div>
        </div>

        <div className="rounded-atelier border border-border/60 bg-canvas p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid gap-1">
              <div className="text-sm font-medium text-ink">API Key 管理</div>
              <div className="text-xs text-subtext">后端加密保存，仅展示脱敏状态。</div>
            </div>
            <span
              className={`inline-flex items-center rounded-atelier px-2 py-0.5 text-[11px] ${accessStatus.badgeClassName}`}
            >
              {accessStatus.label}
            </span>
          </div>

          <div className="mt-2 text-xs text-subtext">{accessStatus.detail}</div>

          <div className="mt-3 flex flex-wrap gap-2">
            <input
              className="input min-w-0 flex-1"
              name="api_key"
              placeholder="输入新 Key（不会回显已保存 Key）"
              type="password"
              value={props.apiKey}
              onChange={(event) => props.onChangeApiKey(event.currentTarget.value)}
            />
            <button
              className="btn btn-primary px-3 py-2 text-xs"
              disabled={!props.selectedProfileId || props.profileBusy || !props.apiKey.trim()}
              onClick={props.onSaveApiKey}
              type="button"
            >
              保存 Key
            </button>
            <button
              className="btn btn-secondary px-3 py-2 text-xs"
              disabled={!props.selectedProfileId || props.profileBusy || !props.selectedProfile?.has_api_key}
              onClick={props.onClearApiKey}
              type="button"
            >
              清除 Key
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
