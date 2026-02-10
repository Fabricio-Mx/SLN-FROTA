import { NextResponse } from "next/server"
import path from "node:path"
import fs from "node:fs/promises"
import PizZip from "pizzip"
import Docxtemplater from "docxtemplater"
// @ts-ignore
import libre from "libreoffice-convert"
import { promisify } from "util"

const convertAsync = promisify(libre.convert)

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "termo",
  "Termo de Responsabilidade.docx",
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const name = searchParams.get("name") || ""
  const inumber = searchParams.get("inumber") || ""
  const date = searchParams.get("date") || ""
  const md = searchParams.get("md") || ""
  const plc = searchParams.get("plc") || ""

  if (!name || !inumber || !date || !md || !plc) {
    return new NextResponse(
      `<html><body><h1>Dados incompletos</h1><p>Preencha todos os campos do colaborador e veiculo.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } },
    )
  }

  let content: Buffer
  try {
    content = await fs.readFile(TEMPLATE_PATH)
  } catch {
    return new NextResponse(
      `<html><body><h1>Erro</h1><p>Modelo do termo nao encontrado.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } },
    )
  }

  try {
    const zip = new PizZip(content)
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    })

    doc.setData({ name, inumber, date, md, plc })
    doc.render()

    const docxBuffer = doc.getZip().generate({ 
      type: "nodebuffer",
      compression: "DEFLATE"
    })

    // Convert docx to PDF preserving all formatting
    const pdfBuffer = await convertAsync(docxBuffer, ".pdf", undefined)

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Termo_${plc}.pdf"`,
      },
    })
  } catch (err) {
    return new NextResponse(
      `<html><body><h1>Erro</h1><p>Falha ao processar o termo: ${err instanceof Error ? err.message : "Erro desconhecido"}</p><p>Certifique-se de que o LibreOffice esta instalado no sistema.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } },
    )
  }
}
