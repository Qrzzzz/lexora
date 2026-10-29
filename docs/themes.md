# 主题色机制

「深浅模式」与「主题色」分开保存。模式为随系统 / 浅色 / 深色，切换时不改变已选色号。

六个预设：蓝色、绛红、松绿、大地、雾紫、黑白。相近的深红与粉色、墨绿与淡绿、棕褐与米黄、暗紫与薰衣草色分别收敛为同一色系的深浅变化。自选支持色盘及 `#RGB` / `#RRGGBB`，输入也可省略井号；确认或离开输入框后生效。非法输入保留原配色。

## 一个色号生成两版

```js
import { generatePalette } from "../src/themes.js";
const light = generatePalette("#B43B53", "light");
const dark = generatePalette("#B43B53", "dark");
```

算法先将 sRGB 转到 [OKLCH](https://www.w3.org/TR/css-color-4/#color-conversion-code)，保留色相，限制彩度，以统一明度曲线生成背景、正文、释义、边框、强调色和荧光笔颜色。超出 sRGB 色域时降低彩度，不分别截断 RGB 通道。近中性色保留中性，不人为染色。

生成后检查正文、释义、辅助文字和强调色相对背景、表层、选中底色的对比度，必要时继续调整明度。正文至少 7.5:1，释义至少 5:1，辅助文字与强调色至少 4.6:1；这些是颜色令牌的约束，并非全站无障碍认证。[WCAG 对比度说明](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)。

操作图标的绿、黄、蓝保留其动作含义；黑白预设则将图标、错误状态及荧光笔全部转为中性色，主背景分别为纯白与纯黑。二维码始终保持黑白与完整留白。

## 设置与兼容

```json
{
  "appearance": "system",
  "colorTheme": "custom",
  "customColor": "#b43b53"
}
```

三个字段随完整备份保存。旧 `theme: white / night` 分别迁移为浅色蓝系 / 深色蓝系，`system / paper / mist` 迁移为随系统蓝系；词册、队列与学习进度不变。

新增预设只需在 `themePresets` 中添加 `{ label, color }`。控件和备份校验自动使用注册表，分享海报直接使用当前生成结果。算法或默认蓝色改变时，运行 `npm run themes` 更新 `src/themes.css`，供 JavaScript 启动前的首屏使用；测试会检查生成文件一致性。运行时无第三方颜色库或在线配色服务。
