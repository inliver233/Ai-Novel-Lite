{% if memory and memory.vector_rag and memory.vector_rag.text_md %}<RETRIEVED_CONTEXT>
以下是通过语义检索获取的与当前章节最相关的历史片段，用于保持情节一致性和细节准确性。
使用规则：
- 参考这些片段中的事实细节（地名、人名、物品、事件经过）以确保前后一致
- 不要逐字复述这些内容——它们是参考素材，不是需要重写的原文
- 如果检索片段中的事实与 <STORY_MEMORY> 或 <STRUCTURED_MEMORY> 有冲突，以后者为准
- 注意角色在这些片段中的说话方式和行为模式——本章应保持一致的角色声音
- 这些片段中出现的环境细节（地形、建筑、气候等）在本章中应保持连续
{{memory.vector_rag.text_md}}
</RETRIEVED_CONTEXT>
{% endif %}
