# SystemC 词汇来源与整理

原表为用户提供的 `SystemC_英语单词翻译表.xlsx`，两列为「英语单词」「中文翻译」，除表头共 219 条。`entries.json` 保存原始顺序、英中对应关系与原文件 SHA-256；不发布原始工作簿。

## 词形与释义

`curation.json` 记录 9 个规则复数的还原规则，如 abbreviations → abbreviation、differences → difference。arguments 与已有 argument 合并，最终 218 条；其余原序不变。不机械删除 bus、data 等词，保留技术缩写与原表单条中文释义。stimulus 的词条另注明不规则复数 stimuli。没有额外添加例句。

## 音标与词性

常规词参考 [ECDICT 固定版本](https://github.com/skywind3000/ECDICT/tree/ab22ad36302cafc6349a050e2b60894855208055)，`ecdict-subset.json` 保留所用候选词条及固定版本、源 CSV SHA-256，附 `ECDICT-LICENSE`（MIT）。原表中文释义不被通用词典释义替换。沿用词典音标，统一重音符号及长音符号，来源未可靠区分英美时标为 general。

`editorial.json` 单独记录缩写、复合词及词典缺项的音标、词性与编校说明。如 DUT、VCD、WLF 采用字母拼读；RAM 采用常见连读；SystemC 为 System 加字母 C。缩写可能另有行业读法，本词册记录采用的读法而非声称唯一读法。CPP 按原表 C++ 含义读作 C plus plus，不套用同名普通词条。

源表没有附带上游来源或数据许可声明，不为其添加未经确认的第三方许可；ECDICT 补充数据按自身 MIT 许可保留署名。

## 重建

运行 `python data/build_systemc_dictionary.py`，从提交的快照与编校数据重建 `examples/systemc-dictionary.json`，无需联网。刷新 Excel 快照使用 `--xlsx <路径>`；已发布内容更新时递增 revision。条目 ID 由归一后的词目 SHA-256 派生，内容修订保持稳定 ID。
