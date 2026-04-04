Fix the LLM_UPSTREAM_ERROR in detailed outline generation.

File: backend/app/services/detailed_outline_generation/app_service.py

## Problem
The `generate_detailed_outline_for_volume` function calls `call_llm_and_record` with `prompt_messages` containing 7 system + 1 user individual ChatMessage objects. This causes LLM_UPSTREAM_ERROR (output_chars=0) because:
1. Some LLM providers don't handle 7 consecutive system messages correctly
2. No max_tokens safety adjustment (unlike outline_generate which adjusts max_tokens)
3. Large prompt (full outline + characters + world setting) combined with default max_tokens can exceed context window

## Changes Required

### 1. Update imports (around lines 19-22)

Change line 19 from:
```python
from app.services.generation_service import PreparedLlmCall, call_llm_and_record
```
to:
```python
from app.services.generation_service import PreparedLlmCall, call_llm_and_record, with_param_overrides
```

Add these new imports after the existing imports (after line 22):
```python
from app.llm.capabilities import max_context_tokens_limit
from app.services.prompt_budget import estimate_tokens
```

### 2. Add validation + max_tokens safety between step 2 and step 3

After the line `prompt_render_log_json = json.dumps(render_log, ensure_ascii=False)` (around line 249) and BEFORE the `# 3 -- call LLM` comment, insert this block:

```python
    # 2.5 -- validate prompt + adjust max_tokens for context safety
    if not prompt_system.strip() and not prompt_user.strip():
        raise AppError(
            code="DETAILED_OUTLINE_EMPTY_PROMPT",
            message="细纲 prompt 渲染为空，请检查 Prompt 预设配置",
            status_code=500,
        )
    prompt_tokens = estimate_tokens(prompt_system) + estimate_tokens(prompt_user)
    ctx_limit = max_context_tokens_limit(llm_config.provider, llm_config.model)
    current_max_tokens = llm_config.params.get("max_tokens")
    if isinstance(ctx_limit, int) and ctx_limit > 0:
        safe_max = max(4096, ctx_limit - prompt_tokens - 512)
        if current_max_tokens is None or (isinstance(current_max_tokens, int) and current_max_tokens > safe_max):
            llm_config = with_param_overrides(llm_config, {"max_tokens": safe_max})
            logger.info(
                "detailed_outline_max_tokens_adjusted prompt_tokens=%d ctx_limit=%d safe_max=%d original=%s",
                prompt_tokens, ctx_limit, safe_max, current_max_tokens,
            )
    elif current_max_tokens is None:
        llm_config = with_param_overrides(llm_config, {"max_tokens": 8192})
```

### 3. Fix the call_llm_and_record call

In the `call_llm_and_record` call (step 3), REMOVE the line:
```python
        prompt_messages=prompt_messages,
```

This forces `call_llm_and_record` to use `call_llm(system=prompt_system, user=prompt_user)` which creates a standard 2-message format (1 merged system + 1 user). The `prompt_system` and `prompt_user` from `render_preset_for_task` already contain properly merged content.

The call should look like:
```python
    llm_result = call_llm_and_record(
        logger=logger,
        request_id=request_id,
        actor_user_id=user_id,
        project_id=project.id,
        chapter_id=None,
        run_type="detailed_outline_generate",
        api_key=api_key,
        prompt_system=prompt_system,
        prompt_user=prompt_user,
        prompt_render_log_json=prompt_render_log_json,
        llm_call=llm_config,
    )
```

## After making changes
Run: `cd backend && python -m compileall -q app/` to verify no syntax errors.
