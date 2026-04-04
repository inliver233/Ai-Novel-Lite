# Codex Task: OPA-003 ~ OPA-007 — Agents + Orchestrator + Prompts

## EXISTING CODE TO READ FIRST
- backend/app/services/outline_parsing_agent/agents/base.py — BaseExtractionAgent (already created)
- backend/app/services/outline_parsing_agent/models.py — ParseResult, ParsedOutline, ParsedCharacter, ParsedEntry, AgentStepResult, ChunkInfo
- backend/app/services/outline_parsing_agent/config.py — AgentPipelineConfig
- backend/app/services/outline_parsing_agent/chunker.py — TextChunker
- backend/app/services/outline_parsing_agent/coordinator.py — STUB (replace with full implementation)
- backend/app/llm/strategy.py — LLMStrategy Protocol
- backend/app/services/llm_task_preset_resolver.py — resolve_llm_task_preset()
- backend/app/services/generation_service.py — call_llm_and_record pattern

## FILES TO CREATE / MODIFY

### 1. backend/app/services/outline_parsing_agent/agents/analysis_agent.py

Create AnalysisAgent that extends BaseExtractionAgent:
- agent_name = "analysis"
- system_prompt_file = "analysis_system.md"
- user_prompt_file = "analysis_user.md"
- parse_response: extract {content_types: list[str], has_chapters: bool, has_characters: bool, has_entries: bool, estimated_chapter_count: int, format_description: str}
- merge_results: combine findings from multiple chunks (union of content_types, max of chapter counts)

### 2. backend/app/services/outline_parsing_agent/agents/structure_agent.py

Create StructureExtractionAgent that extends BaseExtractionAgent:
- agent_name = "structure"
- system_prompt_file = "structure_system.md"
- user_prompt_file = "structure_user.md"
- parse_response: extract {outline_md: str, chapters: [{number: int, title: str, beats: [str]}]}
- merge_results: CRITICAL — merge chapters from multiple chunks:
  - Accumulate all chapters across chunks
  - Deduplicate by chapter number (keep the one with more beats)
  - Sort by chapter number
  - Concatenate outline_md sections with "\n\n---\n\n" separator

### 3. backend/app/services/outline_parsing_agent/agents/character_agent.py

Create CharacterExtractionAgent that extends BaseExtractionAgent:
- agent_name = "character"
- system_prompt_file = "character_system.md"
- user_prompt_file = "character_user.md"
- parse_response: extract {characters: [{name: str, role: str|None, profile: str|None, notes: str|None}]}
- merge_results: merge characters from multiple chunks:
  - Deduplicate by name (case-insensitive)
  - Merge profiles (concatenate with newline)
  - Keep the longest role description

### 4. backend/app/services/outline_parsing_agent/agents/entry_agent.py

Create EntryExtractionAgent that extends BaseExtractionAgent:
- agent_name = "entry"
- system_prompt_file = "entry_system.md"
- user_prompt_file = "entry_user.md"
- parse_response: extract {entries: [{title: str, content: str, tags: [str]}]}
- merge_results: merge entries from multiple chunks:
  - Deduplicate by title (case-insensitive)
  - Merge content (concatenate with newline)
  - Union tags

### 5. backend/app/services/outline_parsing_agent/agents/validation_agent.py

Create ValidationAgent (NOT extending BaseExtractionAgent — different interface):
- Does programmatic merging and validation, NOT LLM-based
- validate(structure_result, character_result, entry_result, analysis_result) -> ParseResult
- Validates:
  - Chapter numbers are continuous (1..N), flags gaps
  - Character names referenced in chapters exist in character list
  - Entry tags are from valid set
  - No empty required fields
- Returns complete ParseResult with all warnings

### 6. REPLACE backend/app/services/outline_parsing_agent/coordinator.py

Replace the stub with full implementation. The OutlineParsingOrchestrator:

```python
import logging
import time
from typing import Any
from collections.abc import AsyncIterator

from app.services.outline_parsing_agent.config import AgentPipelineConfig
from app.services.outline_parsing_agent.models import (
    ParseResult, ParsedOutline, ParsedCharacter, ParsedEntry, AgentStepResult,
)
from app.services.outline_parsing_agent.chunker import TextChunker
from app.services.outline_parsing_agent.agents.analysis_agent import AnalysisAgent
from app.services.outline_parsing_agent.agents.structure_agent import StructureExtractionAgent
from app.services.outline_parsing_agent.agents.character_agent import CharacterExtractionAgent
from app.services.outline_parsing_agent.agents.entry_agent import EntryExtractionAgent
from app.services.outline_parsing_agent.agents.validation_agent import ValidationAgent

logger = logging.getLogger("ainovel.parsing_agent")
```

Key method: parse_outline() which:
1. Resolves LLM config using llm_task_preset_resolver (task_key="outline_generate" as fallback since outline_parse may not exist)
2. Gets LLM strategy from registry
3. Creates AgentPipelineConfig from agent_config dict
4. Chunks the input text using TextChunker
5. Phase 1: Run AnalysisAgent on first chunk only
6. Phase 2: Run Structure/Character/Entry agents (parallel if config allows, sequential otherwise)
   - For parallel: use concurrent.futures.ThreadPoolExecutor since LLM calls are sync
7. Phase 3: Run ValidationAgent to merge results
8. Return ParseResult

Key method: parse_outline_stream_events() which yields SSE-compatible dicts:
- {type: "phase_start", phase: "analysis", message: "..."}
- {type: "agent_progress", agent: "structure", message: "...", progress: N}
- {type: "agent_complete", agent: "structure", data: {...}}
- {type: "phase_complete", phase: "extraction"}
- {type: "parse_complete", data: ParseResult.to_dict()}
- {type: "error", message: "..."}

IMPORTANT: The function signatures must match what __init__.py exports:
```python
def parse_outline(
    *,
    project_id: str,
    user_id: str,
    content: str,
    request_id: str,
    x_llm_provider: str | None = None,
    x_llm_api_key: str | None = None,
    agent_config: dict[str, Any] | None = None,
) -> ParseResult:
```

To resolve LLM config, follow the pattern in backend/app/services/outline_generation/prepare_service.py:
- Use resolve_llm_task_preset() from llm_task_preset_resolver
- Get strategy from StrategyRegistry
- The function needs a database session - get it from app.api.deps or use get_db()

### 7. PROMPT FILES (10 files in backend/app/services/outline_parsing_agent/prompts/)

Create these prompt templates:

#### prompts/analysis_system.md
```
You are an expert document analyst. Your task is to analyze the structure and content of a text that represents a novel outline or story plan.

Analyze the input and identify:
1. What types of content are present (chapters, character descriptions, world settings, plot points, etc.)
2. Whether the text contains chapter structures
3. Whether it contains character profiles
4. Whether it contains worldbuilding entries or settings
5. The estimated number of chapters
6. A brief description of the format

Output ONLY a JSON object with NO other text:
{
  "content_types": ["chapters", "characters", "entries"],
  "has_chapters": true,
  "has_characters": true,
  "has_entries": true,
  "estimated_chapter_count": 50,
  "format_description": "A structured outline with numbered chapters, character profiles section, and world settings."
}
```

#### prompts/analysis_user.md
```
Analyze the following text (chunk {{chunk_index}} of {{total_chunks}}):

---
{{chunk_text}}
---

Output ONLY a JSON object with the analysis result.
```

#### prompts/structure_system.md
```
You are an expert outline structure extractor. Your task is to extract chapter structure from a novel outline.

For each chapter found, extract:
- number: the chapter number (integer, starting from 1)
- title: the chapter title
- beats: an array of story beats/plot points for this chapter

Also extract a markdown summary of the overall story arc (outline_md).

CRITICAL RULES:
1. Chapter numbers must be positive integers
2. If the original numbering is different (e.g., "Part 1 Chapter 3"), convert to sequential numbers
3. Each beat should describe a specific story event, formatted as: "[annotation] who did what → consequence"
4. Annotations can be: [信息+], [关系+/-], [资源+/-], [地位+/-], [伏笔↗植入], [伏笔↙回收]
5. If beat annotations are not obvious, omit them
6. Keep beats concise but informative
7. If processing a chunk of a larger document, extract only the chapters in this chunk

Output ONLY a JSON object with NO other text:
{
  "outline_md": "Story arc summary in markdown...",
  "chapters": [
    {"number": 1, "title": "Chapter Title", "beats": ["Beat 1 description", "Beat 2 description"]}
  ]
}
```

#### prompts/structure_user.md
```
Extract the chapter structure from the following text (chunk {{chunk_index}} of {{total_chunks}}):

{{analysis_context}}

---
{{chunk_text}}
---

Output ONLY a JSON object with outline_md and chapters array.
```

#### prompts/character_system.md
```
You are an expert character extractor. Your task is to extract character profiles from a novel outline or story plan.

For each character found, extract:
- name: the character's name (required)
- role: their role in the story (e.g., "主角", "反派", "配角", "导师") or null
- profile: character background, personality, appearance, abilities (or null)
- notes: additional notes about the character's arc, relationships, or development (or null)

RULES:
1. Extract ALL named characters mentioned in the text
2. For major characters, provide detailed profiles
3. For minor characters, at minimum provide name and role
4. If a character appears under multiple names/aliases, merge into one entry
5. profile and notes should be in the same language as the source text

Output ONLY a JSON object:
{
  "characters": [
    {"name": "Character Name", "role": "主角", "profile": "Background...", "notes": "Arc notes..."}
  ]
}
```

#### prompts/character_user.md
```
Extract character profiles from the following text (chunk {{chunk_index}} of {{total_chunks}}):

{{analysis_context}}

---
{{chunk_text}}
---

Output ONLY a JSON object with characters array.
```

#### prompts/entry_system.md
```
You are an expert worldbuilding extractor. Your task is to extract worldbuilding entries, settings, and important story elements from a novel outline.

For each entry found, extract:
- title: a short descriptive title (required)
- content: the detailed description (required)
- tags: categorization tags from this list: ["设定", "伏笔", "情节", "世界观", "魔法体系", "势力", "地点", "物品", "规则", "历史"]

WHAT TO EXTRACT:
1. World settings (geography, politics, economy, culture)
2. Magic systems or power systems
3. Organizations, factions, forces
4. Important locations
5. Key items or artifacts
6. Rules of the world
7. Historical events that affect the plot
8. Foreshadowing elements and planted clues
9. Plot devices and recurring motifs

RULES:
1. Each entry should be self-contained and independently useful
2. Do NOT extract character profiles (those are handled separately)
3. Do NOT extract chapter summaries (those are handled separately)
4. Focus on reusable worldbuilding information
5. Content should be in the same language as the source text
6. Each entry should have 1-3 relevant tags

Output ONLY a JSON object:
{
  "entries": [
    {"title": "Entry Title", "content": "Detailed description...", "tags": ["设定", "世界观"]}
  ]
}
```

#### prompts/entry_user.md
```
Extract worldbuilding entries from the following text (chunk {{chunk_index}} of {{total_chunks}}):

{{analysis_context}}

---
{{chunk_text}}
---

Output ONLY a JSON object with entries array.
```

#### prompts/validation_system.md
(Not needed — validation is programmatic, but create an empty placeholder)
```
Reserved for future LLM-based validation.
```

#### prompts/validation_user.md
(Not needed — create empty placeholder)
```
Reserved for future LLM-based validation.
```

## AFTER CREATING ALL FILES

1. Run: python -m compileall backend/app/services/outline_parsing_agent/
2. Fix any compilation errors
3. Verify all imports resolve correctly

## CRITICAL NOTES
- Do NOT modify any files outside of backend/app/services/outline_parsing_agent/
- Do NOT use escaped quotes (\") — use normal double quotes
- Follow existing project patterns (see agent.py, strategy.py)
- The coordinator needs to handle the case where LLM task preset "outline_parse" doesn't exist in the catalog — fall back to "outline_generate"
- Use concurrent.futures.ThreadPoolExecutor for parallel agent execution (not asyncio, since LLM calls are sync)
- All prompt .md files go in backend/app/services/outline_parsing_agent/prompts/
- Delete the .gitkeep file in prompts/ after creating the actual prompt files
