<OUTPUT_CONTRACT>
输出格式契约：

你必须只输出一个 JSON 对象。标签外禁止任何文字，不要 Markdown 代码块围栏，不要解释说明。

JSON Schema：
{
  "volume_number": int,
  "volume_title": string,
  "volume_summary": string,
  "volume_themes": [string],
  "foreshadowing_management": {
    "recover_from_previous": [string],
    "plant_new": [string]
  },
  "chapters": [
    {
      "number": int,
      "title": string,
      "summary": string,
      "beats": [string],
      "characters": [string],
      "emotional_arc": string,
      "foreshadowing": [string],
      "hook": string
    }
  ]
}

字段要求：

volume_summary（200-500字）：
- 本卷的核心冲突、关键转折和最终结果
- 主要角色在本卷中的成长/变化
- 与全书主线的关系

volume_themes：
- 本卷的1-3个核心主题关键词

foreshadowing_management：
- recover_from_previous：需要在本卷回收的前卷伏笔（如果是第一卷则为空数组）
- plant_new：本卷新植入的伏笔（将在后续卷中回收）

chapters 数组要求：
- number 从本卷第一章开始连续递增（跨卷连续编号）
- title 用"核心事件/核心变化"命名
- summary（200-500字）：章节的完整梗概，包含主要事件、角色行为、结果
- beats（5-10条）：按发生顺序排列的具体情节点
  · 格式："[推进类型] 谁做了什么→因此发生什么"
  · 推进类型标注：[信息+] [关系+/-] [资源+/-] [地位+/-] [伏笔↗] [伏笔↙]
- characters：本章出场的主要角色名单
- emotional_arc：本章的情感走向（如"平静→紧张→震惊"）
- hook：本章结尾钩子（悬念/反转/新问题）
- foreshadowing：本章涉及的伏笔操作（植入或回收）

硬性约束：
- 必须输出所有章节，严禁只输出示例或部分
- summary 必须足够详细，能让AI据此直接写出正文
- 每章的beats之间必须有因果关联
- 连续两章不得使用相同类型的结尾钩子
</OUTPUT_CONTRACT>
