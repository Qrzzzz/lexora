import { writeFile } from "node:fs/promises";
import { themeStylesheet } from "../src/themes.js";
await writeFile(
  new URL("../src/themes.css", import.meta.url),
  themeStylesheet(),
);
console.log("Theme stylesheet generated");
