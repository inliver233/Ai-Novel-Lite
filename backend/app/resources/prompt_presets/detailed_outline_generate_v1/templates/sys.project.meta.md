{% if project_name or genre or logline %}
<PROJECT_META>
{% if project_name %}作品名称：{{project_name}}{% endif %}
{% if genre %}题材类型：{{genre}}{% endif %}
{% if logline %}故事核心：{{logline}}{% endif %}
</PROJECT_META>
{% endif %}
