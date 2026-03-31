{% if memory and memory.structured and memory.structured.text_md %}<STRUCTURED_MEMORY>
以下是结构化记忆条目——角色当前状态、关系图谱、已知事实、持有物品、伤病状况等。
这些是本章写作的起始前提：
- 角色状态（位置、健康、情绪基线等）是本章开场时的现状，不得无故改变
- 关系状态（盟友、敌人、欠债、承诺等）决定了角色间的互动方式和隐藏的利益计算
- 若本章中角色状态发生变化，变化必须有合理的触发事件
- 角色的伤势、疲劳、装备状态等物理条件会影响他们的行动能力和选择——不要忽略这些限制
- 关系中的紧张点和未解决的矛盾可以作为本章冲突的燃料
{{memory.structured.text_md}}
</STRUCTURED_MEMORY>
{% endif %}
