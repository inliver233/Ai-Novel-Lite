<USER_INSTRUCTION>
{{instruction}}
</USER_INSTRUCTION>

{% if requirements %}<REQUIREMENTS>
{{requirements}}
</REQUIREMENTS>
{% endif %}{% if target_word_count %}<TARGET_WORD_COUNT>
目标字数：约 {{target_word_count}} 字。到达目标字数时在合适的叙事节点收束，不要为凑字数而注水，也不要在关键场景中途截断。
注意：字数是参考而非硬性限制——宁可少写100字在好的位置收束，也不要多写500字注水。
</TARGET_WORD_COUNT>
{% endif %}

请根据以上所有参考资料和指令，直接输出本章正文。按输出格式契约输出，不要添加任何额外说明。
