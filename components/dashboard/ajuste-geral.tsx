"use client"

import { useMemo, useState } from "react"
import { AlertCircle, Check, Link2, Link2Off, Loader2, Search, Undo2, Users } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AjusteKm } from "@/components/dashboard/ajuste-km"
import { AjusteCartao } from "@/components/dashboard/ajuste-cartao"
import { useOptionalFuelDataContext } from "@/components/fuel/fuel-data-provider"
import { useColaboradores } from "@/hooks/use-colaboradores"
import { useVehicles } from "@/hooks/use-vehicles"
import { useDriverLinks } from "@/hooks/use-driver-links"
import {
  buildDriverMatches,
  collectAgregadoDrivers,
  collectDriverSources,
  normalizeDriverKey,
  type DriverMatch,
  type DriverMatchStatus,
} from "@/lib/driver-links-shared"

type StatusFilter = "pendentes" | "vinculados" | "externos" | "ignorados" | "todos"

const STATUS_LABELS: Record<DriverMatchStatus, string> = {
  vinculado: "Vinculado",
  agregado: "Agregado",
  sugerido: "Sugestão",
  pendente: "Conferir",
  externo: "Fora do cadastro",
  ignorado: "Ignorado",
}

const STATUS_CLASSES: Record<DriverMatchStatus, string> = {
  vinculado: "border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  agregado: "border-sky-200 bg-sky-100 text-sky-700 hover:bg-sky-100",
  sugerido: "border-amber-200 bg-amber-100 text-amber-700 hover:bg-amber-100",
  pendente: "border-rose-200 bg-rose-100 text-rose-700 hover:bg-rose-100",
  externo: "border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-100",
  ignorado: "border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-100",
}

function formatDateTime(value: string | null): string {
  if (!value) return "-"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "-"
  return parsed.toLocaleDateString("pt-BR")
}

function formatCpf(value: string): string {
  if (!value) return "-"
  return value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
}

type AjusteGeralProps = {
  canManage: boolean
}

export function AjusteGeral({ canManage }: AjusteGeralProps) {
  const fuelData = useOptionalFuelDataContext()
  const { colaboradores, isLoading: loadingColaboradores } = useColaboradores(true)
  const { vehicles } = useVehicles(true)
  const { links, isLoading: loadingLinks, error: linksError, upsertLink, removeLink } = useDriverLinks(true)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pendentes")
  const [search, setSearch] = useState("")
  const [selectionByKey, setSelectionByKey] = useState<Record<string, string>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const sources = useMemo(
    () => collectDriverSources(fuelData?.records ?? []),
    [fuelData?.records],
  )

  const agregados = useMemo(() => collectAgregadoDrivers(vehicles), [vehicles])

  const matches = useMemo(
    () => buildDriverMatches(sources, colaboradores, links, agregados),
    [sources, colaboradores, links, agregados],
  )

  const summary = useMemo(() => {
    return matches.reduce(
      (acc, match) => {
        acc[match.status] += 1
        return acc
      },
      { vinculado: 0, agregado: 0, sugerido: 0, pendente: 0, externo: 0, ignorado: 0 } as Record<DriverMatchStatus, number>,
    )
  }, [matches])

  const filteredMatches = useMemo(() => {
    const normalizedSearch = normalizeDriverKey(search)

    return matches.filter((match) => {
      if (statusFilter === "pendentes" && match.status !== "pendente" && match.status !== "sugerido") return false
      if (statusFilter === "vinculados" && match.status !== "vinculado" && match.status !== "agregado") return false
      if (statusFilter === "externos" && match.status !== "externo") return false
      if (statusFilter === "ignorados" && match.status !== "ignorado") return false
      if (!normalizedSearch) return true

      return (
        match.key.includes(normalizedSearch) ||
        normalizeDriverKey(match.colaborador?.nome ?? "").includes(normalizedSearch) ||
        match.source.cpf.includes(search.replace(/\D/g, ""))
      )
    })
  }, [matches, search, statusFilter])

  const isLoading = loadingColaboradores || loadingLinks || fuelData?.isLoading === true

  const handleLink = async (match: DriverMatch, colaboradorId: string) => {
    setSavingKey(match.key)
    try {
      await upsertLink({
        nomeOrigem: match.source.nome,
        cpfOrigem: match.source.cpf,
        colaboradorId,
      })
      setSelectionByKey((current) => {
        const next = { ...current }
        delete next[match.key]
        return next
      })
      toast({ title: "Vínculo salvo", description: `${match.source.nome} vinculado com sucesso.` })
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao salvar o vínculo.",
        variant: "destructive",
      })
    } finally {
      setSavingKey(null)
    }
  }

  const handleIgnore = async (match: DriverMatch) => {
    setSavingKey(match.key)
    try {
      await upsertLink({
        nomeOrigem: match.source.nome,
        cpfOrigem: match.source.cpf,
        colaboradorId: null,
        ignorado: true,
      })
      toast({ title: "Motorista ignorado", description: `${match.source.nome} não será mais cobrado no ajuste.` })
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao ignorar o motorista.",
        variant: "destructive",
      })
    } finally {
      setSavingKey(null)
    }
  }

  const handleUndo = async (match: DriverMatch) => {
    if (!match.link) return
    setSavingKey(match.key)
    try {
      await removeLink(match.link.id)
      toast({ title: "Vínculo removido", description: `${match.source.nome} voltou para a lista de pendentes.` })
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao remover o vínculo.",
        variant: "destructive",
      })
    } finally {
      setSavingKey(null)
    }
  }

  if (!fuelData) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Dados de combustível indisponíveis nesta seção.
        </CardContent>
      </Card>
    )
  }

  return (
    <Tabs defaultValue="colaboradores" className="space-y-4">
      <TabsList>
        <TabsTrigger value="colaboradores">Colaboradores</TabsTrigger>
        <TabsTrigger value="km">KM dos veículos</TabsTrigger>
        <TabsTrigger value="cartao">Placa do cartão</TabsTrigger>
      </TabsList>

      <TabsContent value="colaboradores" className="space-y-4">
      <Card className="border-[#d8dfd1] bg-[linear-gradient(180deg,#fcfdfb_0%,#f5f8f2_100%)] shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4 text-[#7c3aed]" />
            Vínculo de colaboradores (VELOE)
          </CardTitle>
          <CardDescription>
            Relaciona o nome do motorista que vem na planilha da VELOE com o colaborador cadastrado no sistema.
            É esse vínculo que permite trazer KM, consumo e centro de custo para o relatório geral.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 pt-0 lg:grid-cols-[220px_200px_1fr] lg:items-end">
          <div className="space-y-2">
            <Label htmlFor="ajuste-month">Competência</Label>
            <Select
              value={fuelData.selectedMonth ?? fuelData.currentMonth ?? undefined}
              onValueChange={fuelData.setSelectedMonth}
            >
              <SelectTrigger id="ajuste-month" className="w-full bg-white">
                <SelectValue placeholder="Selecione a competência" />
              </SelectTrigger>
              <SelectContent>
                {fuelData.availableMonths.map((month) => (
                  <SelectItem key={month.month} value={month.month}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ajuste-status">Situação</Label>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger id="ajuste-status" className="w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendentes">A vincular</SelectItem>
                <SelectItem value="vinculados">Vinculados</SelectItem>
                <SelectItem value="externos">Fora do cadastro</SelectItem>
                <SelectItem value="ignorados">Ignorados</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ajuste-search">Buscar motorista</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="ajuste-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nome ou CPF do motorista"
                className="bg-white pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Motoristas na planilha" value={matches.length} tone="slate" />
        <SummaryCard label="Identificados no sistema" value={summary.vinculado + summary.agregado} tone="emerald" />
        <SummaryCard label="A vincular" value={summary.sugerido + summary.pendente} tone="amber" />
        <SummaryCard label="Fora do cadastro" value={summary.externo} tone="slate" />
      </div>

      {linksError ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{linksError.message}</span>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table className="min-w-[980px]">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-[0.88rem] font-semibold">Motorista (VELOE)</TableHead>
              <TableHead className="text-[0.88rem] font-semibold">CPF</TableHead>
              <TableHead className="text-center text-[0.88rem] font-semibold">Abast.</TableHead>
              <TableHead className="text-[0.88rem] font-semibold">Placa cartão</TableHead>
              <TableHead className="text-center text-[0.88rem] font-semibold">Situação</TableHead>
              <TableHead className="text-[0.88rem] font-semibold">Colaborador do sistema</TableHead>
              <TableHead className="w-[190px] text-center text-[0.88rem] font-semibold">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && filteredMatches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                  Carregando dados...
                </TableCell>
              </TableRow>
            ) : null}

            {!isLoading && filteredMatches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  <Users className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                  Nenhum motorista nesta situação.
                </TableCell>
              </TableRow>
            ) : null}

            {filteredMatches.map((match) => {
              const selectedId = selectionByKey[match.key] ?? (match.status === "sugerido" ? match.sugestao?.id ?? "" : "")
              const saving = savingKey === match.key

              return (
                <TableRow key={match.key} className="align-middle">
                  <TableCell className="font-medium text-foreground">{match.source.nome}</TableCell>
                  <TableCell className="font-mono text-[0.85rem] text-muted-foreground">
                    {formatCpf(match.source.cpf)}
                  </TableCell>
                  <TableCell className="text-center text-[0.9rem]">
                    <div>{match.source.abastecimentos}</div>
                    <div className="text-[0.72rem] text-muted-foreground">
                      último {formatDateTime(match.source.ultimoAbastecimento)}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-[0.85rem] text-muted-foreground">
                    {match.source.placasCartao.slice(0, 3).join(", ") || "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={STATUS_CLASSES[match.status]}>
                      {STATUS_LABELS[match.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {match.status === "vinculado" ? (
                      <span className="text-[0.9rem] font-medium text-foreground">{match.colaborador?.nome}</span>
                    ) : match.status === "agregado" ? (
                      <span className="text-[0.9rem] font-medium text-foreground">
                        {match.agregado?.nome}
                        <span className="ml-1 text-[0.72rem] text-muted-foreground">
                          (agregado · {match.agregado?.placa})
                        </span>
                      </span>
                    ) : match.status === "ignorado" ? (
                      <span className="text-[0.85rem] text-muted-foreground">Ignorado no ajuste</span>
                    ) : (
                      <Select
                        value={selectedId || undefined}
                        onValueChange={(value) =>
                          setSelectionByKey((current) => ({ ...current, [match.key]: value }))
                        }
                        disabled={!canManage || saving}
                      >
                        <SelectTrigger className="w-full min-w-[240px] bg-white">
                          <SelectValue placeholder="Selecione o colaborador" />
                        </SelectTrigger>
                        <SelectContent>
                          {colaboradores.map((colaborador) => (
                            <SelectItem key={colaborador.id} value={colaborador.id}>
                              {colaborador.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {match.status === "sugerido" && match.sugestao ? (
                      <div className="mt-1 text-[0.72rem] text-amber-700">
                        Sugestão: {match.sugestao.nome} ({match.sugestaoScore}%)
                      </div>
                    ) : null}
                    {match.status === "pendente" && match.sugestao && match.sugestaoScore > 0 ? (
                      <div className="mt-1 text-[0.72rem] text-muted-foreground">
                        Mais parecido: {match.sugestao.nome} ({match.sugestaoScore}%) — confira antes de vincular
                      </div>
                    ) : null}
                    {match.status === "externo" ? (
                      <div className="mt-1 text-[0.72rem] text-muted-foreground">
                        Não encontrado no cadastro. Vincule só se for alguém da frota com nome diferente.
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-center">
                    {match.status === "vinculado" || match.status === "ignorado" ? (
                      match.link ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!canManage || saving}
                          onClick={() => handleUndo(match)}
                        >
                          <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                          Desfazer
                        </Button>
                      ) : (
                        <span className="text-[0.72rem] text-muted-foreground">Automático (CPF/nome)</span>
                      )
                    ) : match.status === "agregado" ? (
                      <span className="text-[0.72rem] text-muted-foreground">Veículo agregado</span>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="sm"
                          disabled={!canManage || saving || !selectedId}
                          onClick={() => handleLink(match, selectedId)}
                        >
                          {saving ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Vincular
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-500"
                          title="Ignorar este motorista"
                          disabled={!canManage || saving}
                          onClick={() => handleIgnore(match)}
                        >
                          <Link2Off className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      </TabsContent>

      <TabsContent value="km">
        <AjusteKm records={fuelData.records} canManage={canManage} />
      </TabsContent>

      <TabsContent value="cartao">
        <AjusteCartao records={fuelData.records} canManage={canManage} />
      </TabsContent>
    </Tabs>
  )
}

type SummaryCardProps = {
  label: string
  value: number
  tone: "slate" | "emerald" | "amber" | "rose"
}

const SUMMARY_TONES: Record<SummaryCardProps["tone"], string> = {
  slate: "text-slate-700",
  emerald: "text-emerald-600",
  amber: "text-amber-600",
  rose: "text-rose-600",
}

function SummaryCard({ label, value, tone }: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[0.78rem] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`mt-1 text-2xl font-semibold ${SUMMARY_TONES[tone]}`}>{value}</div>
      </CardContent>
    </Card>
  )
}
