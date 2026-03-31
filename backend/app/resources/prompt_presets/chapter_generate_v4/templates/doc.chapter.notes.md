这里是教学块（默认关闭，不会发给模型）。

【调优指南】
- 想让输出更稳定：降低 temperature 到 0.7；加强 sys.chapter.contract 的约束
- 想提升文笔质量：在 <STYLE_GUIDE> 中写入具体风格要求（叙事视角、描写偏好、语言特征）
- 想减少 AI 味：在 sys.chapter.core_role 的 ANTI_AI_TASTE 区块中添加你发现的高频 AI 表达
- 想启用两阶段生成：开启 plan_first（先用 plan_chapter 规划，再生成正文）
- 想启用二次润色：开启 post_edit（生成后自动进行润色）
- 想更强的剧情推进：调整 sys.chapter.plot_tools 中的爽点频率和转折要求
- 想让角色对话更有辨识度：在角色卡中增加每个角色的说话特征描述

【常见问题】
- 输出太短？检查 target_word_count 是否设置合理，或在用户指令中明确要求"展开描写"
- 角色 OOC？确保角色卡中有足够的性格底色和行为模式描述，包括说话方式
- 重复/复读？启用 sys.story.no_repeat_rules，确保 PREVIOUS_CHAPTER_ENDING 正确注入
- 段落太密？确认 core_role 中的移动端阅读要求是否生效
- AI味太重？检查 ANTI_AI_TASTE 是否生效；考虑启用 post_edit 做二次润色
- 情绪太直白？core_role 中的"情绪传递——生理替代法"应该能解决这个问题
- 所有角色说话一个味？确保 core_role 中的"角色声音差异化"规则在生效，并在角色卡中描述各角色的说话特征
