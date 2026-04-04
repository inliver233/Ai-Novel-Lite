## Task: DETAILED-011 — Fix _volumes_from_structure() missing summary field

### Context
File: backend/app/services/detailed_outline_generation/app_service.py

The function `_volumes_from_structure()` at line 122-154 builds VolumeInfo objects from `structure_json["volumes"]` array. The new outline generation format (v4) stores volume content in a `summary` field, but line 131 doesn't check for it:

```python
beats_raw = vol.get("beats") or vol.get("content") or vol.get("beats_text") or ""
```

This means when volumes have the format `{number, title, summary}`, the `beats_text` will always be empty string.

### Required Change
In file `backend/app/services/detailed_outline_generation/app_service.py`, change line 131 from:
```python
        beats_raw = vol.get("beats") or vol.get("content") or vol.get("beats_text") or ""
```
to:
```python
        beats_raw = vol.get("summary") or vol.get("beats") or vol.get("content") or vol.get("beats_text") or ""
```

Put `summary` FIRST because it's the primary field in the new volumes format. The others are fallbacks for backward compatibility.

### Constraints
- Only change this ONE line (line 131)
- Do NOT change any other code
- Do NOT add comments or docstrings
- Preserve exact indentation (8 spaces)
