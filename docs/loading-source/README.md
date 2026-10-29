# 诗歌加载来源

直接复用[个人文档站](https://github.com/Qrzzzz/Qrzzzz.github.io)的 `docs/.vitepress/theme/`：

- `loadingPoemRuntime.mjs` 原样复制到 `src/loading/poem-player.js`。
- `SiteLoading.vue` 的 `<style scoped>` 内容原样复制到 `src/loading/original-loading.css`，原组件保存在本目录。
- `loadingPoems.mjs` 与 `homePoems.json` 的 250 首诗，保留 ID、文字、语言、分行与类型，合并为 `src/loading/poems.js`。

`source.json` 固定来源内容的 SHA-256，测试防止后续误改。不引入 Vue/VitePress。静态 HTML 直接放入首首原诗作为无 JavaScript 的兜底，播放器以独立模块提前启动；进入首页只等待本地数据，用户选择样例后才下载词册，并可返回。适配层映射文档站配色与本站思源宋体，加载提示与署名字号为 16px；原播放器、诗库和样式文件保留原样。
