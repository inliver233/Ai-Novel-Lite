<CHAPTER_INFO>
第{{chapter_number}}章 {{chapter_title}}
{% if chapter_plan %}
本章要点（你的核心任务是将这些要点转化为生动的场景——用具体的动作、对话和感官来呈现，而非逐条复述）：
{{chapter_plan}}
{% endif %}{% if story and story.plan %}<PLAN>
{{story.plan}}
</PLAN>
{% endif %}</CHAPTER_INFO>
