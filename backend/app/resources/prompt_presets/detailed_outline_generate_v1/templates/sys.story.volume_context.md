<VOLUME_CONTEXT>
当前任务：为第 {{volume_number}} 卷「{{volume_title}}」生成细纲

{% if previous_volume_summary %}
<PREVIOUS_VOLUME>
上一卷结尾概要（用于衔接）：
{{previous_volume_summary}}
</PREVIOUS_VOLUME>
{% endif %}

<CURRENT_VOLUME>
本卷在大纲中的原始内容：
{{current_volume_beats}}
</CURRENT_VOLUME>

{% if next_volume_summary %}
<NEXT_VOLUME>
下一卷开头概要（用于铺垫）：
{{next_volume_summary}}
</NEXT_VOLUME>
{% endif %}

{% if chapter_number_start %}
章节编号起始：第 {{chapter_number_start}} 章
{% endif %}
{% if chapters_per_volume %}
建议章节数：{{chapters_per_volume}} 章（可根据内容复杂度适当调整）
{% endif %}
</VOLUME_CONTEXT>
