# 大纲生成提示词重构 — 输出大纲+细纲

## 背景
当前 outline_generate_v3 输出 `{"outline_md", "chapters": [{number, title, beats}]}`，这是旧的"大纲+章节骨架"格式。
现在系统增加了"细纲"层级，正确的链路是：
1. 大纲生成 → 输出：大纲总纲 + 细纲（每卷200-500字详细内容）
2. 保存大纲 + 自动创建 DetailedOutline 记录
3. 细纲页面 → 用户点击"生成章节骨架" → 另一次 LLM 调用生成具体 beats/章节

## 需要修改的文件

### 1. `backend/app/resources/prompt_presets/outline_generate_v3/templates/sys.outline.contract.json.md`

将 JSON Schema 从 `chapters` 改为 `volumes`：

```
<OUTPUT_CONTRACT>
输出格式契约：

你必须只输出一个 JSON 对象。标签外禁止任何文字，不要 Markdown 代码块围栏，不要解释说明。

JSON Schema：
{
  "outline_md": string,
  "volumes": [
    {"number": int, "title": string, "summary": string}
  ]
}

字段要求：

outline_md（全局视角摘要，Markdown 格式）：
- 整体故事弧线（起点状态→核心冲突→关键转折点→终局状态）
- 使用的结构模型（三幕式/费希特曲线/故事圆环/起承转结/混合）及比例分配
- 主要人物的成长/变化路径（标注每人的"谎言"与"真相"）
- 伏笔分布计划（何处埋设、何处回收）
- 节奏规划（高潮、低谷的卷分布）
- 信息释放计划（关键真相在哪些卷以什么方式被揭露）
- 不要写成正文，写成可执行的策划文档

volumes 数组要求：
- number 从 1 递增，不得跳号或重复
- title 用"核心事件/核心主题"命名，禁止"风云再起""暗流涌动"等空标题
{% if chapter_count_rule %}- {{chapter_count_rule}}
{% endif %}
- summary 是这一卷的**详细细纲**（200~500字），必须包含：
  · 本卷的核心冲突和关键转折
  · 主要角色在本卷中的行动和变化
  · 与前卷的承接和后卷的铺垫
  · 关键伏笔的埋设或回收标注
  · 足够具体，让另一个AI可以据此展开为8-15个章节
- summary 禁止只写一句话概括，必须展开为200字以上的详细叙述
- summary 中标注推进项类型：[信息+] [关系+/-] [资源+/-] [地位+/-] [伏笔↗植入] [伏笔↙回收]

硬性约束：
- 若输出长度受限，优先保证卷数量完整，可压缩 summary 但不得少于100字
- 严禁"待补全/自动补齐/占位/TODO/略/..."等占位内容
- 严禁只输出前几卷或示例；必须输出完整 volumes 数组
- 每卷 summary 的结尾应包含本卷的结尾钩子或悬念
</OUTPUT_CONTRACT>
```

### 2. `backend/app/resources/prompt_presets/outline_generate_v3/templates/sys.outline.role.md`

保留大部分结构方法论内容，但更新以下部分：
- BEAT_WRITING 部分改为面向卷级别的规划，不再描述章节节拍
- 将"章节"相关措辞改为"卷"
- 保留结构模型、因果链、人物行为规则等（这些适用于卷级规划）

具体修改：
- `<BEAT_WRITING>` 标签改为 `<VOLUME_PLANNING>`
- 内容改为卷级别的规划指导：每卷 summary 的写法要求

### 3. `backend/app/resources/prompt_presets/outline_generate_v3/templates/user.outline.material.md`

- `target_chapter_count` 相关文字改为 `target_volume_count`
- `CHAPTER_TARGET` 改为 `VOLUME_TARGET`
- "chapters 数组" 改为 "volumes 数组"

### 4. `backend/app/services/output_parsers.py`

在 `parse_outline_output` 函数中：
- 优先检查 `volumes` 字段
- 如果存在 `volumes` 数组，提取并返回 `{"volumes": [...], "outline_md": "..."}`
- 如果只有 `chapters`（旧格式），保持向后兼容
- 添加 `OutlineVolumeSchema` 验证类（类似现有的 `OutlineSchema`）

### 5. `backend/app/services/outline_payload_normalizer.py`

在 `normalize_outline_content_and_structure` 中：
- 处理 `volumes` 结构（除了已有的 `chapters`）
- 如果 data 包含 `volumes`，返回 `{"volumes": volumes_list}` 作为 structure

### 6. `backend/app/services/detailed_outline_generation/app_service.py`

在 `generate_all_detailed_outlines` 的结构检查部分：
- 优先检查 `structure["volumes"]`
- 每个 volume → 一条 DetailedOutline 记录
  - volume.summary → content_md
  - volume 整体 → structure_json
- 如果只有 `chapters`（旧格式），用现有逻辑处理

### 7. 前端相关（如果需要）

outline 页面显示"X 卷"而非"X 章"。但这可能不需要改——细纲页面已经按卷显示了。

## 关键原则
- 向后兼容：如果 structure 包含 `chapters`（旧格式），继续支持
- 新格式优先：如果有 `volumes`，优先使用
- prepare_service.py 中 render_values 里的 `target_chapter_count` 保持，前端传入的参数名不需要改

## 验证
1. `cd backend && python -m compileall -q app/`
2. 确认提示词模板语法正确（不能破坏 Jinja 条件语法）
