"use client"

import { useMemo, useState } from "react"
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CarFront,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Clock,
  FileText,
  Mail,
  MapPin,
  Paperclip,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  UserRound,
  Wallet,
  XCircle,
} from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { FornecedorModal } from "@/components/fornecedores/fornecedor-modal"
import { OrdemAnexosModal } from "@/components/fornecedores/ordem-anexos-modal"
import { OrdemServicoModal } from "@/components/fornecedores/ordem-servico-modal"
import { useFornecedores } from "@/hooks/use-fornecedores"
import { useOrdensServico } from "@/hooks/use-ordens-servico"
import {
  FORNECEDOR_REGIAO_BADGE_CLASS,
  FORNECEDOR_REGIAO_OPTIONS,
  ORDEM_SERVICO_STATUS_BADGE_CLASS,
  ORDEM_SERVICO_STATUS_LABELS,
  ORDEM_SERVICO_STATUS_OPTIONS,
  PARCELA_STATUS_BADGE_CLASS,
  PARCELA_STATUS_LABELS,
  countParcelasPagas,
  describeVencimento,
  formatCondicaoPagamento,
  formatCurrency,
  formatDate,
  formatRegiao,
  getParcelaStatus,
  getParcelasEmAlerta,
  hasBoletoAnexado,
  hasNotaFiscalAnexada,
  hasPendenciaFinanceira,
  isSameMonth,
} from "@/lib/fornecedores"
import { cn } from "@/lib/utils"
import type {
  Fornecedor,
  FornecedorFormData,
  FornecedorRegiao,
  OrdemServico,
  OrdemServicoFormData,
  OrdemServicoStatus,
  Vehicle,
} from "@/lib/types"

type FornecedoresDashboardProps = {
  vehicles: Vehicle[]
  canManage: boolean
  canApprove: boolean
}

const ALL_VALUE = "todos"

const STAT_CARDS_ACCENT = {
  total: "bg-[#2f7ddf]/10 text-[#2f7ddf]",
  pendentes: "bg-[#e0aa22]/10 text-[#b8860b]",
  aprovadas: "bg-[#159a8c]/10 text-[#0f766e]",
  valor: "bg-[#7CB342]/10 text-[#4c6b28]",
} as const

export function FornecedoresDashboard({ vehicles, canManage, canApprove }: FornecedoresDashboardProps) {
  const {
    fornecedores,
    isLoading: isLoadingFornecedores,
    error: fornecedoresError,
    addFornecedor,
    updateFornecedor,
    deleteFornecedor,
  } = useFornecedores()
  const {
    ordens,
    isLoading: isLoadingOrdens,
    error: ordensError,
    addOrdemServico,
    updateOrdemServico,
    deleteOrdemServico,
    decideOrdemServico,
  } = useOrdensServico()

  const [search, setSearch] = useState("")
  const [fornecedorFilter, setFornecedorFilter] = useState(ALL_VALUE)
  const [regiaoFilter, setRegiaoFilter] = useState<typeof ALL_VALUE | FornecedorRegiao>(ALL_VALUE)
  const [statusFilter, setStatusFilter] = useState<typeof ALL_VALUE | OrdemServicoStatus>(ALL_VALUE)

  const [isFornecedorModalOpen, setIsFornecedorModalOpen] = useState(false)
  const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null)
  const [deletingFornecedor, setDeletingFornecedor] = useState<Fornecedor | null>(null)

  const [isOrdemModalOpen, setIsOrdemModalOpen] = useState(false)
  const [editingOrdem, setEditingOrdem] = useState<OrdemServico | null>(null)
  const [deletingOrdem, setDeletingOrdem] = useState<OrdemServico | null>(null)
  const [anexosOrdem, setAnexosOrdem] = useState<OrdemServico | null>(null)
  const [rejectingOrdem, setRejectingOrdem] = useState<OrdemServico | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [decidingId, setDecidingId] = useState<string | null>(null)

  const fornecedoresById = useMemo(
    () => new Map(fornecedores.map((fornecedor) => [fornecedor.id, fornecedor])),
    [fornecedores]
  )

  const vehiclesById = useMemo(() => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])), [vehicles])

  const stats = useMemo(() => {
    const now = new Date()
    const pendentes = ordens.filter((ordem) => ordem.status === "aguardando")
    const aprovadas = ordens.filter((ordem) => ordem.status === "aprovado" || ordem.status === "concluido")
    const valorMes = aprovadas
      .filter((ordem) => isSameMonth(ordem.dataAbertura || ordem.createdAt, now))
      .reduce((total, ordem) => total + ordem.valorTotal, 0)

    return {
      total: ordens.length,
      pendentes: pendentes.length,
      aprovadas: aprovadas.length,
      valorMes,
    }
  }, [ordens])

  const filteredOrdens = useMemo(() => {
    const term = search.trim().toLowerCase()

    return ordens.filter((ordem) => {
      const fornecedor = ordem.fornecedorId ? fornecedoresById.get(ordem.fornecedorId) : undefined

      if (fornecedorFilter !== ALL_VALUE && ordem.fornecedorId !== fornecedorFilter) return false
      if (statusFilter !== ALL_VALUE && ordem.status !== statusFilter) return false
      if (regiaoFilter !== ALL_VALUE && fornecedor?.regiao !== regiaoFilter) return false
      if (!term) return true

      const fornecedorNome = fornecedor?.razaoSocial ?? ""
      return (
        ordem.placa.toLowerCase().includes(term) ||
        ordem.descricao.toLowerCase().includes(term) ||
        fornecedorNome.toLowerCase().includes(term)
      )
    })
  }, [ordens, search, fornecedorFilter, regiaoFilter, statusFilter, fornecedoresById])

  const parcelasEmAlerta = useMemo(() => getParcelasEmAlerta(ordens), [ordens])

  const filteredFornecedores = useMemo(
    () =>
      regiaoFilter === ALL_VALUE
        ? fornecedores
        : fornecedores.filter((fornecedor) => fornecedor.regiao === regiaoFilter),
    [fornecedores, regiaoFilter]
  )

  const documentosFinanceiros = useMemo(
    () =>
      ordens
        .filter((ordem) => hasBoletoAnexado(ordem) || hasNotaFiscalAnexada(ordem) || hasPendenciaFinanceira(ordem))
        .slice(0, 12),
    [ordens]
  )

  const handleSaveFornecedor = async (data: FornecedorFormData) => {
    try {
      if (editingFornecedor) {
        await updateFornecedor(editingFornecedor.id, data)
        toast({ title: "Sucesso", description: "Fornecedor atualizado." })
      } else {
        await addFornecedor(data)
        toast({ title: "Sucesso", description: "Fornecedor cadastrado." })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao salvar fornecedor."
      toast({ title: "Erro", description: message, variant: "destructive" })
      throw error
    }
  }

  const handleSaveOrdem = async (data: OrdemServicoFormData) => {
    try {
      if (editingOrdem) {
        await updateOrdemServico(editingOrdem.id, data)
        toast({ title: "Sucesso", description: "Orçamento atualizado." })
      } else {
        await addOrdemServico(data)
        toast({ title: "Sucesso", description: "Orçamento enviado para aprovação." })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao salvar orçamento."
      toast({ title: "Erro", description: message, variant: "destructive" })
      throw error
    }
  }

  const handleSaveAnexos = async (data: OrdemServicoFormData) => {
    if (!anexosOrdem) return

    try {
      await updateOrdemServico(anexosOrdem.id, data)
      toast({ title: "Sucesso", description: "Anexos financeiros atualizados." })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao salvar anexos."
      toast({ title: "Erro", description: message, variant: "destructive" })
      throw error
    }
  }

  const handleApprove = async (ordem: OrdemServico) => {
    setDecidingId(ordem.id)
    try {
      await decideOrdemServico(ordem.id, { status: "aprovado" })
      toast({ title: "Orçamento aprovado", description: `${ordem.placa} liberado para execução.` })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao aprovar o orçamento."
      toast({ title: "Erro", description: message, variant: "destructive" })
    } finally {
      setDecidingId(null)
    }
  }

  const handleConfirmRejection = async () => {
    if (!rejectingOrdem) return

    if (!rejectionReason.trim()) {
      toast({ title: "Aviso", description: "Informe o motivo da rejeição." })
      return
    }

    setDecidingId(rejectingOrdem.id)
    try {
      await decideOrdemServico(rejectingOrdem.id, {
        status: "rejeitado",
        motivoRejeicao: rejectionReason.trim(),
      })
      toast({ title: "Orçamento rejeitado", description: `${rejectingOrdem.placa} não seguirá para execução.` })
      setRejectingOrdem(null)
      setRejectionReason("")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao rejeitar o orçamento."
      toast({ title: "Erro", description: message, variant: "destructive" })
    } finally {
      setDecidingId(null)
    }
  }

  const handleDeleteOrdem = async () => {
    if (!deletingOrdem) return

    try {
      await deleteOrdemServico(deletingOrdem.id)
      toast({ title: "Sucesso", description: "Ordem de serviço excluída." })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao excluir a ordem."
      toast({ title: "Erro", description: message, variant: "destructive" })
    } finally {
      setDeletingOrdem(null)
    }
  }

  const handleDeleteFornecedor = async () => {
    if (!deletingFornecedor) return

    try {
      await deleteFornecedor(deletingFornecedor.id)
      toast({ title: "Sucesso", description: "Fornecedor excluído." })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao excluir o fornecedor."
      toast({ title: "Erro", description: message, variant: "destructive" })
    } finally {
      setDeletingFornecedor(null)
    }
  }

  const errorMessage = ordensError || fornecedoresError

  return (
    <div className="w-full space-y-6">
      {errorMessage ? (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-rose-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Não foi possível carregar os dados de fornecedores.</p>
              <p className="text-xs">{errorMessage}</p>
              <p className="mt-1 text-xs">
                Verifique se a migração <code>scripts/022_create_fornecedores_tables.sql</code> foi aplicada no Supabase.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {parcelasEmAlerta.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex flex-col gap-2 p-4 text-sm text-amber-900">
            <p className="flex items-center gap-2 font-semibold">
              <CalendarClock className="h-4 w-4" />
              {parcelasEmAlerta.length} boleto(s) perto do vencimento ou vencido(s)
            </p>
            <ul className="space-y-1 text-xs">
              {parcelasEmAlerta.slice(0, 5).map(({ ordem, parcela, dias }) => (
                <li key={`${ordem.id}-${parcela.id}`}>
                  {ordem.placa} · parcela {parcela.numero} · {formatCurrency(parcela.valor ?? 0)} ·{" "}
                  {formatDate(parcela.vencimento)} ({describeVencimento(dias)})
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total de Ordens"
          value={String(stats.total)}
          hint="Orçamentos registrados"
          icon={ClipboardList}
          accent={STAT_CARDS_ACCENT.total}
        />
        <StatCard
          label="Pendentes de Aprovação"
          value={String(stats.pendentes)}
          hint="Aguardando decisão do gestor"
          icon={Clock}
          accent={STAT_CARDS_ACCENT.pendentes}
        />
        <StatCard
          label="Aprovadas"
          value={String(stats.aprovadas)}
          hint="Liberadas para execução"
          icon={CheckCircle2}
          accent={STAT_CARDS_ACCENT.aprovadas}
        />
        <StatCard
          label="Valor Aprovado (Mês)"
          value={formatCurrency(stats.valorMes)}
          hint="Competência atual"
          icon={CircleDollarSign}
          accent={STAT_CARDS_ACCENT.valor}
        />
      </div>

      <Tabs defaultValue="ordens" className="w-full">
        <TabsList>
          <TabsTrigger value="ordens">Ordens & Aprovações</TabsTrigger>
          <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
        </TabsList>

        <TabsContent value="ordens" className="mt-4">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <ClipboardList className="h-4.5 w-4.5 text-[#2f7ddf]" />
                      Fila de Aprovação
                    </CardTitle>
                    <CardDescription>
                      Ordens de serviço e despesas aguardando a decisão do gestor.
                    </CardDescription>
                  </div>

                  {canManage ? (
                    <Button
                      onClick={() => {
                        setEditingOrdem(null)
                        setIsOrdemModalOpen(true)
                      }}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Novo Orçamento
                    </Button>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[200px] flex-1">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar na fila (placa, serviço, fornecedor)"
                      className="pl-9"
                    />
                  </div>

                  <Select value={fornecedorFilter} onValueChange={setFornecedorFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Todos os fornecedores" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_VALUE}>Todos os fornecedores</SelectItem>
                      {fornecedores.map((fornecedor) => (
                        <SelectItem key={fornecedor.id} value={fornecedor.id}>
                          {fornecedor.razaoSocial}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={regiaoFilter}
                    onValueChange={(value) => setRegiaoFilter(value as typeof ALL_VALUE | FornecedorRegiao)}
                  >
                    <SelectTrigger className="w-[170px]">
                      <SelectValue placeholder="Todas as regiões" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_VALUE}>Todas as regiões</SelectItem>
                      {FORNECEDOR_REGIAO_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={statusFilter}
                    onValueChange={(value) => setStatusFilter(value as typeof ALL_VALUE | OrdemServicoStatus)}
                  >
                    <SelectTrigger className="w-[190px]">
                      <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_VALUE}>Todos os status</SelectItem>
                      {ORDEM_SERVICO_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Veículo / Placa</TableHead>
                        <TableHead>Descrição do Serviço</TableHead>
                        <TableHead>Custo Estimado</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingOrdens && ordens.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                            Carregando ordens de serviço...
                          </TableCell>
                        </TableRow>
                      ) : filteredOrdens.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                            Nenhuma ordem de serviço encontrada.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredOrdens.map((ordem) => {
                          const fornecedor = ordem.fornecedorId ? fornecedoresById.get(ordem.fornecedorId) : undefined
                          const vehicle = ordem.vehicleId ? vehiclesById.get(ordem.vehicleId) : undefined
                          const isDeciding = decidingId === ordem.id

                          return (
                            <TableRow key={ordem.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2f7ddf]/10 text-[#2f7ddf]">
                                    <CarFront className="h-4 w-4" />
                                  </span>
                                  <div className="min-w-0">
                                    <p className="font-mono text-sm font-semibold">{ordem.placa}</p>
                                    <p className="truncate text-xs text-muted-foreground">
                                      {vehicle?.modelo || "Veículo não vinculado"}
                                    </p>
                                  </div>
                                </div>
                              </TableCell>

                              <TableCell className="max-w-[260px]">
                                <p className="truncate text-sm">{ordem.descricao}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {fornecedor?.razaoSocial || "Fornecedor não vinculado"}
                                </p>
                              </TableCell>

                              <TableCell>
                                <p className="text-sm font-semibold">{formatCurrency(ordem.valorTotal)}</p>
                                <p className="text-xs text-muted-foreground">
                                  Peças {formatCurrency(ordem.valorPecas)} · M.O. {formatCurrency(ordem.valorMaoObra)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Pagamento: {formatCondicaoPagamento(ordem)}
                                </p>
                              </TableCell>

                              <TableCell>
                                <div className="flex flex-col items-start gap-1">
                                  <Badge
                                    variant="outline"
                                    className={ORDEM_SERVICO_STATUS_BADGE_CLASS[ordem.status]}
                                  >
                                    {ORDEM_SERVICO_STATUS_LABELS[ordem.status]}
                                  </Badge>
                                  {hasPendenciaFinanceira(ordem) ? (
                                    <span className="text-[0.68rem] font-medium text-amber-700">
                                      Boleto pendente
                                    </span>
                                  ) : null}
                                  {ordem.status === "rejeitado" && ordem.motivoRejeicao ? (
                                    <span className="max-w-[180px] truncate text-[0.68rem] text-muted-foreground">
                                      {ordem.motivoRejeicao}
                                    </span>
                                  ) : null}
                                </div>
                              </TableCell>

                              <TableCell>
                                <div className="flex flex-wrap items-center justify-end gap-1.5">
                                  {canApprove && ordem.status === "aguardando" ? (
                                    <>
                                      <Button
                                        size="sm"
                                        disabled={isDeciding}
                                        onClick={() => handleApprove(ordem)}
                                        className="h-8 gap-1.5 bg-[#159a8c] text-white hover:bg-[#118477]"
                                      >
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        Aprovar
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        disabled={isDeciding}
                                        onClick={() => {
                                          setRejectingOrdem(ordem)
                                          setRejectionReason("")
                                        }}
                                        className="h-8 gap-1.5"
                                      >
                                        <XCircle className="h-3.5 w-3.5" />
                                        Rejeitar
                                      </Button>
                                    </>
                                  ) : null}

                                  {canManage ? (
                                    <>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8"
                                        aria-label="Anexos financeiros"
                                        onClick={() => setAnexosOrdem(ordem)}
                                      >
                                        <Paperclip className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8"
                                        aria-label="Editar ordem"
                                        onClick={() => {
                                          setEditingOrdem(ordem)
                                          setIsOrdemModalOpen(true)
                                        }}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-destructive"
                                        aria-label="Excluir ordem"
                                        onClick={() => setDeletingOrdem(ordem)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </>
                                  ) : null}
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                  Mostrando {filteredOrdens.length} de {ordens.length} resultados
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Wallet className="h-4.5 w-4.5 text-[#7CB342]" />
                  Boletos & Notas Fiscais
                </CardTitle>
                <CardDescription>Documentos financeiros vinculados às ordens de serviço.</CardDescription>
              </CardHeader>

              <CardContent className="space-y-3 p-4">
                {documentosFinanceiros.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
                    <p className="text-sm font-semibold">Nenhum documento financeiro.</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Anexe boletos e notas fiscais às ordens aprovadas.
                    </p>
                  </div>
                ) : (
                  documentosFinanceiros.map((ordem) => {
                    const parcelas = ordem.boletoParcelas ?? []

                    return (
                      <div key={ordem.id} className="rounded-xl border border-border bg-muted/20 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{ordem.placa}</p>
                            <p className="truncate text-xs text-muted-foreground">{ordem.descricao}</p>
                          </div>
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2f7ddf]/10 text-[#2f7ddf]">
                            <FileText className="h-4 w-4" />
                          </span>
                        </div>

                        <div className="mt-2.5 space-y-1 text-xs text-muted-foreground">
                          <p className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "inline-flex h-1.5 w-1.5 rounded-full",
                                hasBoletoAnexado(ordem) ? "bg-emerald-500" : "bg-amber-500"
                              )}
                            />
                            Boleto anexado: {hasBoletoAnexado(ordem) ? "Sim" : "Não"}
                            {parcelas.length > 0
                              ? ` · ${countParcelasPagas(ordem)}/${parcelas.length} parcela(s) paga(s)`
                              : ""}
                          </p>
                          <p className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "inline-flex h-1.5 w-1.5 rounded-full",
                                hasNotaFiscalAnexada(ordem) ? "bg-emerald-500" : "bg-slate-400"
                              )}
                            />
                            Nota fiscal: {hasNotaFiscalAnexada(ordem) ? `Nº ${ordem.notaFiscalNumero || "anexada"}` : "Não anexada"}
                          </p>
                          <p>Valor da ordem: {formatCurrency(ordem.valorTotal)}</p>
                        </div>

                        {parcelas.length > 0 ? (
                          <ul className="mt-2.5 space-y-1.5">
                            {parcelas.map((parcela) => {
                              const status = getParcelaStatus(parcela)

                              return (
                                <li
                                  key={parcela.id}
                                  className="flex items-center justify-between gap-2 rounded-lg bg-background px-2.5 py-1.5 text-xs"
                                >
                                  <span className="min-w-0">
                                    <span className="font-medium">
                                      {parcela.numero}/{parcelas.length}
                                    </span>{" "}
                                    <span className="text-muted-foreground">
                                      {formatDate(parcela.vencimento)} · {formatCurrency(parcela.valor ?? 0)}
                                    </span>
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={cn("shrink-0 text-[0.65rem]", PARCELA_STATUS_BADGE_CLASS[status])}
                                  >
                                    {PARCELA_STATUS_LABELS[status]}
                                  </Badge>
                                </li>
                              )
                            })}
                          </ul>
                        ) : null}

                        {canManage ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3 h-8 w-full gap-1.5"
                            onClick={() => setAnexosOrdem(ordem)}
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                            Gerenciar boletos
                          </Button>
                        ) : null}
                      </div>
                    )
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="fornecedores" className="mt-4">
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Building2 className="h-4.5 w-4.5 text-[#2f7ddf]" />
                    Fornecedores
                  </CardTitle>
                  <CardDescription>Dados de contato, região de atendimento e pagamento.</CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={regiaoFilter}
                    onValueChange={(value) => setRegiaoFilter(value as typeof ALL_VALUE | FornecedorRegiao)}
                  >
                    <SelectTrigger className="w-[170px]">
                      <SelectValue placeholder="Todas as regiões" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_VALUE}>Todas as regiões</SelectItem>
                      {FORNECEDOR_REGIAO_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {canManage ? (
                    <Button
                      onClick={() => {
                        setEditingFornecedor(null)
                        setIsFornecedorModalOpen(true)
                      }}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Novo Fornecedor
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Razão Social</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Região</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingFornecedores && fornecedores.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                          Carregando fornecedores...
                        </TableCell>
                      </TableRow>
                    ) : filteredFornecedores.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                          Nenhum fornecedor cadastrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredFornecedores.map((fornecedor) => (
                        <TableRow key={fornecedor.id}>
                          <TableCell className="font-medium">{fornecedor.razaoSocial}</TableCell>
                          <TableCell className="font-mono text-xs">{fornecedor.cnpj || "—"}</TableCell>
                          <TableCell>
                            {fornecedor.regiao ? (
                              <Badge
                                variant="outline"
                                className={cn("gap-1", FORNECEDOR_REGIAO_BADGE_CLASS[fornecedor.regiao])}
                              >
                                <MapPin className="h-3 w-3" />
                                {formatRegiao(fornecedor)}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-0.5 text-xs text-muted-foreground">
                              {fornecedor.telefone ? (
                                <p className="flex items-center gap-1.5">
                                  <Phone className="h-3 w-3" />
                                  {fornecedor.telefone}
                                </p>
                              ) : null}
                              {fornecedor.email ? (
                                <p className="flex items-center gap-1.5">
                                  <Mail className="h-3 w-3" />
                                  {fornecedor.email}
                                </p>
                              ) : null}
                              {!fornecedor.telefone && !fornecedor.email ? <p>—</p> : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1.5 text-xs">
                              <UserRound className="h-3 w-3 text-muted-foreground" />
                              {fornecedor.responsavel || "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-0.5 text-xs text-muted-foreground">
                              <p>PIX: {fornecedor.chavePix || "—"}</p>
                              <p>
                                {fornecedor.banco || "—"}
                                {fornecedor.agencia ? ` · Ag. ${fornecedor.agencia}` : ""}
                                {fornecedor.conta ? ` · CC ${fornecedor.conta}` : ""}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1.5">
                              {canManage ? (
                                <>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    aria-label="Editar fornecedor"
                                    onClick={() => {
                                      setEditingFornecedor(fornecedor)
                                      setIsFornecedorModalOpen(true)
                                    }}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-destructive"
                                    aria-label="Excluir fornecedor"
                                    onClick={() => setDeletingFornecedor(fornecedor)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <FornecedorModal
        open={isFornecedorModalOpen}
        onOpenChange={setIsFornecedorModalOpen}
        fornecedor={editingFornecedor}
        onSave={handleSaveFornecedor}
      />

      <OrdemServicoModal
        open={isOrdemModalOpen}
        onOpenChange={setIsOrdemModalOpen}
        ordem={editingOrdem}
        fornecedores={fornecedores}
        vehicles={vehicles}
        onSave={handleSaveOrdem}
      />

      <OrdemAnexosModal
        open={anexosOrdem !== null}
        onOpenChange={(value) => {
          if (!value) setAnexosOrdem(null)
        }}
        ordem={anexosOrdem}
        onSave={handleSaveAnexos}
      />

      <Dialog
        open={rejectingOrdem !== null}
        onOpenChange={(value) => {
          if (!value) {
            setRejectingOrdem(null)
            setRejectionReason("")
          }
        }}
      >
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Rejeitar Orçamento</DialogTitle>
            <DialogDescription>
              {rejectingOrdem ? `${rejectingOrdem.placa} — ${rejectingOrdem.descricao}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 py-2">
            <Label htmlFor="motivoRejeicao">Motivo da rejeição</Label>
            <Textarea
              id="motivoRejeicao"
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder="Explique por que o orçamento não foi aprovado."
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRejectingOrdem(null)
                setRejectionReason("")
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={decidingId !== null}
              onClick={handleConfirmRejection}
            >
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deletingOrdem !== null}
        onOpenChange={(value) => {
          if (!value) setDeletingOrdem(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ordem de serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingOrdem
                ? `A ordem de ${deletingOrdem.placa} e seus vínculos de anexos serão removidos. Essa ação não pode ser desfeita.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteOrdem}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deletingFornecedor !== null}
        onOpenChange={(value) => {
          if (!value) setDeletingFornecedor(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fornecedor?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingFornecedor
                ? `${deletingFornecedor.razaoSocial} será removido do cadastro. As ordens existentes ficarão sem fornecedor vinculado.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFornecedor}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

type StatCardProps = {
  label: string
  value: string
  hint: string
  icon: typeof ClipboardList
  accent: string
}

function StatCard({ label, value, hint, icon: Icon, accent }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-muted-foreground">{label}</p>
          <p className="truncate text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", accent)}>
          <Icon className="h-5 w-5" />
        </span>
      </CardContent>
    </Card>
  )
}
