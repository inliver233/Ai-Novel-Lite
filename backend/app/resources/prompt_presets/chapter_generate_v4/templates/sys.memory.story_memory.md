{% if memory and memory.story_memory and memory.story_memory.text_md %}<STORY_MEMORY>
以下是与当前章节相关的情节记忆摘要——这些是已经发生的故事事实。
写作时必须：
- 与这些事实保持一致，不得产生矛盾
- 自然延续这些事实的后续影响，不得忽略已有的后果和状态变化
- 不要在正文中重新叙述这些已知事件，但要体现它们对角色当前行为和心态的影响
- 角色基于这些已知事实做出的决策必须合理——他们不会忘记自己经历过的事
- 如果这些事实中包含角色间的承诺、约定或矛盾，本章应自然推进其发展
{{memory.story_memory.text_md}}
</STORY_MEMORY>
{% endif %}
