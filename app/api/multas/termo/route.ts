import { NextResponse } from "next/server"
import { verifySession } from "@/lib/auth"
import { gerarTermoDescontoPdf } from "@/lib/multa-termo-pdf"
import { getAllImportedMultas, normalizeMultaSearchText } from "@/lib/multas-import-shared"
import { loadMultasImportStore } from "@/lib/multas-import-storage"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

type ColaboradorRow = { nome: string | null; cpf: string | null }
type VehicleRow = { placa: string | null; modelo: string | null; renavan: string | null }

const normalizePlaca = (value: string | null | undefined) => (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "")

/** Procura o colaborador pelo nome do condutor: primeiro igual, depois contendo todas as palavras. */
function findColaborador(colaboradores: ColaboradorRow[], condutor: string): ColaboradorRow | null {
  const target = normalizeMultaSearchText(condutor).replace(/\s+/g, " ")
  if (!target) return null

  const exact = colaboradores.find((item) => normalizeMultaSearchText(item.nome ?? "").replace(/\s+/g, " ") === target)
  if (exact) return exact

  const tokens = target.split(" ").filter((token) => token.length > 2)
  const partial = colaboradores.filter((item) => {
    const nome = normalizeMultaSearchText(item.nome ?? "")
    return tokens.length > 1 && tokens.every((token) => nome.includes(token))
  })
  return partial.length === 1 ? partial[0] : null
}

export async function GET(req: Request) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const id = new URL(req.url).searchParams.get("id") ?? ""
    const { store } = await loadMultasImportStore()
    const multa = getAllImportedMultas(store).find((item) => item.id === id)
    if (!multa) {
      return NextResponse.json({ error: "Multa não encontrada." }, { status: 404 })
    }
    if (!multa.condutor.trim()) {
      return NextResponse.json({ error: "Informe o condutor da multa para gerar o termo." }, { status: 400 })
    }

    const supabase = createAdminClient()
    const [{ data: colaboradores }, { data: vehicles }] = await Promise.all([
      supabase.from("fleet_colaboradores").select("nome, cpf").limit(5000),
      supabase.from("fleet_vehicles").select("placa, modelo, renavan").limit(5000),
    ])

    const colaborador = findColaborador((colaboradores ?? []) as ColaboradorRow[], multa.condutor)
    const vehicle = ((vehicles ?? []) as VehicleRow[]).find((item) => normalizePlaca(item.placa) === normalizePlaca(multa.placa))

    const pdf = await gerarTermoDescontoPdf({
      multa,
      condutorNome: colaborador?.nome?.trim() || multa.condutor,
      condutorCpf: colaborador?.cpf ?? null,
      veiculoModelo: vehicle?.modelo || multa.modelo,
      renavam: vehicle?.renavan ?? null,
    })

    const fileName = `Termo de desconto - ${multa.condutor} - ${multa.ait || multa.placa}.pdf`.replace(/["\\\r\n/]/g, "")
    const pendencias = [!colaborador?.cpf ? "CPF do condutor" : null, !vehicle?.renavan ? "RENAVAM do veículo" : null].filter(Boolean)

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="termo-desconto.pdf"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "private, no-store",
        "X-Termo-Pendencias": encodeURIComponent(pendencias.join(", ")),
      },
    })
  } catch (err) {
    console.error("[multas/termo] GET error", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro desconhecido" }, { status: 500 })
  }
}
