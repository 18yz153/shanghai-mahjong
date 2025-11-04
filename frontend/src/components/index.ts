// src/assets/svg/index.ts
// 自动导入所有 SVG 文件，并导出一个映射表
const svgContext = import.meta.glob('./*.svg', { eager: true, as: 'url' })

export const TILE_SVGS: Record<string, string> = {}

for (const path in svgContext) {
  // 取文件名，不带扩展名
  const fileName = path.split('/').pop()?.replace('.svg', '')
  if (fileName) {
    TILE_SVGS[fileName] = svgContext[path] as string
  }
}
