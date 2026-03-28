# Service layer conventions (`app.services`)

This document defines the conventions for code under `app/services/` after the RF-010/011/012/013/022 service splits/consolidations.

---

## 1) Package organization pattern (flat files vs subdirectory packages)

### Use **flat files** when

Use a single module (e.g. `app/services/auth_service.py`) when the service:

- is **< ~500 LOC** (rule-of-thumb)
- does **not** need internal modules that cross-import each other
- has a small, cohesive public API surface

**Example (flat):**

- `app/services/auth_service.py`

### Use **subdirectory packages** when

Use a package directory (e.g. `app/services/outline_generation/`) when:

- the service group has **3+ files** that share types/helpers/imports
- you need shared `models.py`/`types.py` to avoid circular imports
- the service is expected to grow and should be split into focused modules

**Examples (packages):**

- `app/services/outline_generation/`
- `app/services/chapter_generation/`

**Recommended package shape (example):**

```text
app/services/<service_name>/
  __init__.py           # optional: re-exports only (keep it light)
  models.py             # shared types / schemas (dependency-light)
  app_service.py        # top-level orchestration entrypoints
  <topic>_service.py    # focused sub-services
```

---

## 2) Re-export hub pattern (for backward compatibility)

When splitting a large file that many callers import from, keep the old import path stable by turning the original module into a **thin re-export hub**.

**Existing hub examples:**

- `app/services/vector_rag_service.py` (hub over `vector_*` modules)
- `app/services/prompt_presets.py` (hub over `prompt_preset_*` modules)

### When to use

- You are splitting a large file for maintainability, **and**
- changing all import sites would cause churn / risk, **or** external code imports it.

### Structure

- Hub module contains a short docstring describing the split.
- Hub imports symbols from the new sub-modules/packages.
- Hub re-exports via an explicit `__all__` list to define the “stable surface”.

**Minimal pattern:**

```python
"""Thin re-export hub for <domain>.

Keep importing from `app.services.<old_module>` to avoid churn in callers.
"""

from app.services.<new_module_or_package> import Foo, bar

__all__ = ["Foo", "bar"]
```

**Guidelines**

- Keep the hub **as thin as possible** (constants/simple helpers are OK; avoid heavy business logic).
- Avoid adding new import-time side effects (network calls, DB access, etc.).
- Update `__all__` whenever the public API changes.

---

## 3) Import conventions

### Cross-service imports

Always use **absolute imports**:

- ✅ `from app.services.vector_rag_service import query_project`
- ✅ `from app.services.auth_service import require_user`
- ❌ relative imports that reach across services

### Intra-package imports (inside `app/services/<package>/`)

Use **absolute imports for clarity** (easier grepping + fewer surprises):

- ✅ `from app.services.outline_generation.models import OutlineGenerationRequest`
- ✅ `from app.services.chapter_generation.app_service import generate_chapters`
- ❌ `from .models import OutlineGenerationRequest`

### Avoiding circular imports

- Put shared types in dedicated modules (typically `models.py` / `types.py`).
- Keep type modules dependency-light: **types import services is forbidden** (services may import types).
- If two modules need to reference each other, extract the shared types into `models.py` and have both import from there.

---

## 4) DB session patterns

### Route handlers

FastAPI route handlers should receive the DB session via dependency injection:

```python
from app.api.deps import DbDep

def handler(db: DbDep, ...):
    ...
```

### Background workers / scripts

Background work should create and manage its own session:

```python
from app.db.session import SessionLocal

def run_job(...):
    with SessionLocal() as db:
        ...
```

### Rules (non-negotiable)

- **Never mix** both patterns in the same function (no `DbDep` + `SessionLocal()` in one function).
- Keep sessions short-lived; avoid holding a DB transaction while doing long-running work (e.g., LLM calls).

