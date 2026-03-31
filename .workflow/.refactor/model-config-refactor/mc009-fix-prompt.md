## Task: MC-009 - Fix Critical Issues Found in Code Review

Read and fix these files based on code review findings.

### Fix 1: LlmPresetPanel.tsx - Wire API Key save + Profile create fix

Read `frontend/src/components/prompts/LlmPresetPanel.tsx`

Changes needed:

**A) Add aria-label to the profile select (around the config quick-switch section):**
Add `aria-label="配置快速切换"` to the profile `<select>` element.

**B) Wire API Key save: Add save/clear Key buttons after the API Key input.**
After the API Key `<label>` block (the one with type="password"), add a small button row:

```jsx
{/* API Key actions */}
<div className="flex items-center gap-2">
  <button
    className="btn btn-secondary btn-sm"
    disabled={props.profileBusy || !props.selectedProfileId || !props.apiKey.trim()}
    onClick={props.onSaveApiKey}
    type="button"
  >
    保存 Key
  </button>
  <button
    className="btn btn-ghost btn-sm text-subtext"
    disabled={props.profileBusy || !props.selectedProfileId}
    onClick={props.onClearApiKey}
    type="button"
  >
    清除 Key
  </button>
</div>
```

This should go inside the `<div className="mt-4 grid gap-3">` containing the form fields, right after the API Key label.

**C) Fix "新建配置" button: use profile name input inline.**
Currently the "新建配置" button calls `props.onCreateProfile` which needs `profileName` to be set.

Add a small inline input next to the "新建配置" button. Replace just the 新建配置 button with this:

```jsx
<div className="flex items-center gap-1">
  <input
    className="input w-32 text-sm"
    disabled={props.profileBusy}
    placeholder="配置名"
    value={props.profileName}
    onChange={(e) => props.onChangeProfileName(e.currentTarget.value)}
  />
  <button
    className="btn btn-secondary"
    disabled={props.profileBusy || !props.profileName.trim()}
    onClick={props.onCreateProfile}
    type="button"
  >
    新建
  </button>
</div>
```

**D) Add aria-label to the main section:**
Change `<section className="panel p-6">` to `<section className="panel p-6" aria-label="主模型配置">`

**E) Remove leftover comment:**
Remove the lines that say:
```
// Keep EXACT same type definitions as current file (lines 16-74)
// Copy TaskModuleView and Props types verbatim from the current file
```

### Fix 2: PromptsVectorRagSection.tsx - Add clear key buttons + accessibility

Read `frontend/src/pages/prompts/PromptsVectorRagSection.tsx`

Changes needed:

**A) Add aria-label to the section:**
Change `<section className="panel p-6" id="rag-config">` to `<section className="panel p-6" id="rag-config" aria-label="向量检索配置">`

**B) Add clear key buttons after each API Key input:**

For the Embedding tab, after the API Key label (the one using `props.vectorApiKeyDraft`), add:
```jsx
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
```

For the Rerank tab, after the API Key label (the one using `props.rerankApiKeyDraft`), add:
```jsx
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
```

Place these buttons right after each API Key `<label>` block, within the same parent grid.

**C) Remove leftover comment:**
Remove the line that says:
```
// Keep exact same types as current file (lines 10-53)
```

### Fix 3: cardTypes.ts - Fix React.Dispatch

Read `frontend/src/components/prompts/cards/cardTypes.ts`

In the `RagConfigBlockProps` type, replace all `React.Dispatch<React.SetStateAction<...>>` with `Dispatch<SetStateAction<...>>` (using the already-imported types from line 1).

### VERIFICATION
After all fixes, run:
```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```
