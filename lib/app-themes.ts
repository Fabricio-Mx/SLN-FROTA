export type AppThemeId = "original" | "azul" | "escuro"

export type AppThemeOption = {
  id: AppThemeId
  label: string
  description: string
}

export const APP_THEME_STORAGE_KEY = "sln-theme"
export const DEFAULT_APP_THEME: AppThemeId = "original"

export const APP_THEMES: AppThemeOption[] = [
  {
    id: "original",
    label: "Original",
    description: "As cores padrão do sistema.",
  },
  {
    id: "azul",
    label: "Azul noturno",
    description: "Fundo azul-marinho com cores vivas nos destaques.",
  },
  {
    id: "escuro",
    label: "Modo escuro",
    description: "Fundo escuro, mais confortável à noite e em ambientes com pouca luz.",
  },
]

// Classe aplicada no <html> para cada tema (ver app/globals.css).
export const APP_THEME_CLASS_MAP: Record<AppThemeId, string> = {
  original: "theme-original",
  azul: "theme-navy",
  escuro: "theme-dark",
}

export const NAVY_THEME_FILTER_ID = "sln-theme-navy"
export const NAVY_THEME_INVERSE_FILTER_ID = "sln-theme-navy-inv"

// Mesmos filtros do globals.css, usados nas miniaturas de pre-visualizacao.
export const APP_THEME_PREVIEW_FILTER: Record<AppThemeId, string> = {
  original: "none",
  azul: `url(#${NAVY_THEME_FILTER_ID})`,
  escuro: "invert(0.92) hue-rotate(180deg)",
}

// Desfaz o filtro do tema dentro da miniatura (ex.: a sidebar, que no tema real mantem as cores originais).
export const APP_THEME_PREVIEW_PRESERVE_FILTER: Record<AppThemeId, string> = {
  original: "none",
  azul: `url(#${NAVY_THEME_INVERSE_FILTER_ID})`,
  escuro: "invert(1) hue-rotate(180deg)",
}

/*
 * Azul noturno: matriz de cor afim aplicada na pagina inteira.
 * - branco vira o azul-marinho `surface`, preto vira o texto claro `text` (luminosidade invertida);
 * - a cor de cada elemento (croma) e mantida e ampliada por `chroma`, para os cartoes nao ficarem todos iguais.
 * Por ser afim, tem inversa exata: areas com [data-theme-preserve] (ex.: sidebar) mantem as cores originais.
 */
const NAVY_THEME_PARAMS = { text: "#dde6f5", surface: "#13243d", chroma: 1.7 }
const LUMA = [0.2126, 0.7152, 0.0722]

type Matrix3 = [number[], number[], number[]]

function parseHexColor(hex: string): number[] {
  return [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
}

function invertMatrix3(m: Matrix3): Matrix3 {
  const [a, b, c] = m[0]
  const [d, e, f] = m[1]
  const [g, h, i] = m[2]
  const cofA = e * i - f * h
  const cofB = -(d * i - f * g)
  const cofC = d * h - e * g
  const det = a * cofA + b * cofB + c * cofC

  return [
    [cofA / det, -(b * i - c * h) / det, (b * f - c * e) / det],
    [cofB / det, (a * i - c * g) / det, -(a * f - c * d) / det],
    [cofC / det, -(a * h - b * g) / det, (a * e - b * d) / det],
  ]
}

function toColorMatrixValues(linear: Matrix3, offset: number[]): string {
  const rows = linear.map((row, index) => [...row.map((value) => value.toFixed(6)), "0", offset[index].toFixed(6)].join(" "))
  return [...rows, "0 0 0 1 0"].join(" ")
}

export function buildNavyThemeColorMatrices(): { forward: string; inverse: string } {
  const text = parseHexColor(NAVY_THEME_PARAMS.text)
  const surface = parseHexColor(NAVY_THEME_PARAMS.surface)
  const g = NAVY_THEME_PARAMS.chroma
  const k = surface.map((value, index) => value - text[index])
  // F(x) = text + k * Y(x) + g * (x - Y(x))
  const linear = [0, 1, 2].map((row) => [0, 1, 2].map((col) => (row === col ? g : 0) + (k[row] - g) * LUMA[col])) as Matrix3
  const inverse = invertMatrix3(linear)
  const inverseOffset = inverse.map((row) => -(row[0] * text[0] + row[1] * text[1] + row[2] * text[2]))

  return {
    forward: toColorMatrixValues(linear, text),
    inverse: toColorMatrixValues(inverse, inverseOffset),
  }
}

export function isAppThemeId(value: unknown): value is AppThemeId {
  return value === "original" || value === "azul" || value === "escuro"
}
