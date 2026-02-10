"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
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
import { toast } from "@/hooks/use-toast"
import type { Colaborador, ColaboradorFormData, ColaboradorChecklist, DriveFile, Vehicle } from "@/lib/types"

interface ColaboradorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  colaborador?: Colaborador | null
  vehicles: Vehicle[]
  onSave: (data: ColaboradorFormData, veiculoId?: string | null, veiculoKm?: number | null) => void
}

const initialFormData: ColaboradorFormData = {
  nome: "",
  cpf: "",
  telefone: "",
  departamento: "",
  dataVencimentoCNH: "",
  documentos: [],
  checklist: {
    frontal: undefined,
    direita: undefined,
    esquerda: undefined,
    traseira: undefined,
    avarias: [],
  },
}

export function ColaboradorModal({
  open,
  onOpenChange,
  colaborador,
  vehicles,
  onSave,
}: ColaboradorModalProps) {
  const [formData, setFormData] = useState<ColaboradorFormData>(initialFormData)
  const [selectedVeiculoId, setSelectedVeiculoId] = useState<string | null>(null)
  const [selectedVeiculoKm, setSelectedVeiculoKm] = useState<string>("")
  const [errors, setErrors] = useState<Partial<Record<keyof ColaboradorFormData, string>>>({})
  const [uploadingDocs, setUploadingDocs] = useState(false)
  const [uploadingChecklist, setUploadingChecklist] = useState(false)
  const [checklistError, setChecklistError] = useState<string | null>(null)

  // Veículos disponíveis (sem colaborador atribuído) ou o veículo atual do colaborador
  const availableVehicles = vehicles.filter((v) => {
    if (colaborador) {
      // Se editando, mostrar veículos disponíveis + veículo atual do colaborador
      return !v.colaboradorId || v.colaboradorId === colaborador.id
    }
    // Se criando, mostrar apenas veículos disponíveis
    return !v.colaboradorId
  })

  useEffect(() => {
    if (colaborador) {
      setFormData({
        nome: colaborador.nome || "",
        cpf: colaborador.cpf || "",
        telefone: colaborador.telefone || "",
        departamento: colaborador.departamento || "",
        dataVencimentoCNH: colaborador.dataVencimentoCNH || "",
        documentos: colaborador.documentos || [],
        checklist: colaborador.checklist || initialFormData.checklist,
      })
      // Buscar veículo atual do colaborador
      const currentVehicle = vehicles.find((v) => v.colaboradorId === colaborador.id)
      setSelectedVeiculoId(currentVehicle?.id || null)
    } else {
      setFormData(initialFormData)
      setSelectedVeiculoId(null)
    }
    setSelectedVeiculoKm("")
    setErrors({})
    setChecklistError(null)
  }, [colaborador, open, vehicles])

  const documentos = formData.documentos || []
  const checklist = formData.checklist || initialFormData.checklist

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, "")
    return numbers
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})/, "$1-$2")
      .replace(/(-\d{2})\d+?$/, "$1")
  }

  const formatTelefone = (value: string) => {
    const numbers = value.replace(/\D/g, "")
    if (numbers.length <= 10) {
      return numbers
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4})(\d)/, "$1-$2")
        .replace(/(-\d{4})\d+?$/, "$1")
    }
    return numbers
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .replace(/(-\d{4})\d+?$/, "$1")
  }

  const formatDateBr = (value: string) => {
    if (!value) return ""
    const [year, month, day] = value.split("-")
    if (year && month && day) return `${day}/${month}/${year}`
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return ""
    return parsed.toLocaleDateString("pt-BR")
  }

  const sanitizeFileName = (value: string) => {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
  }

  const selectedVehicle = selectedVeiculoId
    ? vehicles.find((v) => v.id === selectedVeiculoId) || null
    : null

  useEffect(() => {
    if (selectedVehicle) {
      setSelectedVeiculoKm(String(selectedVehicle.km ?? ""))
    } else {
      setSelectedVeiculoKm("")
    }
  }, [selectedVehicle])

  const canGenerateTermo = Boolean(
    selectedVehicle &&
      formData.nome.trim() &&
      formData.cpf.trim() &&
      formData.dataVencimentoCNH
  )

  const handleGenerateTermo = async () => {
    if (!selectedVehicle) {
      toast({
        title: "Aviso",
        description: "Selecione um veiculo para gerar o termo.",
      })
      return
    }

    const payload = {
      name: formData.nome.trim(),
      inumber: formData.cpf.trim(),
      date: formatDateBr(formData.dataVencimentoCNH),
      md: selectedVehicle.modelo || "",
      plc: selectedVehicle.placa || "",
    }

    if (!payload.name || !payload.inumber || !payload.date || !payload.md || !payload.plc) {
      toast({
        title: "Aviso",
        description: "Preencha os dados do colaborador e selecione o veiculo.",
      })
      return
    }

    try {
      const url = `/api/termo?name=${encodeURIComponent(payload.name)}&inumber=${encodeURIComponent(payload.inumber)}&date=${encodeURIComponent(payload.date)}&md=${encodeURIComponent(payload.md)}&plc=${encodeURIComponent(payload.plc)}`
      window.open(url, "_blank")
      
      toast({ title: "Sucesso", description: "Termo aberto em nova guia." })
    } catch {
      toast({
        title: "Erro",
        description: "Nao foi possivel abrir o termo.",
        variant: "destructive",
      })
    }
  }

  const handleUploadDocumentos = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (!formData.cpf.trim()) {
      toast({
        title: "Aviso",
        description: "Informe o CPF antes de enviar documentos.",
      })
      return
    }
    setUploadingDocs(true)

    try {
      const uploaded = [...documentos]

      for (const file of Array.from(files)) {
        const body = new FormData()
        body.append("file", file)
        body.append("entityType", "colaboradores")
        body.append("entityId", sanitizeFileName(formData.cpf || "sem-cpf"))
        body.append("label", "documento")

        const res = await fetch("/api/drive/upload", {
          method: "POST",
          body,
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data?.error || "Falha ao enviar arquivo.")
        }

        const data = await res.json()
        uploaded.push(data)
      }

      setFormData({ ...formData, documentos: uploaded })
      toast({ title: "Sucesso", description: "Documentos enviados para o Drive." })
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao enviar documentos.",
        variant: "destructive",
      })
    } finally {
      setUploadingDocs(false)
    }
  }

  const uploadChecklistFile = async (file: File, label: string): Promise<DriveFile> => {
    const body = new FormData()
    body.append("file", file)
    body.append("entityType", "colaboradores")
    body.append("entityId", sanitizeFileName(formData.cpf || "sem-cpf"))
    body.append("label", label)

    const res = await fetch("/api/drive/upload", {
      method: "POST",
      body,
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data?.error || "Falha ao enviar arquivo.")
    }

    return res.json()
  }

  const handleChecklistImageChange = async (file: File | null, position: keyof ColaboradorChecklist) => {
    if (!file) return
    if (!formData.cpf.trim()) {
      toast({
        title: "Aviso",
        description: "Informe o CPF antes de enviar imagens.",
      })
      return
    }

    setUploadingChecklist(true)
    try {
      const uploaded = await uploadChecklistFile(file, `checklist_${position}`)
      setFormData({
        ...formData,
        checklist: {
          ...checklist,
          [position]: uploaded,
        },
      })
      toast({ title: "Sucesso", description: "Imagem enviada para o Drive." })
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao enviar imagem.",
        variant: "destructive",
      })
    } finally {
      setUploadingChecklist(false)
    }
  }

  const handleAvariaUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (!formData.cpf.trim()) {
      toast({
        title: "Aviso",
        description: "Informe o CPF antes de enviar imagens.",
      })
      return
    }

    const current = checklist.avarias || []
    const remaining = 3 - current.length
    if (remaining <= 0) {
      toast({
        title: "Aviso",
        description: "Limite de 3 imagens de avaria atingido.",
      })
      return
    }

    const toUpload = Array.from(files).slice(0, remaining)
    setUploadingChecklist(true)
    try {
      const uploaded = [...current]
      for (const file of toUpload) {
        const fileData = await uploadChecklistFile(file, "avaria")
        uploaded.push({ file: fileData, descricao: "" })
      }

      setFormData({
        ...formData,
        checklist: {
          ...checklist,
          avarias: uploaded,
        },
      })
      toast({ title: "Sucesso", description: "Imagens de avaria enviadas." })
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao enviar avaria.",
        variant: "destructive",
      })
    } finally {
      setUploadingChecklist(false)
    }
  }

  const handleAvariaDescricaoChange = (index: number, value: string) => {
    const avarias = [...(checklist.avarias || [])]
    const current = avarias[index]
    if (!current) return
    avarias[index] = { ...current, descricao: value }
    setFormData({
      ...formData,
      checklist: {
        ...checklist,
        avarias,
      },
    })
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof ColaboradorFormData, string>> = {}
    let checklistMessage: string | null = null

    if (!formData.nome.trim()) {
      newErrors.nome = "Nome é obrigatório"
    }

    const cpfNumbers = formData.cpf.replace(/\D/g, "")
    if (!cpfNumbers) {
      newErrors.cpf = "CPF é obrigatório"
    } else if (cpfNumbers.length !== 11) {
      newErrors.cpf = "CPF deve ter 11 dígitos"
    }

    const telefoneNumbers = formData.telefone.replace(/\D/g, "")
    if (!telefoneNumbers) {
      newErrors.telefone = "Telefone é obrigatório"
    } else if (telefoneNumbers.length < 10 || telefoneNumbers.length > 11) {
      newErrors.telefone = "Telefone inválido"
    }

    if (!formData.departamento.trim()) {
      newErrors.departamento = "Departamento é obrigatório"
    }

    if (!formData.dataVencimentoCNH) {
      newErrors.dataVencimentoCNH = "Data de vencimento da CNH é obrigatória"
    }

    if (!checklist.frontal || !checklist.direita || !checklist.esquerda || !checklist.traseira) {
      checklistMessage = "Envie as 4 imagens obrigatorias do veiculo."
    } else if ((checklist.avarias || []).some((item) => !item.descricao.trim())) {
      checklistMessage = "Informe a descricao para cada avaria enviada."
    }

    setErrors(newErrors)
    setChecklistError(checklistMessage)
    return Object.keys(newErrors).length === 0 && !checklistMessage
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      const kmValue = selectedVeiculoKm.trim() === "" ? null : Number(selectedVeiculoKm)
      onSave(formData, selectedVeiculoId, Number.isNaN(kmValue) ? null : kmValue)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {colaborador ? "Editar Colaborador" : "Adicionar Colaborador"}
          </DialogTitle>
          <DialogDescription>
            {colaborador
              ? "Atualize as informações do colaborador."
              : "Preencha os dados do novo colaborador."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="nome">Nome Completo</Label>
              <Input
                id="nome"
                placeholder="João da Silva"
                value={formData.nome}
                onChange={(e) =>
                  setFormData({ ...formData, nome: e.target.value })
                }
              />
              {errors.nome && (
                <p className="text-sm text-destructive">{errors.nome}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                placeholder="000.000.000-00"
                value={formData.cpf}
                onChange={(e) =>
                  setFormData({ ...formData, cpf: formatCPF(e.target.value) })
                }
                maxLength={14}
              />
              {errors.cpf && (
                <p className="text-sm text-destructive">{errors.cpf}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                type="tel"
                placeholder="(00) 00000-0000"
                value={formData.telefone}
                onChange={(e) =>
                  setFormData({ ...formData, telefone: formatTelefone(e.target.value) })
                }
                maxLength={15}
              />
              {errors.telefone && (
                <p className="text-sm text-destructive">{errors.telefone}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="departamento">Departamento</Label>
              <Input
                id="departamento"
                placeholder="Comercial, Operações, etc."
                value={formData.departamento}
                onChange={(e) =>
                  setFormData({ ...formData, departamento: e.target.value })
                }
              />
              {errors.departamento && (
                <p className="text-sm text-destructive">{errors.departamento}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dataVencimentoCNH">Data de Vencimento da CNH</Label>
              <Input
                id="dataVencimentoCNH"
                type="date"
                value={formData.dataVencimentoCNH}
                onChange={(e) =>
                  setFormData({ ...formData, dataVencimentoCNH: e.target.value })
                }
              />
              {errors.dataVencimentoCNH && (
                <p className="text-sm text-destructive">{errors.dataVencimentoCNH}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="documentos">Documentos (CNH/CPF/Termo)</Label>
              <Input
                id="documentos"
                type="file"
                multiple
                accept=".pdf,image/*"
                onChange={(e) => handleUploadDocumentos(e.target.files)}
                disabled={uploadingDocs}
              />
              {documentos.length > 0 && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {documentos.map((doc) => (
                    <a
                      key={doc.id}
                      href={doc.webViewLink || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded bg-muted px-2 py-1 text-muted-foreground hover:text-foreground"
                    >
                      {doc.name}
                    </a>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {uploadingDocs ? "Enviando arquivos..." : "Arquivos vao para o Drive da empresa."}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="veiculo">Veículo (Placa)</Label>
              <Select
                value={selectedVeiculoId || "none"}
                onValueChange={(value) =>
                  setSelectedVeiculoId(value === "none" ? null : value)
                }
              >
                <SelectTrigger id="veiculo">
                  <SelectValue placeholder="Selecione um veículo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum veículo</SelectItem>
                  {availableVehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.placa} - {vehicle.modelo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {availableVehicles.length === 0 
                  ? "Nenhum veículo disponível" 
                  : `${availableVehicles.length} veículo(s) disponível(is)`}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="veiculoKm">KM do Veículo</Label>
              <Input
                id="veiculoKm"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={selectedVeiculoKm}
                onChange={(e) => setSelectedVeiculoKm(e.target.value)}
                disabled={!selectedVeiculoId}
                placeholder="Ex: 28950"
              />
              <p className="text-xs text-muted-foreground">
                {selectedVeiculoId ? "Atualize o KM do veículo selecionado." : "Selecione um veículo para editar o KM."}
              </p>
            </div>
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <Label>Checklist do Veiculo (4 imagens obrigatorias)</Label>
                <span className="text-xs text-muted-foreground">Max 3 avarias</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="checklistFrontal">Imagem Frontal</Label>
                  <Input
                    id="checklistFrontal"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleChecklistImageChange(e.target.files?.[0] || null, "frontal")}
                    disabled={uploadingChecklist}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="checklistDireita">Imagem Lado Direito</Label>
                  <Input
                    id="checklistDireita"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleChecklistImageChange(e.target.files?.[0] || null, "direita")}
                    disabled={uploadingChecklist}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="checklistEsquerda">Imagem Lado Esquerdo</Label>
                  <Input
                    id="checklistEsquerda"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleChecklistImageChange(e.target.files?.[0] || null, "esquerda")}
                    disabled={uploadingChecklist}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="checklistTraseira">Imagem Traseira</Label>
                  <Input
                    id="checklistTraseira"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleChecklistImageChange(e.target.files?.[0] || null, "traseira")}
                    disabled={uploadingChecklist}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="avarias">Imagem de Avaria (ate 3)</Label>
                <Input
                  id="avarias"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleAvariaUpload(e.target.files)}
                  disabled={uploadingChecklist}
                />
                {(checklist.avarias || []).length > 0 && (
                  <div className="grid gap-3">
                    {(checklist.avarias || []).map((avaria, index) => (
                      <div key={avaria.file.id} className="grid gap-2 rounded border border-border p-2">
                        <a
                          href={avaria.file.webViewLink || "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary"
                        >
                          {avaria.file.name}
                        </a>
                        <Input
                          placeholder="Descreva a avaria"
                          value={avaria.descricao}
                          onChange={(e) => handleAvariaDescricaoChange(index, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {uploadingChecklist ? "Enviando checklist..." : "As 4 imagens sao obrigatorias para salvar."}
                </p>
                {checklistError && (
                  <p className="text-sm text-destructive">{checklistError}</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleGenerateTermo}
              disabled={!canGenerateTermo}
            >
              Gerar Termo
            </Button>
            <Button type="submit">
              {colaborador ? "Salvar Alterações" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
