import { readFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { verifySession } from "@/lib/auth"

export const runtime = "nodejs"

const TEMPLATE_PATH = "templates/agregados-template.xlsx"
const SHEET_NAME = "ANALITICO"
const DATA_START_ROW = 4

type ExportRow = {
  colaborador: string
  funcao: string
  contrato: string
  centroCusto: string
  veiculo: string
  placa: string
  anoModelo: string
  valorLocacao: number
  dias: number
  observacao: string
}

type ExportPayload = {
  rows: ExportRow[]
  competencia?: string | null
}

async function loadTemplate(req: Request): Promise<Buffer> {
  try {
    return await readFile(path.join(process.cwd(), "public", TEMPLATE_PATH))
  } catch {
    const response = await fetch(new URL(`/${TEMPLATE_PATH}`, req.url))
    if (!response.ok) {
      throw new Error("Modelo da planilha de agregados não encontrado.")
    }
    return Buffer.from(await response.arrayBuffer())
  }
}

function countTemplateDataRows(worksheet: ExcelJS.Worksheet): number {
  let count = 0
  let rowNumber = DATA_START_ROW

  while (typeof worksheet.getCell(rowNumber, 1).value === "number") {
    count += 1
    rowNumber += 1
  }

  return count
}

function formatCompetencia(value: string | null | undefined): string | null {
  if (!value) return null

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null

  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(date)
    .replace(" de ", "/")

  return `COMPETÊNCIA: ${label.toUpperCase()}`
}

export async function POST(req: Request) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const payload = (await req.json()) as ExportPayload
    const rows = Array.isArray(payload?.rows) ? payload.rows : []

    if (rows.length === 0) {
      return NextResponse.json({ error: "Nenhum agregado para exportar." }, { status: 400 })
    }

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(await loadTemplate(req))

    // O ExcelJS grava regras "duplicateValues" como <conditionalFormatting/> vazio e o Excel acusa arquivo corrompido.
    for (const sheet of workbook.worksheets) {
      sheet.conditionalFormattings = []
    }

    const worksheet = workbook.getWorksheet(SHEET_NAME) ?? workbook.worksheets[0]
    if (!worksheet) {
      throw new Error("Aba ANALITICO não encontrada no modelo.")
    }

    const templateRows = countTemplateDataRows(worksheet)

    if (rows.length > templateRows) {
      worksheet.duplicateRow(DATA_START_ROW + templateRows - 1, rows.length - templateRows, true)
    } else if (rows.length < templateRows) {
      worksheet.spliceRows(DATA_START_ROW + rows.length, templateRows - rows.length)
    }

    rows.forEach((row, index) => {
      const rowNumber = DATA_START_ROW + index
      const target = worksheet.getRow(rowNumber)

      target.getCell(1).value = index + 1
      target.getCell(2).value = row.colaborador ?? ""
      target.getCell(3).value = row.funcao ?? ""
      target.getCell(4).value = row.contrato ?? ""
      target.getCell(5).value = row.centroCusto ?? ""
      target.getCell(6).value = row.veiculo ?? ""
      target.getCell(7).value = row.placa ?? ""
      target.getCell(8).value = row.anoModelo ?? ""
      target.getCell(9).value = Number(row.valorLocacao) || 0
      target.getCell(10).value = Number(row.dias) || 0
      target.getCell(11).value = { formula: `I${rowNumber}/30` }
      target.getCell(12).value = { formula: `K${rowNumber}*J${rowNumber}` }
      target.getCell(13).value = row.observacao ?? ""
      target.commit()
    })

    const lastDataRow = DATA_START_ROW + rows.length - 1
    worksheet.getCell("C2").value = { formula: `SUM(L${DATA_START_ROW}:L${lastDataRow})` }
    worksheet.autoFilter = `B3:M${lastDataRow}`

    const competenciaLabel = formatCompetencia(payload?.competencia)
    if (competenciaLabel) {
      for (let rowNumber = lastDataRow + 1; rowNumber <= lastDataRow + 6; rowNumber += 1) {
        const cell = worksheet.getCell(rowNumber, 2)
        if (typeof cell.value === "string" && cell.value.toUpperCase().startsWith("COMPET")) {
          cell.value = competenciaLabel
          break
        }
      }
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const fileName = `AGREGADOS_${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao exportar a planilha de agregados." },
      { status: 500 }
    )
  }
}
