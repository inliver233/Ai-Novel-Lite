## Task: DETAILED-016b — Fix "共0卷" display issue in detailed outline generation progress

### Problem
The frontend shows "正在生成第1卷/共0卷" because the `volume_start` SSE event doesn't include a `total` field. The frontend reads `obj.total` which is always 0. The `total_volumes` count is only sent in the initial `start` event.

### Fix: Two approaches (do BOTH)

#### Backend: Include total_volumes in volume_start events
In `backend/app/services/detailed_outline_generation/app_service.py`, add `"total_volumes": total_volumes` to all `volume_start` yield statements. There are 3 places:

1. In the volumes fast-path (around line 390-394):
```python
                    yield {
                        "type": "volume_start",
                        "volume_number": vol_number,
                        "volume_title": vol_title,
                        "total_volumes": total_volumes,
                    }
```

2. In the chapters path (around line 441-445):
```python
            yield {
                "type": "volume_start",
                "volume_number": vol.number,
                "volume_title": vol.title,
                "total_volumes": total_volumes,
            }
```

3. In the LLM generation path (around line 530-534):
```python
        yield {
            "type": "volume_start",
            "volume_number": vol.number,
            "volume_title": vol.title,
            "total_volumes": total_volumes,
        }
```

Also add `"total_volumes": total_volumes` to all `volume_complete` yield statements in all 3 paths. (Search for `"type": "volume_complete"` in the function.)

#### Frontend: Read total_volumes from volume_start events
In `frontend/src/pages/outline/useDetailedOutlineState.ts`, change:

Line 150-169 — the `onCustomEvent` handler. Update the `volume_start` handler to read `total_volumes`:

Change line 155 from:
```typescript
              const total = typeof obj?.total === "number" ? obj.total : 0;
```
to:
```typescript
              const total = typeof obj?.total_volumes === "number" ? obj.total_volumes : (typeof obj?.total === "number" ? obj.total : 0);
```

Also change line 163 the same way:
```typescript
              const total = typeof obj?.total_volumes === "number" ? obj.total_volumes : (typeof obj?.total === "number" ? obj.total : 0);
```

Additionally, handle the `start` event to capture total_volumes early. Add before the `volume_start` handler (before line 152):
```typescript
            if (eventName === "start") {
              const total = typeof obj?.total_volumes === "number" ? obj.total_volumes : 0;
              setProgress((prev) => ({ current: prev?.current ?? 0, total, message: prev?.message ?? "..." }));
            } else if (eventName === "volume_start") {
```

(Change the existing `if (eventName === "volume_start")` to `} else if (eventName === "volume_start")`)

### Constraints
- Only modify these 2 files
- Keep backward compatibility (check both total_volumes and total)
