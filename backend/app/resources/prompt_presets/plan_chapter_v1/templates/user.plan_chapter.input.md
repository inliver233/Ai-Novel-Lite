<PROJECT>
{{project_name}} / {{genre}} / {{logline}}
</PROJECT>

{% if world_setting %}<WORLD_SETTING>
{{world_setting}}
</WORLD_SETTING>

{% endif %}{% if characters %}<CHARACTERS>
以下角色信息用于确保规划的行为逻辑与人设一致。
注意每个角色的说话特征和行为模式——规划中应体现角色间的声音差异：
{{characters}}
</CHARACTERS>

{% endif %}{% if outline %}<OUTLINE>
以下大纲用于确保本章规划与整体故事弧线一致：
{{outline}}
</OUTLINE>

{% endif %}{% if previous_chapter_ending %}<PREVIOUS_CHAPTER_ENDING>
上一章结尾（本章开头必须自然衔接此处的动作/情绪/悬念，不得另起炉灶）：
{{previous_chapter_ending}}
</PREVIOUS_CHAPTER_ENDING>

{% endif %}<CHAPTER_INFO>
第{{chapter_number}}章 {{chapter_title}}
{% if chapter_plan %}大纲中的本章要点（将其转化为可执行的场景序列，每个场景要有具体的动作和后果）：
{{chapter_plan}}{% endif %}
</CHAPTER_INFO>

<USER_INSTRUCTION>
{{instruction}}
</USER_INSTRUCTION>

请根据以上素材，直接输出 <plan> 标签块。不要输出任何额外说明。
