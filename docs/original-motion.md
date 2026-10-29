# 原版动效保留

`src/original-word-motion.js` 的 `BEGIN ORIGINAL` / `END ORIGINAL` 之间，直接复制用户提供的 `词序/index.html` 中从 `let motionLayer` 到 `playWordMotion` 的完整原文，仅将 CRLF 统一为 LF。函数名、选择器、轨迹、片段数量、时序、缓动、模糊和清理时间均未改写。

原文块 SHA-256：`eca8d54140c8e0c866b78ff231d305ce73b482322702692ce2a2f2ed8be1f0b3`。

`src/original-word-motion.css` 同样直接复制原文件的动效 CSS，SHA-256：`eff66b01cf2117b3020999c2995461cbf972251815953246fc320db0d9e1237e`。

外层只注入 `$` 和 `current`：把原版 word-stage / summary-view 映射到现有学习区，master 操作映射为原版 kill。`.word-stage` 作为真实学习区的兼容类名保留。用户关闭动态效果时，由外层跳过调用；原函数仍保留自己的系统减少动态效果判断。

撤回、回顾、面板切换是新增行为，放在 `src/motion.js`，不改原版刷词和斩词函数。控件字重与荧光笔参考个人文档站 `HomeContent.vue` / `styles/home-poetry.css` 的交互方向，不复制其中延迟页面导航的逻辑，Lexora 的动作始终立即执行。

纯静态网页只能通过浏览器提供的 `navigator.vibrate` 请求震动。[兼容性说明](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate)标记其可用性有限；iPhone Safari 不支持。按用户要求，本次不进行震动设备验证，不使用绕过浏览器限制的模拟开关技巧。音效已按用户后续指示移除，只保留禁用的「后续开发」入口；无音频资源加载或播放逻辑。
