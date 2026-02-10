import { NextResponse } from "next/server"
import path from "node:path"
import fs from "node:fs/promises"
import PizZip from "pizzip"
import Docxtemplater from "docxtemplater"

type TermoPayload = {
  name?: string
  inumber?: string
  date?: string
  md?: string
  plc?: string
  fileName?: string
}

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "termo",
  "Termo de Responsabilidade.docx",
)

const sanitizeFileName = (value: string) => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

export async function POST(req: Request) {
  let body: TermoPayload | null = null
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Payload invalido." }, { status: 400 })
  }

  const { name, inumber, date, md, plc, fileName } = body || {}

  if (!name || !inumber || !date || !md || !plc) {
    return NextResponse.json(
      { error: "Dados incompletos para gerar o termo." },
      { status: 400 },
    )
  }

  let content: Buffer
  try {
    content = await fs.readFile(TEMPLATE_PATH)
  } catch {
    return NextResponse.json(
      { error: "Modelo do termo nao encontrado." },
      { status: 500 },
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

    const buffer = doc.getZip().generate({ type: "nodebuffer" })
    const fallbackName = `Termo_${name}_${plc}.docx`
    const safeName = sanitizeFileName(fileName || fallbackName)

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${safeName}"`,
      },
    })
  } catch {
    return NextResponse.json(
      { error: "Falha ao gerar o termo." },
      { status: 500 },
    )
  }
}
