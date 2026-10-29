# 首个完整词册样例

`examples/first-dictionary.json` 是可直接导入的 `lexora.deck` v2 词册，
名称为「WordTyper 四级核心词表（3815 词）」。它完整转换固定版本的
WordTyper CET-4 核心词汇，不代表官方四级大纲全部词汇，也没有抽取部分词目。

来源、固定提交、源文件散列和再分发要求见 [数据声明](../data/NOTICE.md)，
MIT 原文和上游来源声明保存在 `data/sources/wordtyper-cet4/`。
上游未给出具体 ECDICT 数据提交，当前可复现边界是固定 WordTyper 文件到词册。

## 重现

需要 Python 3（仅标准库）。在仓库目录执行：

```powershell
python data/build_first_dictionary.py
```

脚本优先读随仓库保存的 701 KiB 源词表，校验固定 SHA-256，生成 UTF-8 JSON，
然后输出验证统计。若本地源词表不存在，会从固定提交下载；
直接 HTTPS 失败时尝试使用已经登录的 `gh api`，仍会核对同一散列。
脚本不安装依赖、不访问模型、不下载 ECDICT 完整数据库。
同一源文件始终生成同一输出，词目和顺序全部保留；ID 由源词目 SHA-256
前 16 位加稳定词册前缀生成，并验证不存在碰撞。

## 实际生成结果

| 检查项 | 数量 |
| --- | ---: |
| 卡片 / 唯一 ID / 唯一词目 | 3815 / 3815 / 3815 |
| 源释义行 / 输出 senses | 8186 / 8186 |
| 有音标 | 3805（99.74%） |
| 缺音标 | 10 |
| 至少两个明确词性（不计 other） | 1836 |
| 至少两个分隔后的义项 | 3689 |
| 缺明确词性的释义行（other） | 1550 |
| 含 other 的词目 | 1548 |
| 所有释义均为 other 的词目 | 2 |
| 简短释义最大长度 | 23 个 Unicode 字符 |

缺音标词目为 `living-room`、`reservior`、`so-called`、`surprisingly`、
`theatre`、`uptodate`、`videotape`、`waggon`、`well-known`、`world-wide`。
未伪造音标、词性或例句，未修正源拼写。多义统计衡量源列表按显式分隔符
拆分后的数量，不是经词典学审定的独立义项数量。

短释义只用于首屏阅读，按源义项摘取而非生成摘要；常见简单词可以只有一两字，
最多摘取第一组的前三个完整义项，总长不超过 32 个 Unicode 字符，首义超长时
保留前 31 字符加省略号。不会为了凑足长度扩写。所有词性与完整多义释义均在 senses 中。
来源没有口音标签，音标以 `general` 原样保留，包含上游旧式转写。

输出 SHA-256：
`e5cd179bcdc7bad53d82f69437d560de63335fc4c675fbe097be48f18ec65c76`。
