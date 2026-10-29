# 诗歌加载来源

直接复用[个人文档站](https://github.com/Qrzzzz/Qrzzzz.github.io)的 `docs/.vitepress/theme/`：

- `loadingPoemRuntime.mjs` 原样复制到 `src/loading/poem-player.js`。
- `SiteLoading.vue` 的 `<style scoped>` 内容原样复制到 `src/loading/original-loading.css`，原组件保存在本目录。
- `loadingPoems.mjs` 与 `homePoems.json` 的 250 首诗，保留 ID、文字、语言、分行与类型，合并为 `src/loading/poems.js`。

`source.json` 固定来源内容的 SHA-256，测试防止后续误改。仅页面接入层改为原生 HTML：不引入 Vue/VitePress，等待本地进度和静态词册就绪后结束加载；慢速首次加载可选择先开始或重试。适配层映射纸色、文字色与本站思源宋体，并将加载提示与署名字号提高到 16px；原播放器、诗库和样式文件保留原样。
