import { NextResponse } from "next/server"
import { extractText, getDocumentProxy } from "unpdf"
import { verifySession } from "@/lib/auth"
import { findCrlvFile, parseCrlvText } from "@/lib/crlv-validade"
import { describeDriveError, getDriveClients, readDriveFileContent, type GoogleDriveClient } from "@/lib/google-drive"
import { createAdminClient } from "@/lib/supabase/admin"
import type { CrlvAnalise, DriveFile } from "@/lib/types"

export const runtime = "nodejs"
export const maxDuration = 60

const MAX_VEICULOS_POR_REQUISICAO = 10

type VehicleRow = {
  id: string
  placa: string
  imagens: DriveFile[] | null
  checklists: DriveFile[] | null
}

async function readFromDrive(drives: GoogleDriveClient[], fileId: string): Promise<Buffer> {
  let lastError: unknown = null
  for (const drive of drives) {
    try {
      return await readDriveFileContent(drive, fileId)
    } catch (error) {
      lastError = error
    }
  }
  throw new Error(describeDriveError(lastError))
}

async function analisarPdf(content: Buffer): Promise<Omit<CrlvAnalise, "analisadoEm">> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(content))
    const { text } = await extractText(pdf, { mergePages: true })
    return parseCrlvText(text)
  } catch {
    return { exercicio: null, uf: null, placa: null, emitidoEm: null, erro: "Arquivo não é um PDF legível." }
  }
}

function withAnalise(files: DriveFile[] | null, fileId: string, analise: CrlvAnalise): DriveFile[] | null {
  if (!Array.isArray(files)) return files
  return files.map((file) => (file?.id === fileId ? { ...file, crlvAnalise: analise } : file))
}

export async function POST(req: Request) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const body = (await req.json().catch(() => ({}))) as { vehicleIds?: unknown; force?: unknown }
    const vehicleIds = Array.isArray(body.vehicleIds)
      ? body.vehicleIds.filter((id): id is string => typeof id === "string").slice(0, MAX_VEICULOS_POR_REQUISICAO)
      : []
    const force = body.force === true

    if (vehicleIds.length === 0) {
      return NextResponse.json({ error: "Informe os veículos a analisar." }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("fleet_vehicles")
      .select("id, placa, imagens, checklists")
      .in("id", vehicleIds)

    if (error) throw new Error(error.message)

    const drives = await getDriveClients()
    const resultados: { vehicleId: string; fileId: string | null; analise: CrlvAnalise | null; erro?: string }[] = []

    for (const row of (data ?? []) as VehicleRow[]) {
      const arquivo = findCrlvFile({ imagens: row.imagens ?? [], checklists: row.checklists ?? [] })
      if (!arquivo) {
        resultados.push({ vehicleId: row.id, fileId: null, analise: null, erro: "CRLV não anexado." })
        continue
      }

      if (arquivo.crlvAnalise && !force) {
        resultados.push({ vehicleId: row.id, fileId: arquivo.id, analise: arquivo.crlvAnalise })
        continue
      }

      let analise: CrlvAnalise
      try {
        const content = await readFromDrive(drives, arquivo.id)
        analise = { ...(await analisarPdf(content)), analisadoEm: new Date().toISOString() }
      } catch (readError) {
        // Falha de acesso ao Drive não é gravada, para que a análise seja tentada novamente depois.
        resultados.push({
          vehicleId: row.id,
          fileId: arquivo.id,
          analise: null,
          erro: readError instanceof Error ? readError.message : "Falha ao baixar o CRLV.",
        })
        continue
      }

      const { error: updateError } = await supabase
        .from("fleet_vehicles")
        .update({
          imagens: withAnalise(row.imagens, arquivo.id, analise),
          checklists: withAnalise(row.checklists, arquivo.id, analise),
        })
        .eq("id", row.id)

      resultados.push({
        vehicleId: row.id,
        fileId: arquivo.id,
        analise,
        erro: updateError ? updateError.message : undefined,
      })
    }

    return NextResponse.json({ resultados })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
