"use client"

import { useMemo, useRef, useState } from "react"
import {
  CalendarDays,
  Download,
  FileSpreadsheet,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react"
import { useFuelDataContext } from "@/components/fuel/fuel-data-provider"
import {
  BudgetCenterRow,
  FUEL_BUDGET_STATUS_STYLES,
  formatBudgetCurrency,
} from "@/components/fuel/fuel-budget-overview-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useFuelBudgetAnalysis } from "@/hooks/use-fuel-budget-analysis"
import { FUEL_BUDGET_PLAN_SWR_KEY, useFuelBudgetPlan } from "@/hooks/use-fuel-budget-plan"
import { useToast } from "@/hooks/use-toast"
import { normalizeCostCenterDriverName, normalizeCostCenterLabel } from "@/lib/cost-center-shared"
import {
  FUEL_BUDGET_DEFAULT_DAYS_PER_WEEK,
  FUEL_BUDGET_STATUS_LABEL,
  FUEL_BUDGET_WEEKS_PER_MONTH,
  createBudgetCollaboratorId,
  formatBudgetCenterName,
  getFuelBudgetStatus,
  isDefaultTelecomBudgetCenter,
  normalizeBudgetPlate,
  normalizeFuelBudgetPlan,
  resolveBudgetCenterId,
  sumFuelBudgetCenters,
  type FuelBudgetCenter,
  type FuelBudgetCenterAnalysis,
  type FuelBudgetCollaborator,
  type FuelBudgetGroup,
  type FuelBudgetPlan,
} from "@/lib/fuel-budget-plan-shared"
import { exportFuelBudgetWorkbook, parseFuelBudgetWorkbook } from "@/lib/fuel-budget-plan-xlsx"
import { cn } from "@/lib/utils"

type FuelBudgetPanelProps = {
  isMaster?: boolean
}

type NewCollaboratorDraft = {
  name: string
  plate: string
  dailyValue: string
  daysPerWeek: string
}

const EMPTY_NEW_COLLABORATOR: NewCollaboratorDraft = { name: "", plate: "", dailyValue: "", daysPerWeek: `${FUEL_BUDGET_DEFAULT_DAYS_PER_WEEK}` }

function parseDecimal(value: string): number {
  const trimmed = value.trim()
  if (!trimmed) return 0
  const normalized = trimmed.includes(",") ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function getMostCommonDailyValue(collaborators: FuelBudgetCollaborator[]): number {
  const counts = new Map<number, number>()
  for (const collaborator of collaborators) {
    if (collaborator.dailyValue <= 0) continue
    counts.set(collaborator.dailyValue, (counts.get(collaborator.dailyValue) ?? 0) + 1)
  }
  let best = 0
  let bestCount = 0
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value
      bestCount = count
    }
  }
  return best
}

export function FuelBudgetPanel({ isMaster = false }: FuelBudgetPanelProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { availableMonths, setSelectedMonth } = useFuelDataContext()
  const { plan: serverPlan, hasLoaded, isLoading, warning, mutate } = useFuelBudgetPlan()
  const [draft, setDraft] = useState<FuelBudgetPlan | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [groupView, setGroupView] = useState<FuelBudgetGroup>("telecom")
  const [selectedCenterCode, setSelectedCenterCode] = useState<string | null>(null)
  const [newCollaborator, setNewCollaborator] = useState<NewCollaboratorDraft>(EMPTY_NEW_COLLABORATOR)
  const [centerToAdd, setCenterToAdd] = useState("")

  const workingPlan = draft ?? serverPlan
  const isDirty = draft !== null
  const canEdit = isMaster
  const { analysis, monthKey, monthLabel, costCenterRecords } = useFuelBudgetAnalysis(workingPlan)

  const planCentersByCode = useMemo(() => new Map(workingPlan.centers.map((center) => [center.centerCode, center])), [workingPlan.centers])

  const groupCenters = useMemo(() => {
    return analysis.centers.filter((center) => {
      if (groupView === "telecom") return center.group === "telecom"
      return center.group === "outros" && (center.inPlan || center.spentMonth > 0)
    })
  }, [analysis.centers, groupView])

  const groupTotals = useMemo(() => sumFuelBudgetCenters(groupCenters.filter((center) => center.inPlan)), [groupCenters])

  const activeCenterCode = useMemo(() => {
    if (selectedCenterCode && groupCenters.some((center) => center.centerCode === selectedCenterCode)) return selectedCenterCode
    return groupCenters[0]?.centerCode ?? null
  }, [groupCenters, selectedCenterCode])

  const activeAnalysis = useMemo(
    () => analysis.centers.find((center) => center.centerCode === activeCenterCode) ?? null,
    [activeCenterCode, analysis.centers],
  )
  const activePlanCenter = activeCenterCode ? planCentersByCode.get(activeCenterCode) ?? null : null

  const registryCenters = useMemo(() => {
    const labels = new Map<string, string>()
    for (const record of costCenterRecords) {
      const label = normalizeCostCenterLabel(record.centroCusto)
      const code = resolveBudgetCenterId(label, workingPlan.centers)
      if (code && !labels.has(code)) labels.set(code, label)
    }
    for (const center of analysis.centers) {
      if (!center.centerCode.startsWith("__") && !labels.has(center.centerCode)) labels.set(center.centerCode, center.centerLabel)
    }
    return Array.from(labels.entries())
      .filter(([code]) => !planCentersByCode.has(code))
      .map(([code, label]) => ({ code, label }))
      .sort((left, right) => left.label.localeCompare(right.label, "pt-BR"))
  }, [analysis.centers, costCenterRecords, planCentersByCode, workingPlan.centers])

  const registryDriversForActiveCenter = useMemo(() => {
    if (!activeCenterCode) return []
    const listed = new Set((activePlanCenter?.collaborators ?? []).map((collaborator) => normalizeCostCenterDriverName(collaborator.name)))
    return costCenterRecords
      .filter((record) => resolveBudgetCenterId(record.centroCusto, workingPlan.centers) === activeCenterCode)
      .map((record) => record.motorista)
      .filter((name) => name && !listed.has(normalizeCostCenterDriverName(name)))
      .sort((left, right) => left.localeCompare(right, "pt-BR"))
  }, [activeCenterCode, activePlanCenter?.collaborators, costCenterRecords, workingPlan.centers])

  function updatePlan(updater: (plan: FuelBudgetPlan) => FuelBudgetPlan) {
    setDraft((current) => updater(current ?? serverPlan))
  }

  function updateCenter(centerCode: string, updater: (center: FuelBudgetCenter) => FuelBudgetCenter) {
    updatePlan((plan) => ({
      ...plan,
      centers: plan.centers.map((center) => (center.centerCode === centerCode ? updater(center) : center)),
    }))
  }

  function updateCollaborator(centerCode: string, collaboratorId: string, patch: Partial<FuelBudgetCollaborator>) {
    updateCenter(centerCode, (center) => ({
      ...center,
      collaborators: center.collaborators.map((collaborator) =>
        collaborator.id === collaboratorId ? { ...collaborator, ...patch } : collaborator,
      ),
    }))
  }

  function removeCollaborator(centerCode: string, collaboratorId: string) {
    updateCenter(centerCode, (center) => ({
      ...center,
      collaborators: center.collaborators.filter((collaborator) => collaborator.id !== collaboratorId),
    }))
  }

  function addCollaborators(centerCode: string, entries: Array<Partial<FuelBudgetCollaborator> & { name: string }>) {
    updateCenter(centerCode, (center) => {
      const existing = new Set(center.collaborators.map((collaborator) => normalizeCostCenterDriverName(collaborator.name)))
      const defaultDaily = getMostCommonDailyValue(center.collaborators)
      const additions: FuelBudgetCollaborator[] = []

      for (const entry of entries) {
        const name = entry.name.replace(/\s+/g, " ").trim()
        const key = normalizeCostCenterDriverName(name)
        if (!name || existing.has(key)) continue
        existing.add(key)
        additions.push({
          id: createBudgetCollaboratorId(),
          name,
          plate: normalizeBudgetPlate(entry.plate ?? ""),
          dailyValue: entry.dailyValue ?? defaultDaily,
          daysPerWeek: entry.daysPerWeek ?? FUEL_BUDGET_DEFAULT_DAYS_PER_WEEK,
          active: true,
        })
      }

      return { ...center, collaborators: [...center.collaborators, ...additions] }
    })
  }

  function ensureCenterInPlan(centerCode: string, centerLabel: string, group: FuelBudgetGroup) {
    updatePlan((plan) => {
      if (plan.centers.some((center) => center.centerCode === centerCode)) return plan
      return normalizeFuelBudgetPlan({
        ...plan,
        centers: [...plan.centers, { centerCode, centerLabel, group, manualMonthlyBudget: 0, collaborators: [] }],
      })
    })
    setGroupView(group)
    setSelectedCenterCode(centerCode)
  }

  function removeCenter(centerCode: string) {
    updatePlan((plan) => ({ ...plan, centers: plan.centers.filter((center) => center.centerCode !== centerCode) }))
    setSelectedCenterCode(null)
  }

  function handleAddNewCollaborator() {
    if (!activeCenterCode || !newCollaborator.name.trim()) return
    addCollaborators(activeCenterCode, [
      {
        name: newCollaborator.name,
        plate: newCollaborator.plate,
        dailyValue: newCollaborator.dailyValue.trim() ? parseDecimal(newCollaborator.dailyValue) : undefined,
        daysPerWeek: Math.min(7, Math.max(0, Math.round(parseDecimal(newCollaborator.daysPerWeek) || FUEL_BUDGET_DEFAULT_DAYS_PER_WEEK))),
      },
    ])
    setNewCollaborator(EMPTY_NEW_COLLABORATOR)
  }

  async function handleSave() {
    if (!draft) return
    setIsSaving(true)

    try {
      const currentLabels = new Map(analysis.centers.map((center) => [center.centerCode, center.centerLabel]))
      const planToSave: FuelBudgetPlan = {
        ...draft,
        centers: draft.centers.map((center) => ({ ...center, centerLabel: currentLabels.get(center.centerCode) ?? center.centerLabel })),
      }
      const response = await fetch(FUEL_BUDGET_PLAN_SWR_KEY, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planToSave }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || "Falha ao salvar o orçamento.")

      await mutate({ plan: payload.plan }, { revalidate: false })
      setDraft(null)
      toast({
        title: "Orçamento salvo",
        description:
          payload?.storage === "local"
            ? "Salvo apenas localmente. Verifique a conexão com o Google Drive."
            : "Os valores de orçado foram atualizados.",
      })
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Não foi possível salvar o orçamento.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleImport(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    setIsImporting(true)

    try {
      const imported = await parseFuelBudgetWorkbook(await file.arrayBuffer())
      if (imported.length === 0) {
        throw new Error("Nenhuma tabela com CENTRO DE CUSTO / NOME MOTORISTA / VALOR DIÁRIO foi encontrada na planilha.")
      }

      updatePlan((plan) => {
        const centers = new Map(plan.centers.map((center) => [center.centerCode, center]))
        for (const item of imported) {
          const current = centers.get(item.centerCode)
          centers.set(item.centerCode, {
            centerCode: item.centerCode,
            centerLabel: current?.centerLabel || item.centerLabel,
            group: current?.group ?? (isDefaultTelecomBudgetCenter(item.centerCode) ? "telecom" : "outros"),
            manualMonthlyBudget: current?.manualMonthlyBudget ?? 0,
            collaborators: item.collaborators,
          })
        }
        return normalizeFuelBudgetPlan({ ...plan, centers: Array.from(centers.values()) })
      })

      const collaboratorsCount = imported.reduce((sum, item) => sum + item.collaborators.length, 0)
      toast({
        title: "Planilha importada",
        description: `${imported.length} centro(s) e ${collaboratorsCount} colaborador(es) carregados. Revise e clique em Salvar.`,
      })
    } catch (error) {
      toast({
        title: "Erro ao importar",
        description: error instanceof Error ? error.message : "Não foi possível ler a planilha.",
        variant: "destructive",
      })
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleExport() {
    const centers = groupCenters.filter((center) => center.inPlan || center.spentMonth > 0)
    await exportFuelBudgetWorkbook({
      analysis,
      centers,
      monthLabel,
      scopeLabel: groupView === "telecom" ? "Telecom" : "Outros centros",
    })
  }

  return (
    <div className="space-y-4">
      <Card className="border-[#d8dfd1] bg-[linear-gradient(180deg,#fcfdfb_0%,#f5f8f2_100%)] shadow-sm">
        <CardHeader className="border-b border-[#e5ece0] pb-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <CardTitle className="text-xl text-slate-900">Orçamento de combustível — Orçado x Gasto</CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                Defina o valor diário de cada colaborador. O orçado semanal é diária × dias trabalhados e o mensal é semanal ×{" "}
                {FUEL_BUDGET_WEEKS_PER_MONTH}, como na planilha semanal.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={monthKey} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-9 w-[190px] bg-white capitalize">
                  <CalendarDays className="mr-1 h-4 w-4 text-[#6f9f4c]" />
                  <SelectValue placeholder="Competência" />
                </SelectTrigger>
                <SelectContent>
                  {(availableMonths.length > 0 ? availableMonths : [{ month: monthKey, label: monthLabel }]).map((month) => (
                    <SelectItem key={month.month} value={month.month} className="capitalize">
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {canEdit ? (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(event) => void handleImport(event.target.files)}
                  />
                  <Button variant="outline" size="sm" className="h-9 bg-white" disabled={isImporting} onClick={() => fileInputRef.current?.click()}>
                    {isImporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-1.5 h-4 w-4" />}
                    Importar planilha
                  </Button>
                </>
              ) : null}
              <Button variant="outline" size="sm" className="h-9 bg-white" onClick={() => void handleExport()}>
                <Download className="mr-1.5 h-4 w-4" />
                Exportar Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          {!canEdit ? (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-600">
              <Lock className="h-4 w-4 text-slate-400" />
              Visualização somente leitura. Apenas o usuário mestre pode editar o orçado.
            </div>
          ) : null}
          {warning ? <p className="rounded-xl border border-[#ecd9a6] bg-[#fffaea] px-3 py-2 text-sm text-[#8a6513]">{warning}</p> : null}
          {isDirty ? (
            <div className="flex flex-col gap-2 rounded-xl border border-[#ecd9a6] bg-[#fffaea] px-3 py-2 text-sm text-[#8a6513] sm:flex-row sm:items-center sm:justify-between">
              <span>Há alterações não salvas. Os números abaixo já mostram a simulação com os novos valores.</span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setDraft(null)} disabled={isSaving}>
                  <RotateCcw className="mr-1.5 h-4 w-4" />
                  Descartar
                </Button>
                <Button size="sm" className="bg-[#4e8f57] hover:bg-[#437c4b]" onClick={() => void handleSave()} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                  Salvar alterações
                </Button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
            <SummaryTile label="Orçado diário" value={groupTotals.budgetDaily} />
            <SummaryTile label="Orçado semanal" value={groupTotals.budgetWeekly} />
            <SummaryTile label="Orçado mensal" value={groupTotals.budgetMonthly} highlight />
            <SummaryTile label="Gasto no mês" value={groupTotals.spentMonth} />
            <SummaryTile label="Projeção do mês" value={groupTotals.projection} />
            <SummaryTile
              label="Saldo projetado"
              value={groupTotals.projectedBalance}
              tone={groupTotals.budgetMonthly <= 0 ? undefined : groupTotals.projectedBalance < 0 ? "danger" : "success"}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-fit border-[#d8dfd1] shadow-sm">
          <CardContent className="space-y-3 p-3">
            <div className="flex rounded-xl border border-[#dce6d6] bg-[#f7faf5] p-1">
              {(["telecom", "outros"] as const).map((group) => (
                <button
                  key={group}
                  type="button"
                  onClick={() => setGroupView(group)}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    groupView === group ? "bg-[#4e8f57] text-white shadow-sm" : "text-slate-600 hover:bg-white",
                  )}
                >
                  {group === "telecom" ? "Telecom" : "Outros centros"}
                </button>
              ))}
            </div>

            {isLoading && !hasLoaded ? (
              <div className="h-40 animate-pulse rounded-xl bg-muted/40" />
            ) : groupCenters.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#dce6d6] p-4 text-center text-sm text-slate-500">
                Nenhum centro neste grupo.
              </p>
            ) : (
              <div className="space-y-2">
                {groupCenters.map((center) => (
                  <div key={center.centerCode} className="relative">
                    <BudgetCenterRow
                      center={center}
                      active={center.centerCode === activeCenterCode}
                      onClick={() => setSelectedCenterCode(center.centerCode)}
                    />
                    {!center.inPlan ? (
                      <span className="pointer-events-none absolute bottom-2 right-3 rounded bg-slate-100 px-1.5 text-[10px] font-medium text-slate-500">
                        sem orçado
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            )}

            {canEdit ? (
              <div className="space-y-2 border-t border-[#e5ece0] pt-3">
                <Label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Adicionar centro de custo</Label>
                <div className="flex gap-2">
                  <Select value={centerToAdd} onValueChange={setCenterToAdd}>
                    <SelectTrigger className="h-9 flex-1 bg-white text-left">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {registryCenters.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-slate-500">Todos os centros já estão no orçamento.</div>
                      ) : (
                        registryCenters.map((center) => (
                          <SelectItem key={center.code} value={center.code}>
                            {center.label}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="h-9 bg-[#4e8f57] hover:bg-[#437c4b]"
                    disabled={!centerToAdd}
                    onClick={() => {
                      const center = registryCenters.find((item) => item.code === centerToAdd)
                      if (!center) return
                      ensureCenterInPlan(center.code, center.label, groupView)
                      setCenterToAdd("")
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[11px] text-slate-500">O centro entra no grupo selecionado acima ({groupView === "telecom" ? "Telecom" : "Outros"}).</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {activeAnalysis ? (
          <CenterDetail
            key={activeAnalysis.centerCode}
            center={activeAnalysis}
            planCenter={activePlanCenter}
            weeks={analysis.weeks}
            currentWeekIndex={analysis.currentWeekIndex}
            canEdit={canEdit}
            registryDrivers={registryDriversForActiveCenter}
            newCollaborator={newCollaborator}
            onNewCollaboratorChange={setNewCollaborator}
            onAddNewCollaborator={handleAddNewCollaborator}
            onAddCollaborators={(entries) => activeCenterCode && addCollaborators(activeCenterCode, entries)}
            onUpdateCenter={(updater) => activeCenterCode && updateCenter(activeCenterCode, updater)}
            onUpdateCollaborator={(id, patch) => activeCenterCode && updateCollaborator(activeCenterCode, id, patch)}
            onRemoveCollaborator={(id) => activeCenterCode && removeCollaborator(activeCenterCode, id)}
            onAddToPlan={() => activeAnalysis && ensureCenterInPlan(activeAnalysis.centerCode, activeAnalysis.centerLabel, "outros")}
            onRemoveCenter={() => activeCenterCode && removeCenter(activeCenterCode)}
          />
        ) : (
          <Card className="border-dashed border-[#dce6d6]">
            <CardContent className="flex h-48 items-center justify-center text-sm text-slate-500">Selecione um centro de custo.</CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function SummaryTile({ label, value, highlight, tone }: { label: string; value: number; highlight?: boolean; tone?: "success" | "danger" }) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        highlight ? "border-[#cfe3c4] bg-[#f3faef]" : "border-[#e2eadc] bg-white/85",
        tone === "danger" && "border-[#f1c4be] bg-[#fff3f1]",
        tone === "success" && "border-[#cfe3c4] bg-[#f3faef]",
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-lg font-extrabold tracking-tight text-slate-900",
          tone === "danger" && "text-[#b03e31]",
          tone === "success" && "text-[#3f6b33]",
        )}
      >
        {formatBudgetCurrency(value)}
      </p>
    </div>
  )
}

type CenterDetailProps = {
  center: FuelBudgetCenterAnalysis
  planCenter: FuelBudgetCenter | null
  weeks: Array<{ index: number; label: string; startDay: number; endDay: number }>
  currentWeekIndex: number
  canEdit: boolean
  registryDrivers: string[]
  newCollaborator: NewCollaboratorDraft
  onNewCollaboratorChange: (value: NewCollaboratorDraft) => void
  onAddNewCollaborator: () => void
  onAddCollaborators: (entries: Array<Partial<FuelBudgetCollaborator> & { name: string }>) => void
  onUpdateCenter: (updater: (center: FuelBudgetCenter) => FuelBudgetCenter) => void
  onUpdateCollaborator: (id: string, patch: Partial<FuelBudgetCollaborator>) => void
  onRemoveCollaborator: (id: string) => void
  onAddToPlan: () => void
  onRemoveCenter: () => void
}

function CenterDetail({
  center,
  planCenter,
  weeks,
  currentWeekIndex,
  canEdit,
  registryDrivers,
  newCollaborator,
  onNewCollaboratorChange,
  onAddNewCollaborator,
  onAddCollaborators,
  onUpdateCenter,
  onUpdateCollaborator,
  onRemoveCollaborator,
  onAddToPlan,
  onRemoveCenter,
}: CenterDetailProps) {
  const status = getFuelBudgetStatus(center.budgetMonthly, center.projection)
  const editable = canEdit && planCenter !== null
  const isUnassigned = center.centerCode.startsWith("__")
  const datalistId = `budget-drivers-${center.centerCode}`

  return (
    <Card className="border-[#d8dfd1] shadow-sm">
      <CardHeader className="space-y-3 border-b border-[#e5ece0] pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="text-lg text-slate-900" title="Nome conforme o cadastro de centro de custo">
              {formatBudgetCenterName(center)}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className={cn("rounded-full border px-2 py-0.5 font-semibold uppercase tracking-[0.08em]", FUEL_BUDGET_STATUS_STYLES[status])}>
                {FUEL_BUDGET_STATUS_LABEL[status]}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {center.collaborators.filter((collaborator) => collaborator.active).length} colaborador(es) ativos
              </span>
              <span>· {center.transactions} transações no mês</span>
            </div>
          </div>

          {editable ? (
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={planCenter.group}
                onValueChange={(value) => onUpdateCenter((current) => ({ ...current, group: value as FuelBudgetGroup }))}
              >
                <SelectTrigger className="h-9 w-[150px] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="telecom">Grupo Telecom</SelectItem>
                  <SelectItem value="outros">Outros centros</SelectItem>
                </SelectContent>
              </Select>
              {!isDefaultTelecomBudgetCenter(planCenter.centerCode) ? (
                <Button variant="outline" size="sm" className="h-9 text-[#b03e31]" onClick={onRemoveCenter}>
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Remover do orçamento
                </Button>
              ) : null}
            </div>
          ) : null}

          {canEdit && !planCenter && !isUnassigned ? (
            <Button size="sm" className="bg-[#4e8f57] hover:bg-[#437c4b]" onClick={onAddToPlan}>
              <Plus className="mr-1.5 h-4 w-4" />
              Definir orçado para este centro
            </Button>
          ) : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
          <MiniStat label="Orçado diário" value={center.budgetDaily} />
          <MiniStat label="Orçado semanal" value={center.budgetWeekly} />
          <MiniStat label="Orçado mensal" value={center.budgetMonthly} />
          <MiniStat label="Gasto no mês" value={center.spentMonth} />
          <MiniStat label="Projeção" value={center.projection} />
          <MiniStat
            label="Saldo projetado"
            value={center.projectedBalance}
            tone={center.budgetMonthly <= 0 ? undefined : center.projectedBalance < 0 ? "danger" : "success"}
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {weeks.map((week) => {
            const spent = center.spentByWeek[week.index] ?? 0
            const budget = center.budgetWeekly
            const percent = budget > 0 ? (spent / budget) * 100 : 0
            const isCurrent = week.index === currentWeekIndex

            return (
              <div
                key={week.index}
                className={cn("rounded-xl border bg-white/90 p-2.5", isCurrent ? "border-[#9cc58a] ring-1 ring-[#cfe3c4]" : "border-[#e2eadc]")}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">
                    {week.label} <span className="font-normal text-slate-400">({week.startDay}–{week.endDay})</span>
                  </span>
                  {isCurrent ? <Badge className="h-4 bg-[#4e8f57] px-1.5 text-[9px]">atual</Badge> : null}
                </div>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {formatBudgetCurrency(spent)}
                  {budget > 0 ? <span className="font-normal text-slate-500"> / {formatBudgetCurrency(budget)}</span> : null}
                </p>
                {budget > 0 ? (
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn("h-full rounded-full", percent > 100 ? "bg-[#c4483a]" : percent > 90 ? "bg-[#e0a43a]" : "bg-[#4e8f57]")}
                      style={{ width: `${Math.min(100, percent)}%` }}
                    />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4">
        {planCenter && planCenter.collaborators.length === 0 ? (
          <div className="flex flex-col gap-2 rounded-xl border border-[#e2eadc] bg-[#f9fbf7] p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-600">
              <p className="font-semibold text-slate-800">Orçado mensal manual</p>
              <p className="text-xs text-slate-500">Usado enquanto o centro não tem colaboradores com diária cadastrada.</p>
            </div>
            {editable ? (
              <Input
                type="number"
                min={0}
                step="0.01"
                value={planCenter.manualMonthlyBudget || ""}
                placeholder="0,00"
                onChange={(event) => onUpdateCenter((current) => ({ ...current, manualMonthlyBudget: parseDecimal(event.target.value) }))}
                className="h-9 w-[180px] bg-white text-right"
              />
            ) : (
              <span className="text-lg font-bold">{formatBudgetCurrency(planCenter.manualMonthlyBudget)}</span>
            )}
          </div>
        ) : null}

        {center.collaborators.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-[#e2eadc]">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#f6f9f3] hover:bg-[#f6f9f3]">
                  <TableHead className="w-[52px]">Ativo</TableHead>
                  <TableHead className="min-w-[200px]">Colaborador</TableHead>
                  <TableHead className="w-[110px]">Placa</TableHead>
                  <TableHead className="w-[110px] text-right">Diária</TableHead>
                  <TableHead className="w-[80px] text-right">Dias/sem</TableHead>
                  <TableHead className="text-right">Orçado sem.</TableHead>
                  <TableHead className="text-right">Orçado mês</TableHead>
                  {weeks.map((week) => (
                    <TableHead key={week.index} className={cn("text-right", week.index === currentWeekIndex && "bg-[#eef7e9]")}>
                      S{week.index + 1}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Gasto mês</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  {editable ? <TableHead className="w-[44px]" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {center.collaborators.map((collaborator) => {
                  const balance = collaborator.monthlyBudget - collaborator.spentMonth

                  return (
                    <TableRow key={collaborator.id} className={cn(!collaborator.active && "opacity-55")}>
                      <TableCell>
                        <Switch
                          checked={collaborator.active}
                          disabled={!editable}
                          onCheckedChange={(checked) => onUpdateCollaborator(collaborator.id, { active: checked })}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-slate-800">
                        {editable ? (
                          <Input
                            value={collaborator.name}
                            onChange={(event) => onUpdateCollaborator(collaborator.id, { name: event.target.value })}
                            className="h-8 bg-white"
                          />
                        ) : (
                          collaborator.name
                        )}
                      </TableCell>
                      <TableCell>
                        {editable ? (
                          <Input
                            value={collaborator.plate}
                            onChange={(event) => onUpdateCollaborator(collaborator.id, { plate: normalizeBudgetPlate(event.target.value) })}
                            className="h-8 bg-white uppercase"
                          />
                        ) : (
                          collaborator.plate || "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editable ? (
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={collaborator.dailyValue || ""}
                            placeholder="0"
                            onChange={(event) => onUpdateCollaborator(collaborator.id, { dailyValue: parseDecimal(event.target.value) })}
                            className="h-8 bg-white text-right"
                          />
                        ) : (
                          formatBudgetCurrency(collaborator.dailyValue)
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editable ? (
                          <Input
                            type="number"
                            min={0}
                            max={7}
                            step="1"
                            value={collaborator.daysPerWeek}
                            onChange={(event) =>
                              onUpdateCollaborator(collaborator.id, {
                                daysPerWeek: Math.min(7, Math.max(0, Math.round(parseDecimal(event.target.value)))),
                              })
                            }
                            className="h-8 bg-white text-right"
                          />
                        ) : (
                          collaborator.daysPerWeek
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatBudgetCurrency(collaborator.weeklyBudget)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatBudgetCurrency(collaborator.monthlyBudget)}</TableCell>
                      {weeks.map((week) => {
                        const spent = collaborator.spentByWeek[week.index] ?? 0
                        const extra = spent - collaborator.weeklyBudget
                        return (
                          <TableCell
                            key={week.index}
                            title={extra > 0 ? `Adicional: ${formatBudgetCurrency(extra)}` : undefined}
                            className={cn(
                              "text-right tabular-nums",
                              week.index === currentWeekIndex && "bg-[#f6fbf3]",
                              extra > 0 && collaborator.weeklyBudget >= 0 && spent > 0 ? "font-semibold text-[#b03e31]" : "text-slate-700",
                            )}
                          >
                            {spent > 0 ? formatBudgetCurrency(spent) : "—"}
                          </TableCell>
                        )
                      })}
                      <TableCell className="text-right font-semibold tabular-nums">{formatBudgetCurrency(collaborator.spentMonth)}</TableCell>
                      <TableCell className={cn("text-right font-semibold tabular-nums", balance < 0 ? "text-[#b03e31]" : "text-[#3f6b33]")}>
                        {formatBudgetCurrency(balance)}
                      </TableCell>
                      {editable ? (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-[#b03e31]"
                            onClick={() => onRemoveCollaborator(collaborator.id)}
                            title="Remover colaborador"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  )
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-[#f6f9f3] font-semibold hover:bg-[#f6f9f3]">
                  <TableCell />
                  <TableCell>Total</TableCell>
                  <TableCell />
                  <TableCell className="text-right tabular-nums">{formatBudgetCurrency(center.budgetDaily)}</TableCell>
                  <TableCell />
                  <TableCell className="text-right tabular-nums">{formatBudgetCurrency(center.budgetWeekly)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBudgetCurrency(center.budgetMonthly)}</TableCell>
                  {weeks.map((week) => (
                    <TableCell key={week.index} className="text-right tabular-nums">
                      {formatBudgetCurrency(center.collaborators.reduce((sum, collaborator) => sum + (collaborator.spentByWeek[week.index] ?? 0), 0))}
                    </TableCell>
                  ))}
                  <TableCell className="text-right tabular-nums">
                    {formatBudgetCurrency(center.collaborators.reduce((sum, collaborator) => sum + collaborator.spentMonth, 0))}
                  </TableCell>
                  <TableCell />
                  {editable ? <TableCell /> : null}
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        ) : null}

        {editable ? (
          <div className="space-y-2 rounded-xl border border-[#e2eadc] bg-[#f9fbf7] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                <UserPlus className="h-4 w-4 text-[#4e8f57]" />
                Adicionar colaborador
              </p>
              {registryDrivers.length > 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 bg-white"
                  onClick={() => onAddCollaborators(registryDrivers.map((name) => ({ name })))}
                >
                  Puxar {registryDrivers.length} do cadastro de centro de custo
                </Button>
              ) : null}
            </div>
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px_120px_100px_auto]">
              <Input
                list={datalistId}
                placeholder="Nome do colaborador"
                value={newCollaborator.name}
                onChange={(event) => onNewCollaboratorChange({ ...newCollaborator, name: event.target.value })}
                onKeyDown={(event) => event.key === "Enter" && onAddNewCollaborator()}
                className="h-9 bg-white"
              />
              <datalist id={datalistId}>
                {registryDrivers.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <Input
                placeholder="Placa"
                value={newCollaborator.plate}
                onChange={(event) => onNewCollaboratorChange({ ...newCollaborator, plate: event.target.value })}
                className="h-9 bg-white uppercase"
              />
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="Diária R$"
                value={newCollaborator.dailyValue}
                onChange={(event) => onNewCollaboratorChange({ ...newCollaborator, dailyValue: event.target.value })}
                className="h-9 bg-white text-right"
              />
              <Input
                type="number"
                min={0}
                max={7}
                placeholder="Dias/sem"
                value={newCollaborator.daysPerWeek}
                onChange={(event) => onNewCollaboratorChange({ ...newCollaborator, daysPerWeek: event.target.value })}
                className="h-9 bg-white text-right"
              />
              <Button className="h-9 bg-[#4e8f57] hover:bg-[#437c4b]" disabled={!newCollaborator.name.trim()} onClick={onAddNewCollaborator}>
                <Plus className="mr-1 h-4 w-4" />
                Adicionar
              </Button>
            </div>
            <p className="text-[11px] text-slate-500">Se a diária ficar em branco, usamos a diária mais comum do centro.</p>
          </div>
        ) : null}

        {center.unlistedDrivers.length > 0 ? (
          <div className="space-y-2 rounded-xl border border-[#ecd9a6] bg-[#fffaea] p-3">
            <p className="text-sm font-semibold text-[#8a6513]">
              Gastos fora do orçado neste centro ({formatBudgetCurrency(center.unlistedDrivers.reduce((sum, driver) => sum + driver.total, 0))})
            </p>
            <p className="text-xs text-[#8a6513]/80">
              Abastecimentos de pessoas que pertencem a este centro no cadastro, mas não estão na lista de colaboradores do orçado.
            </p>
            <div className="flex flex-wrap gap-2">
              {center.unlistedDrivers.map((driver) => (
                <div key={driver.name} className="flex items-center gap-2 rounded-lg border border-[#ecd9a6] bg-white px-2.5 py-1.5 text-xs">
                  <span className="font-medium text-slate-700">{driver.name}</span>
                  <span className="text-slate-500">{formatBudgetCurrency(driver.total)}</span>
                  {editable ? (
                    <button
                      type="button"
                      className="rounded bg-[#4e8f57] px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-[#437c4b]"
                      onClick={() => onAddCollaborators([{ name: driver.name, plate: driver.plate }])}
                    >
                      + incluir
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone?: "success" | "danger" }) {
  return (
    <div className="rounded-lg border border-[#e2eadc] bg-white/90 px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className={cn("text-sm font-bold text-slate-900", tone === "danger" && "text-[#b03e31]", tone === "success" && "text-[#3f6b33]")}>
        {formatBudgetCurrency(value)}
      </p>
    </div>
  )
}
