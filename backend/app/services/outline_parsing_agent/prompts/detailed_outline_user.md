以下是需要提取细纲的文本内容（第 {{chunk_index}}/{{total_chunks}} 段）：

---
{{chunk_text}}
---

{{analysis_context}}

请严格按照系统提示的 JSON 格式输出。注意：
- 字符串内的换行必须转义为 \n
- 字符串内的双引号必须转义为 \"
- 确保输出的 JSON 完整且可被 json.loads() 直接解析
- 仅输出 JSON，无其他文本
- 数组或对象末尾不要有多余的逗号
