# Lexora 词册格式 v2

v2 将日常阅读的短释义与词典信息分开：学习页显示 `term` 和 `shortDefinition`，点击词条后查看音标、不同词性和完整释义。不包含例句、图片、音频或可执行模板。

[JSON Schema 2020-12](../schemas/deck-v2.schema.json) · [最小可导入示例](../examples/dictionary-v2.json) · [完整 3815 词样例](../examples/first-dictionary.json) · [v1 兼容规范](deck-format-v1.md)

## 最小词典词册

```json
{
  "$schema": "https://qrzzzz.github.io/lexora/schemas/deck-v2.schema.json",
  "format": "lexora.deck",
  "schemaVersion": 2,
  "id": "org.example:my-dictionary",
  "revision": 1,
  "title": "我的词册",
  "language": "en",
  "answerLanguage": "zh-Hans",
  "cards": [
    {
      "id": "book",
      "type": "vocabulary",
      "term": "book",
      "shortDefinition": "书；预订",
      "pronunciations": [
        { "system": "ipa", "region": "general", "value": "/bʊk/" }
      ],
      "senses": [
        { "id": "noun-1", "partOfSpeech": "n.", "definitions": ["书", "账簿"] },
        { "id": "verb-1", "partOfSpeech": "v.", "definitions": ["预订", "登记"] }
      ]
    }
  ]
}
```

## 词册与身份

| 字段 | 必需 | 规则 |
| --- | --- | --- |
| `format` | 是 | 固定为 `lexora.deck` |
| `schemaVersion` | 是 | 当前新版固定为整数 `2` |
| `id` | 是 | 跨修订稳定的词册 ID，建议使用自己的命名空间 |
| `revision` | 是 | 从 1 开始的整数，每次修改后递增；不等于格式版本 |
| `title` | 是 | 非空名称，最多 120 字符 |
| `description` | 否 | 简介，最多 2,000 字符 |
| `language` / `answerLanguage` | 否 | 默认词目 / 释义语言标签，如 `en`、`zh-Hans`；卡片可覆盖 |
| `sources` | 否 | 来源列表，见下文 |
| `cards` | 是 | 1–50,000 张卡片，可混合词汇与知识点 |
| `extensions` | 否 | 命名空间扩展对象，如 `{ "org.example": {} }` |
| `$schema` | 否 | 上例中的标准 Schema 地址，用于编辑器提示；应用不会请求或执行它 |

所有 ID 为 1–160 个 ASCII 字符，以字母或数字开头，可含 `: . _ / -`；`constructor`、`prototype` 是保留值。词条 ID 在本词册内唯一，义组 ID 在本词条内唯一，来源 ID 在来源列表内唯一。不要使用会随排序变化的数组序号充当身份。

JSON Schema 检查字段结构；ID 唯一性、引用关系和词册更新规则由运行时另外校验。未知字段会报错，不会被静默忽略；自定义字段放入带命名空间的 `extensions`。

## 词汇卡片

必填 `id`、`type: vocabulary`、`term`、`shortDefinition`、`senses`。

- `term`：词目或词组，非空，最多 200 字符；拼写模式默认接受此值。
- `shortDefinition`：平时显示在词目下面的短释义，建议只保留 1–3 个核心义项，约 32 字以内；格式上限 160 字符。它不代替完整释义。
- `senses`：1–50 组释义。每组包括稳定 `id`、明确的 `partOfSpeech` 和 1–50 个非空 `definitions`。词性最长 80 字符，每条释义最长 4,000 字符。
- `pronunciations`：可省略或为空，最多 10 条。每条必填 `system: ipa` 和非空 `value`（最多 200 字符）；不强制填写来源缺失的音标。
- `acceptedAnswers`：可选的 1–20 个可接受拼写，每项最多 2,000 字符。省略时接受 term。

词性保留来源的明确标记，如 `n.`、`v.`、`vt.`、`vi.`、`adj.`、`a.`、`adv.`。不使用固定英语枚举，以容纳不同语种和上游标记。来源未标词性时使用 `other`，界面显示为「未标词性」，不根据上下文猜测。

同一词性可以有多个义组；同一义组的 definitions 按来源顺序保留。数组中的每一项是来源给出的一个义项或释义单位，不保证它们经过词典学审定。短释义和完整释义均为纯文本，换行保留，不解析 HTML、Markdown 或脚本。

音标 `region` 可用 `uk`、`us` 或 `general`；省略表示未说明。它描述来源声明的口音，不应从音标形状反推。当前 `system` 仅接受 ipa；这个标记不证明上游转写已经人工校订。

同一词因词性而发音不同时，可用 `senseRefs` 引用该词条中的义组：

```json
{ "system": "ipa", "region": "uk", "value": "/rɪˈkɔːd/", "senseRefs": ["verb-1"] }
```

`senseRefs` 若提供，必须为 1–50 个已存在的义组 ID。词册示例中的 `record` 演示了名词、动词的不同读音。未提供此字段时，音标适用于词条整体。

## 知识卡片

知识点继续使用问题与答案，不需要伪装成词典词条：

```json
{ "id": "retrieval", "type": "knowledge", "prompt": "什么是主动回忆？", "answer": "不看答案，尝试从记忆中提取内容。", "language": "zh-Hans" }
```

prompt / answer 必填，分别最多 2,000 / 12,000 字符。默认只翻面并自评；明确提供 acceptedAnswers 时才做输入检查。词汇拼写模式下显示 shortDefinition，输入 term；知识输入检查显示 prompt，输入 acceptedAnswers。

输入比较统一 Unicode NFKC、英文大小写、首尾空白、连续空白和常见横线；不删标点、不做语义评分、不调用 AI。

## 通用附加字段与来源

两种卡片都可提供 `language` / `answerLanguage`、最多 20 个 `tags`（每项 64 字符）、`note`（8,000 字符）、`sourceRefs`（最多 100 项）和 `extensions`。v2 不接受 `examples`，旧版导入中的例句不会出现在界面上。

```json
"sources": [
  { "id": "source-book", "title": "来源名称", "url": "https://example.com/data", "license": "MIT" }
]
```

来源的 id / title 必填，title 最多 300 字符；url 可省略，若填写只接受 http/https 且最多 2,000 字符；license 最多 200 字符。卡片的 sourceRefs 必须引用已有来源。来源元数据不代替内容核对与许可原文。

## 更新、进度与兼容

1. 词册 ID、卡片 ID 与义组 ID 都应跨修订保持稳定。格式版本只在字段契约变化时改变，内容修改则提高 revision。
2. 不允许用低修订覆盖高修订；同修订仅接受与已安装对象序列化结果相同的内容。即使只调整字段顺序，也建议提高 revision。
3. 修改词目、短释义、完整义组、卡片类型或 acceptedAnswers，会取消该卡片的掌握状态并重新加入待学；统计和未变条目的进度保留。
4. 修改音标、标签、来源或注释不会重置掌握状态。重排卡片不影响身份，当前轮次保持已有顺序，新轮采用新词册顺序。
5. 新条目加入待学，删除条目退出队列与回顾。来源修正不应复用一个已被赋予完全不同知识内容的 ID。
6. v1 词册和早期 `.jsonl` 仍可导入，按原字段读取；不会偷偷把扁平释义猜成结构化多义词典。正式迁移 v1 到 v2 时保留词册 / 卡片 ID，提高 revision。
7. 完整备份独立使用 `lexora.backup / schemaVersion: 1`，可包含 v1 和 v2 词册；恢复时逐本校验。词册内容与个人进度始终分开。

导入的 UTF-8 JSON 单文件上限 10 MiB、每册 50,000 条，手帖最多 100 本；完整备份文件上限 50 MiB。JSONL 适配仅用于早期格式，不作为另一套新增标准。

运行 `npm test` 校验结构、引用、兼容、修订规则和首个完整样例；`python data/build_first_dictionary.py` 从固定来源重新生成样例。格式通过不等于释义已经专家校订。
