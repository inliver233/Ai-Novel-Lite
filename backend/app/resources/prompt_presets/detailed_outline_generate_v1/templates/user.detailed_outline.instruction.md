请为第 {{volume_number}} 卷「{{volume_title}}」生成详细的章节级细纲。

要求：
- 将大纲中本卷的所有beats展开为具体章节
- 确保与上一卷自然衔接、为下一卷做好铺垫
- 每章都有明确的推进目标和结尾钩子
{% if instruction %}

用户补充指令：
{{instruction}}
{% endif %}
