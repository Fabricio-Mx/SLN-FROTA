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

    doc.setData({ name, inumber, date, md, plc })
    doc.render()

    // Extract text from docx for HTML display
    const text = doc.getFullText()
    
    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Termo de Responsabilidade - ${plc}</title>
    <style>
        @media print {
            body { margin: 0; }
            .no-print { display: none; }
        }
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            line-height: 1.6;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .header h1 {
            font-size: 24px;
            margin-bottom: 10px;
        }
        .content {
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .button-container {
            text-align: center;
            margin: 30px 0;
        }
        button {
            background: #7CB342;
            color: white;
            border: none;
            padding: 12px 24px;
            font-size: 16px;
            border-radius: 6px;
            cursor: pointer;
        }
        button:hover {
            background: #689F38;
        }
        .info {
            background: #f5f5f5;
            padding: 15px;
            margin: 20px 0;
            border-radius: 6px;
        }
        .info strong {
            display: inline-block;
            width: 120px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Termo de Responsabilidade</h1>
    </div>
    
    <div class="info">
        <p><strong>Colaborador:</strong> ${name}</p>
        <p><strong>CPF:</strong> ${inumber}</p>
        <p><strong>CNH vencimento:</strong> ${date}</p>
        <p><strong>Veículo:</strong> ${md}</p>
        <p><strong>Placa:</strong> ${plc}</p>
    </div>

    <div class="content">${text.replace(/name/g, name).replace(/inumber/g, inumber).replace(/date/g, date).replace(/md/g, md).replace(/plc/g, plc)}</div>

    <div class="button-container no-print">
        <button onclick="window.print()">Imprimir Termo</button>
    </div>

    <script>
        // Auto-open print dialog after page loads
        window.addEventListener('load', function() {
            setTimeout(function() {
                // window.print();
            }, 500);
        });
    </script>
</body>
</html>
    `

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  } catch (err) {
    return new NextResponse(
      `<html><body><h1>Erro</h1><p>Falha ao processar o termo: ${err instanceof Error ? err.message : "Erro desconhecido"}</p></body></html>`,
      { headers: { "Content-Type": "text/html" } },
    )
  }
}
