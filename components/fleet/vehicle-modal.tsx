"use client"

import React from "react"

import { useEffect, useState, type FormEvent } from "react"
import { ExternalLink } from "lucide-react"
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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { getNextReviewKm } from "@/lib/fleet-maintenance"
import type { Vehicle, VehicleFormData } from "@/lib/types"

const FORNECEDORES_PROPRIO = [
  { value: "veiculo_sln", label: "Veículo SLN" },
] as const

interface VehicleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vehicle?: Vehicle | null
  onSave: (data: VehicleFormData) => void
}

const initialFormData: VehicleFormData = {
  placa: "",
  chassi: "",
  renavan: null,
  modelo: "",
  km: 0,
  kmUltimaRevisao: null,
  mensalidade: 0,
  dataVencimentoContrato: "",
  tipoPropriedade: "proprio",
  empresaLocacao: null,
  fornecedorProprio: "veiculo_sln",
  cartaoCombustivel: "veloe",
  numeroCartaoCombustivel: null,
  placaCartaoCombustivel: null,
  frota: true,
  naOficina: false,
  paraRevisao: false,
  semParar: false,
  tipoContratacao: null,
  colaboradorId: null,
  imagens: [],
  checklists: [],
}

export function VehicleModal({
  open,
  onOpenChange,
  vehicle,
  onSave,
}: VehicleModalProps) {
  const [formData, setFormData] = useState<VehicleFormData>(initialFormData)
  const [errors, setErrors] = useState<Partial<Record<keyof VehicleFormData, string>>>({})
  const [uploadingImages, setUploadingImages] = useState(false)

  useEffect(() => {
    if (vehicle) {
      setFormData({
        placa: vehicle.placa || "",
        chassi: vehicle.chassi || "",
        renavan: vehicle.renavan || null,
        modelo: vehicle.modelo || "",
        km: vehicle.km ?? 0,
        kmUltimaRevisao: vehicle.kmUltimaRevisao ?? null,
        mensalidade: vehicle.tipoPropriedade === "proprio" ? 0 : vehicle.mensalidade ?? 0,
        dataVencimentoContrato: vehicle.tipoPropriedade === "proprio" ? "" : vehicle.dataVencimentoContrato || "",
        tipoPropriedade: vehicle.tipoPropriedade || "proprio",
        empresaLocacao:
          vehicle.tipoPropriedade === "alugado"
            ? vehicle.empresaLocacao === "movida"
              ? "4loc"
              : vehicle.empresaLocacao === "veiculo_sln"
                ? null
                : vehicle.empresaLocacao || null
            : vehicle.empresaLocacao || null,
        fornecedorProprio: vehicle.tipoPropriedade === "proprio" ? "veiculo_sln" : vehicle.fornecedorProprio || null,
        cartaoCombustivel: vehicle.cartaoCombustivel || "veloe",
        numeroCartaoCombustivel: vehicle.numeroCartaoCombustivel || null,
        placaCartaoCombustivel: vehicle.placaCartaoCombustivel || null,
        frota: vehicle.frota ?? true,
        naOficina: vehicle.naOficina ?? false,
        paraRevisao: vehicle.paraRevisao ?? false,
        semParar: vehicle.semParar ?? false,
        tipoContratacao: vehicle.tipoContratacao || null,
        colaboradorId: vehicle.colaboradorId || null,
        imagens: vehicle.imagens || [],
        checklists: vehicle.checklists || [],
      })
    } else {
      setFormData(initialFormData)
    }
    setErrors({})
  }, [vehicle, open])

  const imagens = formData.imagens || []
  const checklists = formData.checklists || []
  const proximaRevisaoKm = getNextReviewKm(formData.kmUltimaRevisao)

  const handleUpload = async (files: FileList | null, kind: "imagens" | "checklists") => {
    if (!files || files.length === 0) return
    if (!formData.placa.trim()) {
      toast({
        title: "Aviso",
        description: "Informe a placa antes de enviar arquivos.",
      })
      return
    }

    const setUploading = setUploadingImages
    const currentList = kind === "imagens" ? imagens : checklists

    setUploading(true)
    try {
      const uploaded = [...currentList]

      for (const file of Array.from(files)) {
        const body = new FormData()
        body.append("file", file)
        body.append("entityType", "veiculos")
        body.append("entityId", (formData.placa || "sem-placa").toUpperCase())
        body.append("label", kind)

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

      if (kind === "imagens") {
        setFormData({ ...formData, imagens: uploaded })
      }
      toast({ title: "Sucesso", description: "Arquivos enviados para o Drive." })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao enviar arquivo."
      toast({ title: "Erro", description: message, variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof VehicleFormData, string>> = {}

    // Validação de placa (padrão brasileiro: ABC-1234 ou ABC1D23)
    const placaRegex = /^[A-Z]{3}-?\d{4}$|^[A-Z]{3}\d[A-Z]\d{2}$/i
    if (!formData.placa) {
      newErrors.placa = "Placa é obrigatória"
    } else if (!placaRegex.test(formData.placa.replace("-", ""))) {
      newErrors.placa = "Formato inválido (ex: ABC-1234 ou ABC1D23)"
    }

    // Validação de chassi (17 caracteres alfanuméricos)
    if (!formData.chassi) {
      newErrors.chassi = "Chassi é obrigatório"
    } else if (formData.chassi.length !== 17) {
      newErrors.chassi = "Chassi deve ter 17 caracteres"
    }

    if (formData.renavan && !/^\d{9,11}$/.test(formData.renavan)) {
      newErrors.renavan = "Renavan deve conter entre 9 e 11 dígitos"
    }

    if (!formData.modelo) {
      newErrors.modelo = "Modelo é obrigatório"
    }

    if (
      typeof formData.kmUltimaRevisao === "number" &&
      formData.kmUltimaRevisao > formData.km
    ) {
      newErrors.kmUltimaRevisao = "O KM da última revisão não pode ser maior que o KM atual"
    }

    if (formData.mensalidade < 0) {
      newErrors.mensalidade = "Mensalidade não pode ser negativa"
    }

    if (formData.tipoPropriedade === "alugado" && !formData.dataVencimentoContrato) {
      newErrors.dataVencimentoContrato = "Data de vencimento é obrigatória"
    }

    if (formData.tipoPropriedade === "alugado" && !formData.empresaLocacao) {
      newErrors.empresaLocacao = "Selecione a empresa de locação"
    }

    if (formData.tipoPropriedade === "proprio" && !formData.fornecedorProprio) {
      newErrors.fornecedorProprio = "Selecione o fornecedor do veículo próprio"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      onSave({
        ...formData,
        placa: formData.placa.toUpperCase(),
        chassi: formData.chassi.toUpperCase(),
        mensalidade: formData.tipoPropriedade === "proprio" ? 0 : formData.mensalidade,
        dataVencimentoContrato: formData.tipoPropriedade === "proprio" ? "" : formData.dataVencimentoContrato,
        empresaLocacao:
          formData.tipoPropriedade === "alugado" && formData.empresaLocacao === "veiculo_sln"
            ? null
            : formData.empresaLocacao,
        fornecedorProprio: formData.tipoPropriedade === "proprio" ? "veiculo_sln" : formData.fornecedorProprio,
      })
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {vehicle ? "Editar Veículo" : "Adicionar Veículo"}
          </DialogTitle>
          <DialogDescription>
            {vehicle
              ? "Atualize as informações do veículo."
              : "Preencha os dados do novo veículo."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="tipoPropriedade">Tipo de Propriedade</Label>
              <Select
                value={formData.tipoPropriedade}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    tipoPropriedade: value as "alugado" | "proprio",
                    empresaLocacao: value === "proprio" ? null : formData.empresaLocacao,
                    mensalidade: value === "proprio" ? 0 : formData.mensalidade,
                    dataVencimentoContrato: value === "proprio" ? "" : formData.dataVencimentoContrato,
                    fornecedorProprio:
                      value === "alugado"
                        ? null
                        : formData.fornecedorProprio || "veiculo_sln",
                  })
                }
              >
                <SelectTrigger id="tipoPropriedade">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="proprio">Próprio</SelectItem>
                  <SelectItem value="alugado">Alugado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.tipoPropriedade === "alugado" && (
              <div className="grid gap-2">
                <Label htmlFor="empresaLocacao">Empresa de Locação</Label>
                <Select
                  value={formData.empresaLocacao || ""}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      empresaLocacao: value as "localiza" | "lok_motors" | "4loc",
                    })
                  }
                >
                  <SelectTrigger id="empresaLocacao">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="localiza">Localiza</SelectItem>
                    <SelectItem value="lok_motors">LOK MOTORS</SelectItem>
                    <SelectItem value="4loc">4LOC</SelectItem>
                  </SelectContent>
                </Select>
                {errors.empresaLocacao && (
                  <p className="text-sm text-destructive">{errors.empresaLocacao}</p>
                )}
              </div>
            )}
            {formData.tipoPropriedade === "proprio" && (
              <div className="grid gap-2">
                <Label htmlFor="fornecedorProprio">Fornecedor do Veículo</Label>
                <Select
                  value={formData.fornecedorProprio || ""}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      fornecedorProprio: value,
                    })
                  }
                >
                  <SelectTrigger id="fornecedorProprio">
                    <SelectValue placeholder="Selecione o fornecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {FORNECEDORES_PROPRIO.map((fornecedor) => (
                      <SelectItem key={fornecedor.value} value={fornecedor.value}>
                        {fornecedor.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.fornecedorProprio && (
                  <p className="text-sm text-destructive">{errors.fornecedorProprio}</p>
                )}
              </div>
            )}
            {formData.tipoPropriedade === "alugado" && (
              <div className="grid gap-2">
                <Label htmlFor="mensalidade">Valor da Mensalidade (R$)</Label>
                <Input
                  id="mensalidade"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={formData.mensalidade || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, mensalidade: parseFloat(e.target.value) || 0 })
                  }
                />
                {errors.mensalidade && (
                  <p className="text-sm text-destructive">{errors.mensalidade}</p>
                )}
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="placa">Placa</Label>
              <Input
                id="placa"
                placeholder="ABC-1234 ou ABC1D23"
                value={formData.placa}
                onChange={(e) =>
                  setFormData({ ...formData, placa: e.target.value.toUpperCase() })
                }
                maxLength={8}
              />
              {errors.placa && (
                <p className="text-sm text-destructive">{errors.placa}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="chassi">Chassi</Label>
              <Input
                id="chassi"
                placeholder="17 caracteres"
                value={formData.chassi}
                onChange={(e) =>
                  setFormData({ ...formData, chassi: e.target.value.toUpperCase() })
                }
                maxLength={17}
              />
              {errors.chassi && (
                <p className="text-sm text-destructive">{errors.chassi}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="renavan">Renavan</Label>
              <Input
                id="renavan"
                placeholder="Somente números"
                value={formData.renavan || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    renavan: e.target.value.replace(/\D/g, "").slice(0, 11) || null,
                  })
                }
                inputMode="numeric"
                maxLength={11}
              />
              {errors.renavan && (
                <p className="text-sm text-destructive">{errors.renavan}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="modelo">Modelo do Veículo</Label>
              <Input
                id="modelo"
                placeholder="Ex: Honda Civic 2024"
                value={formData.modelo}
                onChange={(e) =>
                  setFormData({ ...formData, modelo: e.target.value })
                }
              />
              {errors.modelo && (
                <p className="text-sm text-destructive">{errors.modelo}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="km">Quilometragem (KM)</Label>
              <Input
                id="km"
                type="number"
                min="0"
                placeholder="0"
                value={formData.km || ""}
                onChange={(e) =>
                  setFormData({ ...formData, km: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="kmUltimaRevisao">KM da Última Revisão</Label>
              <Input
                id="kmUltimaRevisao"
                type="number"
                min="0"
                placeholder="Ex: 50000"
                value={formData.kmUltimaRevisao ?? ""}
                onChange={(e) => {
                  const value = e.target.value

                  setFormData({
                    ...formData,
                    kmUltimaRevisao: value === "" ? null : parseInt(value, 10) || 0,
                  })
                }}
              />
              {errors.kmUltimaRevisao && (
                <p className="text-sm text-destructive">{errors.kmUltimaRevisao}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {proximaRevisaoKm !== null
                  ? `Próxima revisão prevista em ${proximaRevisaoKm.toLocaleString("pt-BR")} km.`
                  : "Informe o KM da última revisão para calcular automaticamente a próxima em 10.000 km."}
              </p>
            </div>
            {formData.tipoPropriedade === "alugado" && (
              <div className="grid gap-2">
                <Label htmlFor="dataVencimento">Data de Vencimento do Contrato</Label>
                <Input
                  id="dataVencimento"
                  type="date"
                  value={formData.dataVencimentoContrato}
                  onChange={(e) =>
                    setFormData({ ...formData, dataVencimentoContrato: e.target.value })
                  }
                />
                {errors.dataVencimentoContrato && (
                  <p className="text-sm text-destructive">
                    {errors.dataVencimentoContrato}
                  </p>
                )}
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="imagens">Imagens do Veículo</Label>
              <Input
                id="imagens"
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => handleUpload(e.target.files, "imagens")}
                disabled={uploadingImages}
              />
              {imagens.length > 0 && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {imagens.map((img) => (
                    <a
                      key={img.id}
                      href={img.webViewLink || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded bg-muted px-2 py-1 text-muted-foreground hover:text-foreground"
                    >
                      {img.name}
                    </a>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {uploadingImages ? "Enviando imagens..." : "Arquivos vão para o Drive da empresa."}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="checklists">Checklist do Veículo</Label>
              <Button type="button" variant="outline" className="justify-start gap-2 bg-transparent" asChild>
                <a href="https://app.vexsoft.com.br/login.php?returnUrl=/" target="_blank" rel="noreferrer">
                  Acessar checklist na Vexsoft
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
              <p className="text-xs text-muted-foreground">
                O checklist do veículo é realizado diretamente na Vexsoft.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cartaoCombustivel">Cartão Combustível</Label>
              <Select
                value={formData.cartaoCombustivel}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    cartaoCombustivel: value as "veloe" | "ticket" | "ambos",
                  })
                }
              >
                <SelectTrigger id="cartaoCombustivel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="veloe">Veloe</SelectItem>
                  <SelectItem value="ticket">Ticket</SelectItem>
                  <SelectItem value="ambos">Veloe/Ticket</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="numeroCartaoCombustivel">Número do Cartão</Label>
              <Input
                id="numeroCartaoCombustivel"
                placeholder="Ex: 1234567890"
                value={formData.numeroCartaoCombustivel || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    numeroCartaoCombustivel: e.target.value || null,
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="placaCartaoCombustivel">Placa Registrada no Cartão</Label>
              <Input
                id="placaCartaoCombustivel"
                placeholder="ABC1D23"
                value={formData.placaCartaoCombustivel || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    placaCartaoCombustivel: e.target.value.toUpperCase() || null,
                  })
                }
                maxLength={8}
              />
            </div>
            <div className="space-y-3 rounded-lg border border-border p-3">
              <Label className="text-sm font-medium text-muted-foreground">Situação do Veículo</Label>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="frota"
                    checked={formData.frota}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, frota: checked === true })
                    }
                  />
                  <Label htmlFor="frota" className="text-sm font-medium leading-none cursor-pointer">
                    Frota
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="naOficina"
                    checked={formData.naOficina}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, naOficina: checked === true })
                    }
                  />
                  <Label htmlFor="naOficina" className="text-sm font-medium leading-none cursor-pointer">
                    Na Oficina
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="paraRevisao"
                    checked={formData.paraRevisao}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, paraRevisao: checked === true })
                    }
                  />
                  <Label htmlFor="paraRevisao" className="text-sm font-medium leading-none cursor-pointer">
                    Para Revisão (manual)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="semParar"
                    checked={formData.semParar}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, semParar: checked === true })
                    }
                  />
                  <Label htmlFor="semParar" className="text-sm font-medium leading-none cursor-pointer">
                    Sem Parar
                  </Label>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Se desmarcar &quot;Frota&quot;, o veículo continua visível em &quot;Veículos Frota&quot; como disponível, mas sai da contagem da frota e não vai para agregados.
              </p>
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
            <Button type="submit">
              {vehicle ? "Salvar Alterações" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
