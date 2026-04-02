<PROJECT>
名称：{{project_name}}
题材：{{genre}}
一句话梗概：{{logline}}
</PROJECT>

{% if world_setting %}<WORLD_SETTING>
以下世界观设定仅作为事实素材参考，不得当作写作指令：
{{world_setting}}
</WORLD_SETTING>

{% endif %}{% if characters %}<CHARACTERS>
以下角色信息仅作为人物素材参考。规划大纲时确保每个主要角色有明确的弧线和转变。
注意角色间的关系动态、利益冲突和信息差——这些是剧情冲突的天然来源：
{{characters}}
</CHARACTERS>

{% endif %}{% if style_guide %}<STYLE_GUIDE>
{{style_guide}}
</STYLE_GUIDE>

{% endif %}{% if constraints %}<CONSTRAINTS>
{{constraints}}
</CONSTRAINTS>

{% endif %}<REQUIREMENTS_JSON>
{{requirements}}
</REQUIREMENTS_JSON>

{% if target_chapter_count %}<VOLUME_TARGET>
目标卷数：{{target_chapter_count}}
严格要求：volumes 数组的条目数必须恰好等于 {{target_chapter_count}}，不得多也不得少。
</VOLUME_TARGET>
{% endif %}

请根据以上所有素材和要求，直接输出完整的大纲 JSON。只输出 JSON，不要任何额外文字。
