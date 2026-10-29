import { localDay } from "./model.js";
import { resolveTheme } from "./themes.js";
import { links } from "./config.js";
import { qrRows } from "./share-qr.js";

export function todayStudyCount(workspace, date = new Date()) {
  const day = localDay(date);
  return workspace.progress.reduce((sum, p) => sum + (p.daily[day] || 0), 0);
}
export async function createStudyPoster({
  count,
  date = new Date(),
  colors = resolveTheme().tokens,
}) {
  await document.fonts.load('900 64px "Source Han Serif"').catch(() => {});
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1440;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = colors.paper;
  ctx.fillRect(0, 0, 1080, 1440);
  const font = (size, weight = 500) => {
    ctx.font = `${weight} ${size}px "Source Han Serif", serif`;
  };
  const text = (value, x, y, size, color = colors.ink, weight = 500) => {
    font(size, weight);
    ctx.fillStyle = color;
    ctx.fillText(value, x, y);
  };
  text("今日学习", 72, 144, 54);
  const day = localDay(date).replaceAll("-", ".");
  font(44);
  ctx.fillStyle = colors.muted;
  ctx.textAlign = "right";
  ctx.fillText(day, 1008, 142);
  ctx.textAlign = "left";
  const value = String(count);
  let size = 660;
  font(size, 900);
  while (ctx.measureText(value).width > 936) {
    size -= 4;
    font(size, 900);
  }
  // The same count becomes the only graphic: offset translucent impressions.
  ctx.save();
  ctx.globalAlpha = 0.08;
  text(value, 30, 918, size * 1.08, colors.accent, 900);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.16;
  text(value, 108, 760, size, colors.accent, 900);
  ctx.restore();
  text(value, 72, 838, size, colors.ink, 900);
  text("词次", 80, 978, 54, colors.meaning);
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(72, 1064);
  ctx.lineTo(1008, 1064);
  ctx.stroke();
  const box = { x: 72, y: 1128, size: 240 },
    quiet = 4,
    cell = box.size / (qrRows.length + quiet * 2);
  ctx.fillStyle = colors["qr-paper"];
  ctx.fillRect(box.x, box.y, box.size, box.size);
  ctx.fillStyle = colors["qr-ink"];
  for (let y = 0; y < qrRows.length; y++)
    for (let x = 0; x < qrRows.length; x++)
      if (qrRows[y][x] === "1") {
        const left = Math.round(box.x + (x + quiet) * cell),
          top = Math.round(box.y + (y + quiet) * cell);
        const right = Math.round(box.x + (x + quiet + 1) * cell),
          bottom = Math.round(box.y + (y + quiet + 1) * cell);
        ctx.fillRect(left, top, right - left, bottom - top);
      }
  text("Lexora", 352, 1195, 64, colors.ink, 650);
  text("扫码访问", 354, 1264, 44, colors.meaning);
  text(
    links.app.replace("https://", "").replace(/\/$/, ""),
    354,
    1332,
    44,
    colors.ink,
  );
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(Error("海报生成失败"))),
      "image/png",
    ),
  );
}
export async function copyStudyPoster(workspace, colors, environment = window) {
  const date = new Date(),
    count = todayStudyCount(workspace, date);
  const poster = createStudyPoster({ count, date, colors });
  // Submit the promise while the click gesture is still active (Safari included).
  if (environment.ClipboardItem && environment.navigator.clipboard?.write) {
    try {
      await environment.navigator.clipboard.write([
        new environment.ClipboardItem({ "image/png": poster }),
      ]);
      return { copied: true, count };
    } catch {
      /* A browser may expose the API but deny image clipboard writes. */
    }
  }
  const blob = await poster,
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `Lexora-${localDay(date)}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return { copied: false, count };
}
