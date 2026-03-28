from __future__ import annotations

import ast
import json
from pathlib import Path
import sys


BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))


def _const_str(node: ast.AST | None) -> str | None:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return None


def _kw_str(call: ast.Call, *, name: str) -> str | None:
    for kw in call.keywords:
        if kw.arg == name:
            return _const_str(kw.value)
    return None


def _extract_migration_table_mentions(path: Path) -> set[str]:
    """
    Best-effort static scan of Alembic revisions to find table names that are
    mentioned in operations (e.g. op.create_table / op.rename_table).

    This is NOT a DB-backed migration check. It's only used to detect obvious
    "model table exists but no migration ever created it" situations.
    """

    try:
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    except Exception:
        return set()

    tables: set[str] = set()
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        if not isinstance(func, ast.Attribute):
            continue

        if func.attr == "create_table":
            name = _const_str(node.args[0]) if node.args else None
            name = name or _kw_str(node, name="table_name") or _kw_str(node, name="name")
            if name:
                tables.add(name)
            continue

        if func.attr == "rename_table":
            new_name = _const_str(node.args[1]) if len(node.args) >= 2 else None
            new_name = new_name or _kw_str(node, name="new_table_name") or _kw_str(node, name="new_name")
            if new_name:
                tables.add(new_name)
            continue

    return tables


def _load_migration_tables() -> set[str]:
    versions_dir = BASE_DIR / "alembic" / "versions"
    if not versions_dir.exists():
        return set()
    tables: set[str] = set()
    for p in sorted(versions_dir.glob("*.py")):
        if p.name.startswith("_"):
            continue
        tables |= _extract_migration_table_mentions(p)
    return tables


def main() -> int:
    # Import all models (app/models/__init__.py imports each model module).
    import app.models  # noqa: F401
    from app.db.base import Base

    migration_tables = _load_migration_tables()
    model_tables = set(Base.metadata.tables.keys())

    mapped_models = list(Base.registry.mappers)
    missing_tables = sorted(model_tables - migration_tables)

    print("[alembic-check] models_import=ok")
    print(f"[alembic-check] total_models={len(mapped_models)}")
    print(f"[alembic-check] total_tables={len(model_tables)}")
    print(f"[alembic-check] migration_tables_mentioned={len(migration_tables)}")
    print(f"[alembic-check] missing_tables={len(missing_tables)}")

    if missing_tables:
        print("[alembic-check] missing_tables_list=" + json.dumps(missing_tables, ensure_ascii=False))
        return 2

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

