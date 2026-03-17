"use client"

import { ExternalLink } from "lucide-react"
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
import type { Colaborador, ColaboradorFormData, DriveFile, Vehicle } from "@/lib/types"

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
  email: "",
  departamento: "",
  cep: "",
  endereco: "",
  dataVencimentoCNH: "",
  documentos: [],
  imagensVeiculo: [],
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
  const [uploadingVehicleImages, setUploadingVehicleImages] = useState(false)

  const availableVehicles = vehicles.filter((vehicle) => {
    if (colaborador) {
      return !vehicle.colaboradorId || vehicle.colaboradorId === colaborador.id
    }

    return !vehicle.colaboradorId
  })

  useEffect(() => {
    if (colaborador) {
      setFormData({
        nome: colaborador.nome || "",
        cpf: colaborador.cpf || "",
        telefone: colaborador.telefone || "",
        email: colaborador.email || "",
        departamento: colaborador.departamento || "",
        cep: colaborador.cep || "",
        endereco: colaborador.endereco || "",
        dataVencimentoCNH: colaborador.dataVencimentoCNH || "",
        documentos: colaborador.documentos || [],
        imagensVeiculo: colaborador.imagensVeiculo || [],
      })

      const currentVehicle = vehicles.find((vehicle) => vehicle.colaboradorId === colaborador.id)
      setSelectedVeiculoId(currentVehicle?.id || null)
    } else {
      setFormData(initialFormData)
      setSelectedVeiculoId(null)
    }

    setSelectedVeiculoKm("")
    setErrors({})
  }, [colaborador, open, vehicles])

  const documentos = formData.documentos || []
  const imagensVeiculo = formData.imagensVeiculo || []

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

  const formatCEP = (value: string) => {
    const numbers = value.replace(/\D/g, "")
    return numbers
      .replace(/(\d{5})(\d)/, "$1-$2")
      .replace(/(-\d{3})\d+?$/, "$1")
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

  const isValidEmail = (value: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  }

  const selectedVehicle = selectedVeiculoId
    ? vehicles.find((vehicle) => vehicle.id === selectedVeiculoId) || null
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
        description: "Selecione um veículo para gerar o termo.",
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
        description: "Preencha os dados do colaborador e selecione o veículo.",
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
        description: "Não foi possível abrir o termo.",
        variant: "destructive",
      })
    }
  }

  const uploadDriveFile = async (file: File, label: string): Promise<DriveFile> => {
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
        const data = await uploadDriveFile(file, "documento")
        uploaded.push(data)
      }

      setFormData((current) => ({ ...current, documentos: uploaded }))
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

  const handleUploadVehicleImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    if (!formData.cpf.trim()) {
      toast({
        title: "Aviso",
        description: "Informe o CPF antes de enviar imagens.",
      })
      return
    }

    const current = [...imagensVeiculo]
    const remaining = 2 - current.length

    if (remaining <= 0) {
      toast({
        title: "Aviso",
        description: "Limite de 2 imagens do veículo atingido.",
      })
      return
    }

    setUploadingVehicleImages(true)

    try {
      const uploaded = [...current]

      for (const file of Array.from(files).slice(0, remaining)) {
        const data = await uploadDriveFile(file, `registro_veiculo_${uploaded.length + 1}`)
        uploaded.push(data)
      }

      setFormData((currentFormData) => ({ ...currentFormData, imagensVeiculo: uploaded }))
      toast({ title: "Sucesso", description: "Imagens do veículo enviadas para o Drive." })
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao enviar imagens.",
        variant: "destructive",
      })
    } finally {
      setUploadingVehicleImages(false)
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof ColaboradorFormData, string>> = {}

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

    if (!formData.email.trim()) {
      newErrors.email = "E-mail é obrigatório"
    } else if (!isValidEmail(formData.email.trim())) {
      newErrors.email = "E-mail inválido"
    }

    if (!formData.departamento.trim()) {
      newErrors.departamento = "Departamento é obrigatório"
    }

    const cepNumbers = formData.cep.replace(/\D/g, "")
    if (!cepNumbers) {
      newErrors.cep = "CEP é obrigatório"
    } else if (cepNumbers.length !== 8) {
      newErrors.cep = "CEP deve ter 8 dígitos"
    }

    if (!formData.endereco.trim()) {
      newErrors.endereco = "Endereço é obrigatório"
    }

    if (!formData.dataVencimentoCNH) {
      newErrors.dataVencimentoCNH = "Data de vencimento da CNH é obrigatória"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[520px]">
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
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              />
              {errors.nome ? <p className="text-sm text-destructive">{errors.nome}</p> : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                placeholder="000.000.000-00"
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: formatCPF(e.target.value) })}
                maxLength={14}
              />
              {errors.cpf ? <p className="text-sm text-destructive">{errors.cpf}</p> : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                type="tel"
                placeholder="(00) 00000-0000"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: formatTelefone(e.target.value) })}
                maxLength={15}
              />
              {errors.telefone ? <p className="text-sm text-destructive">{errors.telefone}</p> : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="colaborador@empresa.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              {errors.email ? <p className="text-sm text-destructive">{errors.email}</p> : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="departamento">Departamento</Label>
              <Input
                id="departamento"
                placeholder="Comercial, Operações, etc."
                value={formData.departamento}
                onChange={(e) => setFormData({ ...formData, departamento: e.target.value })}
              />
              {errors.departamento ? <p className="text-sm text-destructive">{errors.departamento}</p> : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cep">CEP</Label>
              <Input
                id="cep"
                inputMode="numeric"
                placeholder="00000-000"
                value={formData.cep}
                onChange={(e) => setFormData({ ...formData, cep: formatCEP(e.target.value) })}
                maxLength={9}
              />
              {errors.cep ? <p className="text-sm text-destructive">{errors.cep}</p> : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="endereco">Endereço</Label>
              <Input
                id="endereco"
                placeholder="Rua, número, bairro, cidade"
                value={formData.endereco}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
              />
              {errors.endereco ? <p className="text-sm text-destructive">{errors.endereco}</p> : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="dataVencimentoCNH">Data de Vencimento da CNH</Label>
              <Input
                id="dataVencimentoCNH"
                type="date"
                value={formData.dataVencimentoCNH}
                onChange={(e) => setFormData({ ...formData, dataVencimentoCNH: e.target.value })}
              />
              {errors.dataVencimentoCNH ? <p className="text-sm text-destructive">{errors.dataVencimentoCNH}</p> : null}
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
              {documentos.length > 0 ? (
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
              ) : null}
              <p className="text-xs text-muted-foreground">
                {uploadingDocs ? "Enviando arquivos..." : "Arquivos vao para o Drive da empresa."}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="veiculo">Veículo (Placa)</Label>
              <Select
                value={selectedVeiculoId || "none"}
                onValueChange={(value) => setSelectedVeiculoId(value === "none" ? null : value)}
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
              <Label htmlFor="checklistVex">Checklist do Veículo</Label>
              <Button type="button" variant="outline" className="justify-start gap-2 bg-transparent" asChild>
                <a id="checklistVex" href="https://app.vexsoft.com.br/login.php?returnUrl=/" target="_blank" rel="noreferrer">
                  Acessar checklist na Vexsoft
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
              <p className="text-xs text-muted-foreground">
                A vistoria do veículo é feita diretamente na Vexsoft.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="imagensVeiculo">Imagens do Veículo (opcional)</Label>
              <Input
                id="imagensVeiculo"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleUploadVehicleImages(e.target.files)}
                disabled={uploadingVehicleImages}
              />
              {imagensVeiculo.length > 0 ? (
                <div className="flex flex-wrap gap-2 text-xs">
                  {imagensVeiculo.map((imagem) => (
                    <a
                      key={imagem.id}
                      href={imagem.webViewLink || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded bg-muted px-2 py-1 text-muted-foreground hover:text-foreground"
                    >
                      {imagem.name}
                    </a>
                  ))}
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {uploadingVehicleImages
                  ? "Enviando imagens..."
                  : `Você pode enviar até 2 imagens do veículo para registro. ${imagensVeiculo.length}/2 anexada(s).`}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="outline" onClick={handleGenerateTermo} disabled={!canGenerateTermo}>
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
