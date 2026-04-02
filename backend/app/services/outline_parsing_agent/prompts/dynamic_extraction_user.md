从以下文本中提取{{task_type_name}}信息（分块 {{chunk_index}}/{{total_chunks}}）。

## 你的任务范围
{{scope}}

请**只提取属于上述任务范围内的内容**，忽略不相关的部分。

{{analysis_context}}

---
{{chunk_text}}
---

请严格按照系统提示的 JSON 格式输出。注意：
- 字符串内的换行必须转义为 \n
- 字符串内的双引号必须转义为 \"
- 确保输出的 JSON 完整且可被 json.loads() 直接解析
- 仅输出 JSON，无其他文本
- 数组或对象末尾不要有多余的逗号
