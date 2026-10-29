# Lexora 词册格式 v1

本文件与 [JSON Schema](../schemas/deck-v1.schema.json)、`src/deck.js` 的语义校验一起定义格式。词册只携带内容，个人学习进度另存。首版支持 UTF-8 JSON，单文件不超过 **10 MiB / 50,000 条**；这是应用限制，不是 JSON 的上限。最多保存 100 本词册；完整备份上限 50 MiB。

## 最小词册

```json
{
  "format": "lexora.deck",
  "schemaVersion": 1,
  "id": "org.example:my-notebook",
  "revision": 1,
  "title": "我的手帖",
  "language": "en",
  "answerLanguage": "zh-Hans",
  "cards": [
    { "id": "retain", "type": "vocabulary", "prompt": "retain", "answer": "保留；记住" },
    { "id": "retrieval", "type": "knowledge", "prompt": "什么是主动回忆？", "answer": "不看答案，尝试从记忆中提取已学内容。" }
  ]
}
```

## 词册字段

| 字段 | 必需 | 含义 |
| --- | --- | --- |
| `format` | 是 | 固定为 `lexora.deck`，与备份文件区分 |
| `schemaVersion` | 是 | 格式版本，当前固定为整数 `1` |
| `id` | 是 | 跨修订稳定的词册身份；建议使用自己的命名空间 |
| `revision` | 是 | 内容修订号，正整数，更新时递增 |
| `title` | 是 | 名称，非空，最多 120 字符 |
| `description` | 否 | 简介，最多 2,000 字符 |
| `language` / `answerLanguage` | 否 | 题面 / 答案语言标签，如 `en`、`zh-Hans`；卡片可以覆盖 |
| `sources` | 否 | 来源列表，见下文 |
| `cards` | 是 | 1–50,000 条卡片 |
| `extensions` | 否 | 带命名空间的扩展数据；读取器不执行、不展示其中的代码 |

ID 使用 1–160 个 ASCII 字符，字母或数字开头，可包含 `: . _ / -`；`constructor`、`prototype` 为保留值。卡片 ID 在同一词册内唯一，来源 ID 在来源列表内唯一。**不得用数组下标生成会随排序变化的 ID。** 同一单词的不同考点可以使用不同 ID；仅仅显示相同文本不代表同一张卡片。

## 卡片字段与学习语义

`id`、`type`、`prompt`、`answer` 是必填字段。题面最多 2,000 字符，答案最多 12,000 字符，均不允许空白文本。

| 类型 | 翻面模式 | 拼写模式 |
| --- | --- | --- |
| `vocabulary` | 显示 prompt，翻开 answer | 显示 answer，输入 prompt；可用 acceptedAnswers 指定可接受写法 |
| `knowledge` | 显示问题 prompt，翻开 answer，自行判断掌握 | 默认仍用翻面；只有明确提供 acceptedAnswers 才启用输入检查，此时显示 prompt，输入答案 |

`acceptedAnswers` 若提供，必须包含 1–20 条非空文本，每条最多 2,000 字符。比较时统一 Unicode NFKC、英文大小写、首尾空格、连续空白和常见横线；不删除标点、不模糊匹配、不使用 AI 判分。知识点的语义等价长答案不适合自动精确判分。

可选字段：

- `pronunciations`: 最多 10 项，`{ "label": "US", "value": "/.../" }`，label 最长 80，value 非空且最长 200 字符。
- `examples`: 最多 20 项，`{ "text": "…", "translation": "…" }`；text 非空，两个字段分别最多 4,000 字符。当前学习页显示前两项，导出保留全部。
- `tags`: 最多 20 个非空标签，每个最多 64 字符。
- `note`: 最多 8,000 字符的补充说明。
- `language` / `answerLanguage`: 覆盖词册默认语言。
- `sourceRefs`: 引用词册 sources 中已定义的 ID，最多 100 项。
- `extensions`: 例如 `{ "org.example": { "custom": true } }`。扩展键用小写命名空间，含至少一个点。所有未知标准字段都会报错，避免拼错字段后静默丢失内容。

所有内容均按**纯文本**呈现，换行保留，不解析 HTML、Markdown、公式或脚本。不支持网络图片、远程音频、任意模板或卡片自带 JavaScript。日后增加能力应通过格式版本与明确的阅读器能力约定扩展，不让内容变成可执行页面。

## 来源

```json
"sources": [
  { "id": "personal-notes", "title": "个人整理", "license": "自定的许可说明", "url": "https://example.com/notes" }
]
```

`id`、`title` 必填；来源名称最多 300 字符，license 最多 200。url 可省略，若填写只接受 http/https 且最多 2,000 字符。元数据本身不证明内容准确或已经取得授权，贡献者应自行确认。

## 更新与进度

1. 相同词册 ID 表示同一词册。不能导入更低修订号覆盖当前内容。
2. 同修订号仅接受与已安装对象序列化结果相同的内容；即使只改名称或调整字段顺序，也请提高 revision。
3. 相同卡片 ID 的学习统计保留。修改卡片 type、prompt、answer 或 acceptedAnswers，会取消该卡片的已掌握状态，并将它加入待学队列。
4. 调整排序、标签、例句、注释等不会清空进度；更新时已有轮次顺序保持，新一轮采用新词册顺序。
5. 新增卡片加入待学；移除卡片离开队列与近期历史。累计统计保留，旧条目的统计作为本地记录留存。
6. 删除并重新使用同一 ID 表示恢复同一知识身份。知识发生根本变化时，应使用新 ID。
7. 导入前展示预览和变更数量，用户确认后才写入。导入失败不会修改当前词册。

JSON Schema 检查结构；ID 唯一性、来源引用、版本覆盖规则由应用进行额外语义校验。显示错误时使用从 1 开始的卡片编号。

## 早期 JSONL 兼容

根目录 `test.jsonl` 保留原样，供回归测试。首行必须是 `type: metadata`、`schema: lexora.wordbook.v1`，后续每行为 `type: entry`。选择 `.jsonl` 文件时适配为当前格式：term → prompt，senses → 多行 answer，pronunciations/examples/tags/notes/source_refs 对应转换，原元数据与原条目留在 `extensions.lexora.legacy`，保留词形与多义结构。

旧格式缺少词册 ID，适配器暂以标题生成 `legacy:标题` 的 ASCII ID。非 ASCII 部分转为连字符，存在标题碰撞的可能。正式维护或更新旧词册前，请导出为标准 JSON，手动赋予唯一稳定 ID 和递增 revision。不要把 JSONL 适配器当作第二套长期标准。

旧版「词序 · SystemC」进度备份不含词库本体，也不是 Lexora 完整备份，本版本不会把它误识别为词册或自动迁移。

## AI 生成与格式检查

可把最小示例和本规范提供给自己的 AI 工具，要求输出一个 UTF-8 JSON 对象，无代码围栏，明确稳定 ID 与递增 revision。网站不调用 AI API。正式词库暂未制作。

运行 `npm ci`、`npm test` 可检查示例、标准 Schema、兼容适配和更新规则；也可用支持 JSON Schema 2020-12 的编辑器检查结构。解析成功不等于知识内容已经校对。
