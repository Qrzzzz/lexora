# WordTyper Vocabularies

WordTyper iOS App 的远程词库仓库。

## 数据合规

全部词库由 [ECDICT](https://github.com/skywind3000/ECDICT)（MIT License）客观派生，
不含任何商业词典、词汇书的受版权保护内容。详见 [NOTICE.md](./NOTICE.md)。

## 词库清单

| ID | 名称 | 分类 |
|---|---|---|
| cet4 / cet4_high_freq | CET-4 核心/高频词汇 | 大学英语 |
| cet6 / cet6_high_freq | CET-6 核心/高频词汇 | 大学英语 |
| kaoyan / kaoyan_high_freq | 考研核心/高频词汇 | 考研 |
| toefl / toefl_high_freq | TOEFL 核心/高频词汇 | 出国考试 |
| ielts_core / ielts_basic / ielts_advanced | IELTS 核心/基础/高级词汇 | 出国考试 |
| gre / gmat / sat | GRE/GMAT/SAT 核心词汇 | 专业英语 |

## JSON Schema

```json
{
  "name": "CET-4 核心词汇",
  "description": "...",
  "category": "大学英语",
  "icon": "🎓",
  "wordCount": 3815,
  "version": "2.0.0",
  "updatedAt": "2026-07-27",
  "words": [
    { "word": "abandon", "phonetic": "/ə'bændən/", "translations": ["vt. 放弃, 抛弃"] }
  ]
}
```
