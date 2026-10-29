# Lexora

导入自己的词汇与知识卡片，在浏览器中学习。

Lexora 已从 iOS 构想转为纯静态 Web 项目。首页沿用原型的居中大字、释义与留白；没有账号、后端、广告或云同步。内容和进度保存在当前浏览器的 IndexedDB。

## 当前能力

- JSON 词册导入、格式校验与确认预览；兼容仓库早期 `test.jsonl`。
- 多词册独立进度、翻面回想、词汇拼写、原序 / 乱序。
- 复用原型的斩词切片、飞散与翻页动效，补充少量方块粒子、反向撤回与可点击回顾。
- 桌面键盘 / 鼠标操作，移动端常显触控按钮；动效跟随系统减少动态效果设置，也可关闭。
- 设置、词册、条目与备份使用页面内视图，没有弹窗。
- 默认原版黑白；可选的浅色与纸纹仍是待调整试样。
- 自托管思源宋体可变字体，全站共用，支持 200–900 字重；[字体来源与许可](assets/FONTS.md)。
- 手动导出当前词册，或导出 / 恢复包含所有词册、进度和偏好的完整备份。

**暂无公共词库。** 内置三条卡片只用于演示格式，不代表四六级或专业词汇表。网站不调用 AI API。

## 本地运行

需要 Node.js 22 或更高版本：

```sh
npm ci
npm run dev
```

打开终端显示的本地地址，默认是 `http://127.0.0.1:4173`。运行时没有第三方 JavaScript 依赖，开发依赖 Ajv 仅用于 Schema 回归测试。

这是使用 ES modules 的静态网站，应通过 HTTP(S) 访问。不要直接双击 `index.html` 用 `file://` 打开。

## 词册格式

```json
{
  "format": "lexora.deck",
  "schemaVersion": 1,
  "id": "my-notebook",
  "revision": 1,
  "title": "我的词册",
  "cards": [
    { "id": "retain", "type": "vocabulary", "prompt": "retain", "answer": "保留；记住" },
    { "id": "retrieval", "type": "knowledge", "prompt": "什么是主动回忆？", "answer": "不看答案，从记忆中提取内容。" }
  ]
}
```

[完整规范](docs/deck-format.md) · [JSON Schema 2020-12](schemas/deck-v1.schema.json) · [可导入示例](examples/notebook.json)

卡片和词册 ID 是稳定身份，不能随着排序改变。更新词册时提高 revision；未变条目的进度保留，题面、答案或接受写法变化的条目重新学习。纯文本呈现，不执行导入内容里的 HTML 或代码。

## 操作

手机直接点按底部按钮。桌面把指针移到学习区可显示按钮，也可以用快捷键：

| 按键 | 动作 |
| --- | --- |
| Enter / Space | 显隐答案；拼写模式检查 / 继续 |
| J / ← | 留到下一轮 |
| X / → | 斩去已掌握条目 |
| U | 撤回本次打开期间的最近操作，最多 30 步，受内存预算限制 |
| S / B | 设置 / 词册 |
| Esc | 返回学习或退出回顾 |

回顾只展示刚刚读过的卡片，不会跳转学习队列。回顾中可以明确恢复或斩去条目，该操作可以撤回。

## 数据边界

本地导入文件不上传。浏览器数据不跨设备同步，清理站点数据会删除词册和进度。建议按需自行导出完整备份；恢复前会预览并要求确认替换。

本地保存失败会显示持久提示；读取损坏数据时进入临时示例，不自动覆盖旧记录。早期独立原型的学习备份不包含词库本体，本版尚未做其进度迁移。

## 检查与部署

```sh
npm test
node scripts/package-site.mjs
```

第二条命令只生成 `output/site/`。可把该目录交给任何静态托管服务。所有资源使用相对路径，适配 GitHub Pages 的 `/lexora/` 项目路径。

仓库提供自动检查工作流，以及**手动触发**的 `Publish GitHub Pages` 工作流。首次发布先在仓库 Settings → Pages 中选择 GitHub Actions，然后在 Actions 中手动运行发布工作流。推送代码只执行检查，不自动发布网站。

## 项目结构

```text
src/deck.js       格式解析、语义校验、早期 JSONL 适配
src/model.js      词册、学习队列、更新与备份规则
src/storage.js    IndexedDB 持久化
src/motion.js     原版动效移植及新增撤回 / 回顾动效
src/app.js        页面交互
src/style.css     原版视觉基础与移动适配
schemas/         独立的词册格式契约
tests/           格式和学习状态回归测试
docs/            规范、验证记录、早期 iOS 构想存档
```

[贡献说明](CONTRIBUTING.md) · [早期 iOS 构想存档](docs/ios-concept.md)

## 许可

沿用仓库原有 [Lexora Non-Commercial License](LICENCE)。字体另遵循其 [SIL Open Font License](assets/FONT-LICENSE.txt)。
