"use client"

import { useMemo, useRef, useState } from "react"
import { Download, Eye, FileText, IdCard, Loader2, Search, ScrollText, Upload } from "lucide-react"
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
import { useVehicles } from "@/hooks/use-vehicles"
import type { Colaborador, DriveFile, Vehicle } from "@/lib/types"

type DocumentoTipo = "crlv" | "cnh" | "termo"

type DocumentoRow = {
  key: string
  tipo: DocumentoTipo
  titulo: string
  subtitulo: string
  detalhe: string
  arquivo: DriveFile | null
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
  return vehicles.map((vehicle) => ({
    key: vehicle.id,
    tipo: "crlv" as DocumentoTipo,
    titulo: vehicle.placa,
    subtitulo: vehicle.modelo,
    detalhe: `Renavam: ${vehicle.renavan || "-"}`,
    arquivo: findByName([...(vehicle.imagens ?? []), ...(vehicle.checklists ?? [])], "CRLV"),
  }))
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
}

function DocumentosTable({ rows, colunaTitulo, vazio, canManage, uploadingKey, onUpload }: DocumentosTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Table className="min-w-[720px]">
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="text-[0.88rem] font-semibold">{colunaTitulo}</TableHead>
            <TableHead className="text-[0.88rem] font-semibold">Detalhes</TableHead>
            <TableHead className="text-[0.88rem] font-semibold">Arquivo</TableHead>
            <TableHead className="w-[300px] text-center text-[0.88rem] font-semibold">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
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

  const [search, setSearch] = useState("")
  const [somentePendentes, setSomentePendentes] = useState(false)
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)

  const crlvRows = useMemo(() => buildCrlvRows(vehicles), [vehicles])
  const cnhRows = useMemo(() => buildCnhRows(colaboradores), [colaboradores])
  const termoRows = useMemo(() => buildTermoRows(colaboradores, vehicles), [colaboradores, vehicles])

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
        "CRLV anexado na ficha do veículo (arquivos com \"CRLV\" no nome, em Imagens ou Checklists).",
      rows: applyFilters(crlvRows),
      vazio: "Nenhum veículo encontrado.",
      total: crlvRows.length,
      pendentes: crlvRows.filter((row) => !row.arquivo).length,
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
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
              <tab.icon className="h-4 w-4" />
              {tab.label}
              <Badge variant="outline" className="ml-1 border-border bg-background px-1.5 py-0 text-[0.65rem]">
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
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
