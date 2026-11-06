"use client"

import { useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  IdCard,
  Loader2,
  RefreshCw,
  Search,
  ScrollText,
  Upload,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useColaboradores } from "@/hooks/use-colaboradores"
import { useCrlvAnalise } from "@/hooks/use-crlv-analise"
import { useVehicles } from "@/hooks/use-vehicles"
import type { Colaborador, DriveFile, Vehicle } from "@/lib/types"
import { findCrlvFile, getCrlvValidade, type CrlvValidade } from "@/lib/crlv-validade"
import { isVisibleInFrotaSection } from "@/lib/vehicle-classification"

type DocumentoTipo = "crlv" | "cnh" | "termo"

type CrlvPropriedade = "proprio" | "alugado"

type DocumentoRow = {
  key: string
  tipo: DocumentoTipo
  titulo: string
  subtitulo: string
  detalhe: string
  arquivo: DriveFile | null
  propriedade?: CrlvPropriedade
  validade?: CrlvValidade | null
}

function normalize(value: string): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
}

function findByName(files: DriveFile[] | undefined, term: string): DriveFile | null {
  const matches = (files ?? []).filter((file) => normalize(file.name || "").includes(term))
  return matches.length > 0 ? matches[matches.length - 1] : null
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "-"
  return parsed.toLocaleDateString("pt-BR")
}

function buildCrlvRows(vehicles: Vehicle[]): DocumentoRow[] {
  // Agregados pertencem ao colaborador; o CRLV lista apenas os veículos da aba "Veículos Frota".
  return vehicles.filter(isVisibleInFrotaSection).map((vehicle) => {
    const arquivo = findCrlvFile(vehicle)
    return {
      key: vehicle.id,
      tipo: "crlv" as DocumentoTipo,
      titulo: vehicle.placa,
      subtitulo: vehicle.modelo,
      detalhe: `Renavam: ${vehicle.renavan || "-"}`,
      arquivo,
      propriedade: (vehicle.tipoPropriedade === "alugado" ? "alugado" : "proprio") as CrlvPropriedade,
      validade: getCrlvValidade(vehicle.placa, arquivo),
    }
  })
}

function buildCnhRows(colaboradores: Colaborador[]): DocumentoRow[] {
  return colaboradores.map((colaborador) => ({
    key: colaborador.id,
    tipo: "cnh" as DocumentoTipo,
    titulo: colaborador.nome,
    subtitulo: colaborador.departamento || "-",
    detalhe: `Categoria ${colaborador.cnhCategoria || "-"} • Vence ${formatDate(colaborador.dataVencimentoCNH)}`,
    arquivo: (colaborador.cnhArquivos ?? [])[(colaborador.cnhArquivos ?? []).length - 1] ?? null,
  }))
}

function buildTermoRows(colaboradores: Colaborador[], vehicles: Vehicle[]): DocumentoRow[] {
  const vehicleByColaboradorId = new Map<string, Vehicle>()
  for (const vehicle of vehicles) {
    if (vehicle.colaboradorId) vehicleByColaboradorId.set(vehicle.colaboradorId, vehicle)
  }

  return colaboradores.map((colaborador) => {
    const vehicle = vehicleByColaboradorId.get(colaborador.id) ?? null

    return {
      key: colaborador.id,
      tipo: "termo" as DocumentoTipo,
      titulo: colaborador.nome,
      subtitulo: colaborador.departamento || "-",
      detalhe: vehicle ? `Veículo ${vehicle.placa}` : "Sem veículo vinculado",
      // Termo assinado que o colaborador envia em "Outros Documentos" (nome contem TERMO).
      arquivo: findByName(colaborador.documentos, "TERMO"),
    }
  })
}

async function uploadToDrive(file: File, entityType: string, entityId: string, label: string): Promise<DriveFile> {
  const body = new FormData()
  body.append("file", file)
  body.append("entityType", entityType)
  body.append("entityId", entityId)
  body.append("label", label)
  body.append("subfolder", label)

  const res = await fetch("/api/drive/upload", { method: "POST", body })
  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data?.error || "Falha ao enviar arquivo.")
  }

  return data as DriveFile
}

type UploadButtonProps = {
  row: DocumentoRow
  uploading: boolean
  onUpload: (row: DocumentoRow, file: File) => void
}

function UploadButton({ row, uploading, onUpload }: UploadButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="application/pdf,.pdf"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onUpload(row, file)
          event.target.value = ""
        }}
      />
      <Button
        size="sm"
        variant={row.arquivo ? "ghost" : "default"}
        className="h-8"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        title={row.arquivo ? "Substituir o PDF na nuvem" : "Enviar o PDF para a nuvem"}
      >
        {uploading ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="mr-1.5 h-3.5 w-3.5" />
        )}
        {row.arquivo ? "Substituir" : "Enviar PDF"}
      </Button>
    </>
  )
}

type DocumentosTableProps = {
  rows: DocumentoRow[]
  colunaTitulo: string
  vazio: string
  canManage: boolean
  uploadingKey: string | null
  onUpload: (row: DocumentoRow, file: File) => void
  mostrarValidade?: boolean
  analisando?: boolean
}

function ValidadeCell({ validade, analisando }: { validade: CrlvValidade | null | undefined; analisando: boolean }) {
  if (!validade) return <span className="text-[0.75rem] text-muted-foreground">-</span>

  if (validade.status === "nao_analisado") {
    return (
      <Badge variant="outline" className="gap-1 border-slate-200 bg-slate-100 text-slate-600">
        {analisando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Clock className="h-3 w-3" />}
        {analisando ? "Analisando..." : validade.mensagem}
      </Badge>
    )
  }

  if (validade.status === "erro") {
    return (
      <Badge variant="outline" className="gap-1 border-slate-200 bg-slate-100 text-slate-600" title={validade.mensagem}>
        <AlertTriangle className="h-3 w-3" />
        Não foi possível ler o PDF
      </Badge>
    )
  }

  const estilo =
    validade.status === "vencido"
      ? { className: "border-red-200 bg-red-50 text-red-700", Icon: AlertTriangle }
      : validade.status === "vencendo"
        ? { className: "border-amber-200 bg-amber-50 text-amber-700", Icon: Clock }
        : { className: "border-emerald-200 bg-emerald-50 text-emerald-700", Icon: CheckCircle2 }

  return (
    <div className="space-y-1">
      <Badge variant="outline" className={`gap-1 ${estilo.className}`}>
        <estilo.Icon className="h-3 w-3" />
        {validade.mensagem}
      </Badge>
      <div className="text-[0.72rem] text-muted-foreground">
        Exercício {validade.exercicio} • {validade.uf || "UF ?"}
        {validade.calendarioUf && validade.calendarioUf !== validade.uf ? ` (calendário ${validade.calendarioUf})` : ""}
      </div>
      {validade.placaDivergente ? (
        <div className="text-[0.72rem] font-medium text-red-600">Placa do PDF diferente do veículo</div>
      ) : null}
    </div>
  )
}

function DocumentosTable({
  rows,
  colunaTitulo,
  vazio,
  canManage,
  uploadingKey,
  onUpload,
  mostrarValidade = false,
  analisando = false,
}: DocumentosTableProps) {
  const colunas = mostrarValidade ? 5 : 4

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Table className="min-w-[720px]">
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="text-[0.88rem] font-semibold">{colunaTitulo}</TableHead>
            <TableHead className="text-[0.88rem] font-semibold">Detalhes</TableHead>
            <TableHead className="text-[0.88rem] font-semibold">Arquivo</TableHead>
            {mostrarValidade ? <TableHead className="text-[0.88rem] font-semibold">Validade</TableHead> : null}
            <TableHead className="w-[300px] text-center text-[0.88rem] font-semibold">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colunas} className="py-10 text-center text-sm text-muted-foreground">
                {vazio}
              </TableCell>
            </TableRow>
          ) : null}

          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell>
                <div className="font-medium text-foreground">{row.titulo}</div>
                <div className="text-[0.78rem] text-muted-foreground">{row.subtitulo}</div>
              </TableCell>
              <TableCell className="text-[0.85rem] text-muted-foreground">{row.detalhe}</TableCell>
              <TableCell>
                {row.arquivo ? (
                  <span className="text-[0.85rem] text-foreground">{row.arquivo.name}</span>
                ) : (
                  <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-600">
                    Não anexado
                  </Badge>
                )}
              </TableCell>
              {mostrarValidade ? (
                <TableCell>
                  <ValidadeCell validade={row.validade} analisando={analisando} />
                </TableCell>
              ) : null}
              <TableCell>
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {row.arquivo ? (
                    <>
                      <Button asChild size="sm" variant="outline" className="h-8">
                        <a
                          href={`/api/drive/file/${row.arquivo.id}`}
                          target="_blank"
                          rel="noreferrer"
                          title={`Visualizar ${row.arquivo.name}`}
                        >
                          <Eye className="mr-1.5 h-3.5 w-3.5" />
                          Visualizar
                        </a>
                      </Button>
                      <Button asChild size="sm" variant="outline" className="h-8">
                        <a href={`/api/drive/file/${row.arquivo.id}?download=1`} title={`Baixar ${row.arquivo.name}`}>
                          <Download className="mr-1.5 h-3.5 w-3.5" />
                          Baixar
                        </a>
                      </Button>
                    </>
                  ) : null}

                  {canManage ? (
                    <UploadButton row={row} uploading={uploadingKey === row.key} onUpload={onUpload} />
                  ) : null}

                  {!row.arquivo && !canManage ? <span className="text-[0.75rem] text-muted-foreground">-</span> : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

type DocumentosPanelProps = {
  canManage?: boolean
}

export function DocumentosPanel({ canManage = true }: DocumentosPanelProps) {
  const { vehicles, updateVehicle } = useVehicles(true)
  const { colaboradores, updateColaborador } = useColaboradores(true)
  const { analisando, reanalisar } = useCrlvAnalise(vehicles)

  const [search, setSearch] = useState("")
  const [somentePendentes, setSomentePendentes] = useState(false)
  const [somenteVencidos, setSomenteVencidos] = useState(false)
  const [crlvPropriedade, setCrlvPropriedade] = useState<CrlvPropriedade>("proprio")
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)

  const crlvRowsAll = useMemo(() => buildCrlvRows(vehicles), [vehicles])
  const crlvProprios = useMemo(() => crlvRowsAll.filter((row) => row.propriedade === "proprio"), [crlvRowsAll])
  const crlvAlugados = useMemo(() => crlvRowsAll.filter((row) => row.propriedade === "alugado"), [crlvRowsAll])
  const crlvRows = crlvPropriedade === "alugado" ? crlvAlugados : crlvProprios
  const cnhRows = useMemo(() => buildCnhRows(colaboradores), [colaboradores])
  const termoRows = useMemo(() => buildTermoRows(colaboradores, vehicles), [colaboradores, vehicles])

  const handleReanalisar = async () => {
    try {
      const falhas = await reanalisar(crlvRowsAll.filter((row) => row.arquivo).map((row) => row.key))
      if (falhas === null) return
      toast({
        title: "Análise concluída",
        description: falhas > 0 ? `${falhas} CRLV(s) não puderam ser analisados.` : "Todos os CRLVs foram analisados.",
      })
    } catch (error) {
      toast({
        title: "Erro na análise do CRLV",
        description: error instanceof Error ? error.message : "Falha ao analisar os CRLVs.",
        variant: "destructive",
      })
    }
  }

  const handleUpload = async (row: DocumentoRow, file: File) => {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    if (!isPdf) {
      toast({
        title: "Formato inválido",
        description: "Envie o documento em PDF.",
        variant: "destructive",
      })
      return
    }

    setUploadingKey(row.key)

    try {
      if (row.tipo === "crlv") {
        const vehicle = vehicles.find((item) => item.id === row.key)
        if (!vehicle) throw new Error("Veículo não encontrado.")

        const uploaded = await uploadToDrive(file, "veiculos", vehicle.placa || vehicle.id, "crlv")
        await updateVehicle(vehicle.id, { ...vehicle, imagens: [...(vehicle.imagens ?? []), uploaded] })
      } else {
        const colaborador = colaboradores.find((item) => item.id === row.key)
        if (!colaborador) throw new Error("Colaborador não encontrado.")

        const label = row.tipo === "cnh" ? "cnh" : "termo"
        const uploaded = await uploadToDrive(file, "colaboradores", colaborador.cpf || colaborador.id, label)

        const payload =
          row.tipo === "cnh"
            ? { ...colaborador, cnhArquivos: [...(colaborador.cnhArquivos ?? []), uploaded] }
            : { ...colaborador, documentos: [...(colaborador.documentos ?? []), uploaded] }

        await updateColaborador(colaborador.id, payload)
      }

      toast({ title: "PDF enviado para a nuvem", description: `${row.titulo}: ${file.name}.` })
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao anexar o documento.",
        variant: "destructive",
      })
    } finally {
      setUploadingKey(null)
    }
  }

  const applyFilters = (rows: DocumentoRow[]): DocumentoRow[] => {
    const term = normalize(search.trim())

    return rows
      .filter((row) => (somentePendentes ? !row.arquivo : true))
      .filter((row) => (somenteVencidos && row.tipo === "crlv" ? row.validade?.status === "vencido" : true))
      .filter((row) => (term ? normalize(`${row.titulo} ${row.subtitulo} ${row.detalhe}`).includes(term) : true))
      .sort((left, right) => left.titulo.localeCompare(right.titulo, "pt-BR"))
  }

  const tabs = [
    {
      value: "crlv",
      label: "CRLV",
      icon: FileText,
      colunaTitulo: "Veículo",
      descricao:
        "CRLV dos veículos da frota (sem agregados). O PDF é lido automaticamente e a validade é calculada pelo exercício, final da placa e calendário de licenciamento do Detran da UF (SP, MG ou PR).",
      rows: applyFilters(crlvRows),
      vazio:
        crlvPropriedade === "alugado" ? "Nenhum veículo alugado encontrado." : "Nenhum veículo próprio encontrado.",
      total: crlvRows.length,
      pendentes: crlvRowsAll.filter((row) => !row.arquivo).length,
    },
    {
      value: "cnh",
      label: "CNH",
      icon: IdCard,
      colunaTitulo: "Colaborador",
      descricao: "CNH anexada na ficha do colaborador, com categoria e data de vencimento.",
      rows: applyFilters(cnhRows),
      vazio: "Nenhum colaborador encontrado.",
      total: cnhRows.length,
      pendentes: cnhRows.filter((row) => !row.arquivo).length,
    },
    {
      value: "termo",
      label: "Termo de Responsabilidade",
      icon: ScrollText,
      colunaTitulo: "Colaborador",
      descricao:
        "Termo assinado enviado em \"Outros Documentos\" na ficha do colaborador (arquivos com \"TERMO\" no nome).",
      rows: applyFilters(termoRows),
      vazio: "Nenhum colaborador encontrado.",
      total: termoRows.length,
      pendentes: termoRows.filter((row) => !row.arquivo).length,
    },
  ]

  return (
    <div className="w-full space-y-4">
      <Tabs defaultValue="crlv" className="w-full space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 rounded-xl border border-border bg-card p-2">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="h-11 flex-1 gap-2 rounded-lg border border-border bg-background px-4 text-[0.95rem] font-semibold text-muted-foreground shadow-sm transition-colors hover:bg-muted data-[state=active]:border-[#d97706] data-[state=active]:bg-[#d97706] data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              <Badge
                variant="outline"
                className="ml-1 border-border bg-muted px-1.5 py-0 text-[0.68rem] font-semibold text-muted-foreground"
              >
                {tab.pendentes > 0 ? `${tab.pendentes} pendente(s)` : "completo"}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="space-y-4">
            <Card className="border-[#d8dfd1] bg-[linear-gradient(180deg,#fcfdfb_0%,#f5f8f2_100%)] shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <tab.icon className="h-4 w-4 text-[#d97706]" />
                  {tab.label}
                </CardTitle>
                <CardDescription>{tab.descricao}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-3 p-5 pt-0">
                {tab.value === "crlv" ? (
                  <div className="flex w-full flex-wrap items-center gap-2">
                    {(
                      [
                        { value: "proprio", label: "Próprios", rows: crlvProprios },
                        { value: "alugado", label: "Alugados", rows: crlvAlugados },
                      ] as const
                    ).map((option) => {
                      const pendentes = option.rows.filter((row) => !row.arquivo).length
                      const vencidos = option.rows.filter((row) => row.validade?.status === "vencido").length
                      const active = crlvPropriedade === option.value
                      return (
                        <Button
                          key={option.value}
                          type="button"
                          variant={active ? "default" : "outline"}
                          className={
                            active
                              ? "min-w-[140px] border-[#d97706] bg-[#d97706] text-white hover:bg-[#b45309]"
                              : "min-w-[140px] bg-white"
                          }
                          onClick={() => setCrlvPropriedade(option.value)}
                        >
                          {option.label}
                          <Badge
                            variant="outline"
                            className={`ml-2 px-1.5 py-0 text-[0.68rem] font-semibold ${
                              active ? "border-white/40 bg-white/20 text-white" : "border-border bg-muted text-muted-foreground"
                            }`}
                          >
                            {option.rows.length}
                            {pendentes > 0 ? ` • ${pendentes} pend.` : ""}
                          </Badge>
                          {vencidos > 0 ? (
                            <Badge
                              variant="outline"
                              className="ml-1 border-red-200 bg-red-50 px-1.5 py-0 text-[0.68rem] font-semibold text-red-700"
                            >
                              {vencidos} vencido(s)
                            </Badge>
                          ) : null}
                        </Button>
                      )
                    })}

                    {canManage ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="ml-auto bg-white"
                        disabled={analisando}
                        onClick={() => void handleReanalisar()}
                        title="Lê novamente todos os PDFs de CRLV e recalcula a validade"
                      >
                        {analisando ? (
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-1.5 h-4 w-4" />
                        )}
                        {analisando ? "Analisando CRLVs..." : "Reanalisar CRLVs"}
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por placa, nome ou setor"
                    className="bg-white pl-9"
                  />
                </div>

                <Button
                  type="button"
                  variant={somentePendentes ? "default" : "outline"}
                  onClick={() => setSomentePendentes((current) => !current)}
                >
                  Somente pendentes
                </Button>

                {tab.value === "crlv" ? (
                  <Button
                    type="button"
                    variant={somenteVencidos ? "destructive" : "outline"}
                    onClick={() => setSomenteVencidos((current) => !current)}
                  >
                    <AlertTriangle className="mr-1.5 h-4 w-4" />
                    Somente vencidos
                  </Button>
                ) : null}

                <p className="text-xs text-muted-foreground">
                  {tab.rows.length} de {tab.total} registro(s).
                </p>
              </CardContent>
            </Card>

            <DocumentosTable
              rows={tab.rows}
              colunaTitulo={tab.colunaTitulo}
              vazio={tab.vazio}
              canManage={canManage}
              uploadingKey={uploadingKey}
              onUpload={handleUpload}
              mostrarValidade={tab.value === "crlv"}
              analisando={analisando}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
