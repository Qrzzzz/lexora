# 首个词册样例的数据来源与许可

`examples/first-dictionary.json` 完整转换自 **grhliu/wordtyper-vocabularies** 的
`vocabularies/cet4.json`，源词册名为「CET-4 核心词汇」，版本 `2.0.0`。
词目共 3815 个；未抽样、未增补、未筛除。

- 固定提交：`b5790cafcad1795873410e984c834ef1ddac20ac`
- [固定源文件](https://github.com/grhliu/wordtyper-vocabularies/blob/b5790cafcad1795873410e984c834ef1ddac20ac/vocabularies/cet4.json)
- SHA-256：`568b5203eb6b48bdecf8deb8d5ad3bc6546b7960c72e9eafcd877242b6b70105`
- 源文件 717511 字节，随仓库保存在 `data/sources/wordtyper-cet4/cet4.json`。
- 本地确定性转换脚本：`data/build_first_dictionary.py`。

上游 README 和 NOTICE 声明全部词库由 ECDICT 客观派生，并采用 MIT 许可。
已保留该固定提交中的原始 README、NOTICE、LICENSE：
`data/sources/wordtyper-cet4/`。许可证版权声明为 **Copyright (c) 2025 Linwei**。
同时核对并保留 ECDICT 提交 `ab22ad36302cafc6349a050e2b60894855208055`
的 [LICENSE](https://github.com/skywind3000/ECDICT/blob/ab22ad36302cafc6349a050e2b60894855208055/LICENSE)，
存于同目录的 `ECDICT-LICENSE`。两者均为 MIT。

上游没有在该词表中记录具体 ECDICT 数据提交，且其生成脚本在另一主仓库；
因此本项目只能复现固定 WordTyper 发布文件到 Lexora 词册的转换，
不能声称已经独立复现 ECDICT 到 WordTyper 的筛选过程。
本项目未引入 ECDICT 完整数据库。

本词册是该来源的四级核心词表，不是官方考试机构发布或认可的完整大纲。
保留源数据中的拼写、领域标签和旧式音标，未作专家校订；
例如 `reservior`、`uptodate` 按原始词目保留。
来源没有区分英式与美式音标，统一标 `general`；缺失音标留空数组。
音标值原样保留，`ipa` 是格式系统标记，不表示已按现代 IPA 规范校订。

转换将每条源 `translations` 行保存为一个 sense，识别行首明确给出的词性，
保留 `a.`、`vt.`、`vi.vt.` 等源标记；没有明确词性的领域释义或词形说明标为
`other`，不根据相邻释义推断。逗号后空白、分号后空白以及中文逗号/分号
仅作为义项分隔符，全部内容按原顺序保留。领域标签不删除。
简短释义从第一条源释义最多摘取前三个完整义项，总长不超过 32 个 Unicode 字符；
第一义项超过上限时取前 31 字符加省略号。不会为了凑足长度扩写。
完整释义始终保存在 senses。

再分发词册或源数据时须一并保留上述 MIT 版权和许可文本。
