import { NextResponse } from "next/server"
import path from "node:path"
import fs from "node:fs/promises"
import PizZip from "pizzip"
import Docxtemplater from "docxtemplater"

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

    // Abbreviated name: first name + middle initials + last name
    // Example: "Uelison da Silva Ferreira Couto" → "Uelison da S. F. Couto"
    const nameParts = name.trim().split(" ").filter(part => part.length > 0)
    let name2 = name
    
    if (nameParts.length > 2) {
      const firstName = nameParts[0]
      const lastName = nameParts[nameParts.length - 1]
      const middleNames = nameParts.slice(1, -1)
      
      const middleInitials = middleNames.map(part => {
        // Keep small words (da, de, do, das, dos) as is
        if (part.toLowerCase() === 'da' || part.toLowerCase() === 'de' || 
            part.toLowerCase() === 'do' || part.toLowerCase() === 'das' || 
            part.toLowerCase() === 'dos') {
          return part.toLowerCase()
        }
        return part.charAt(0).toUpperCase() + '.'
      }).join(' ')
      
      name2 = `${firstName} ${middleInitials} ${lastName}`
    }

    doc.setData({ name, name2, inumber, date, md, plc })
    doc.render()

    const docxBuffer = doc.getZip().generate({ 
      type: "nodebuffer",
      compression: "DEFLATE"
    })

    // Return the filled docx file to be opened in Word/browser
    return new NextResponse(Buffer.from(docxBuffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `inline; filename="Termo de ${name}.docx"`,
      },
    })
  } catch (err) {
    return new NextResponse(
      `<html><body><h1>Erro</h1><p>Falha ao processar o termo: ${err instanceof Error ? err.message : "Erro desconhecido"}</p><p>Certifique-se de que o LibreOffice esta instalado no sistema.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } },
    )
  }
}
