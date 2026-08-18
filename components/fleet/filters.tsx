"use client"

import { Search, Filter, X, AlertTriangle, Wrench, Settings, CarFront, CreditCard, Users, Truck, CheckCircle2, ArrowUp } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import type { VehicleFilters } from "@/lib/types"

interface FiltersProps {
  filters: VehicleFilters
  onFiltersChange: (filters: VehicleFilters) => void
}

const defaultFilters: VehicleFilters = {
  search: "",
  searchScope: "todos",
  tipoPropriedade: "todos",
  cartaoCombustivel: "todos",
  atribuicao: "todos",
  statusVeiculo: "todos",
  situacao: "todos",
}

const quickFilterBaseClass = "h-9 rounded-lg border px-3.5 text-[0.85rem] font-medium gap-1.5 shadow-sm transition-colors"

function getQuickFilterClass(active: boolean, palette: string) {
  if (palette === "blue") {
    return active
      ? "bg-blue-600 text-white hover:bg-blue-700 border-blue-600"
      : "border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-700"
  }

  if (palette === "green") {
    return active
      ? "bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600"
      : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-700"
  }

  if (palette === "red") {
    return active
      ? "bg-rose-600 text-white hover:bg-rose-700 border-rose-600"
      : "border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-700"
  }

  if (palette === "orange") {
    return active
      ? "bg-orange-500 text-white hover:bg-orange-600 border-orange-500"
      : "border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-700"
  }

  if (palette === "violet") {
    return active
      ? "bg-violet-500 text-white hover:bg-violet-600 border-violet-500"
      : "border-violet-200 text-violet-700 hover:bg-violet-50 hover:text-violet-700"
  }

  if (palette === "pink") {
    return active
      ? "bg-pink-600 text-white hover:bg-pink-700 border-pink-600"
      : "border-pink-200 text-pink-700 hover:bg-pink-50 hover:text-pink-700"
  }

  return active
    ? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary"
    : "border-border text-foreground hover:bg-muted"
}

export function Filters({ filters, onFiltersChange }: FiltersProps) {
  const activeFiltersCount = [
    filters.searchScope !== "todos",
    filters.tipoPropriedade !== "todos",
    filters.cartaoCombustivel !== "todos",
    filters.atribuicao !== "todos",
    filters.statusVeiculo !== "todos",
    filters.situacao !== "todos",
  ].filter(Boolean).length

  const clearFilters = () => {
    onFiltersChange({ ...defaultFilters, search: filters.search })
  }

  const searchPlaceholder =
    filters.searchScope === "placa_veiculo"
      ? "Buscar pela placa do veículo..."
      : filters.searchScope === "placa_cartao"
      ? "Buscar pela placa registrada no cartão..."
      : filters.searchScope === "colaborador"
      ? "Buscar pelo nome do colaborador..."
      : "Buscar por placa, colaborador, modelo, chassi ou renavam..."

  return (
    <div className="space-y-4">
      {/* Barra de busca e filtro principal */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select
          value={filters.searchScope}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              searchScope: value as VehicleFilters["searchScope"],
            })
          }
        >
          <SelectTrigger className="h-11 w-full text-[0.95rem] sm:w-[220px] bg-transparent">
            <SelectValue placeholder="Buscar em" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Busca inteligente</SelectItem>
            <SelectItem value="placa_veiculo">Placa do veículo</SelectItem>
            <SelectItem value="placa_cartao">Placa do cartão</SelectItem>
            <SelectItem value="colaborador">Colaborador</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="h-11 pl-10 text-[0.95rem]"
          />
        </div>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-11 gap-2 px-4 text-[0.95rem] bg-transparent">
              <Filter className="h-4.5 w-4.5" />
              Filtros
              {activeFiltersCount > 0 && (
                <Badge className="ml-1 h-5 w-5 rounded-full p-0 text-xs">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[22rem] p-4" align="end">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-[0.95rem]">Filtros Avançados</h4>
                {activeFiltersCount > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-auto p-1 text-[0.82rem] text-muted-foreground"
                    onClick={clearFilters}
                  >
                    Limpar filtros
                  </Button>
                )}
              </div>
              
              <Separator />
              
              {/* Propriedade */}
              <div className="space-y-2">
                <label className="text-[0.82rem] font-medium text-muted-foreground flex items-center gap-2">
                  <Search className="h-3 w-3" />
                  Buscar em
                </label>
                <Select
                  value={filters.searchScope}
                  onValueChange={(value) =>
                    onFiltersChange({
                      ...filters,
                      searchScope: value as VehicleFilters["searchScope"],
                    })
                  }
                >
                  <SelectTrigger className="h-10 text-[0.92rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Busca inteligente</SelectItem>
                    <SelectItem value="placa_veiculo">Placa do veículo</SelectItem>
                    <SelectItem value="placa_cartao">Placa do cartão</SelectItem>
                    <SelectItem value="colaborador">Colaborador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-[0.82rem] font-medium text-muted-foreground flex items-center gap-2">
                  <CarFront className="h-3 w-3" />
                  Tipo de Propriedade
                </label>
                <Select
                  value={filters.tipoPropriedade}
                  onValueChange={(value) =>
                    onFiltersChange({
                      ...filters,
                      tipoPropriedade: value as VehicleFilters["tipoPropriedade"],
                    })
                  }
                >
                  <SelectTrigger className="h-10 text-[0.92rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="proprio">Próprio</SelectItem>
                    <SelectItem value="alugado">Alugado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Cartão Combustível */}
              <div className="space-y-2">
                <label className="text-[0.82rem] font-medium text-muted-foreground flex items-center gap-2">
                  <CreditCard className="h-3 w-3" />
                  Cartão Combustível
                </label>
                <Select
                  value={filters.cartaoCombustivel}
                  onValueChange={(value) =>
                    onFiltersChange({
                      ...filters,
                      cartaoCombustivel: value as VehicleFilters["cartaoCombustivel"],
                    })
                  }
                >
                  <SelectTrigger className="h-10 text-[0.92rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="veloe">Veloe</SelectItem>
                    <SelectItem value="ticket">Ticket</SelectItem>
                    <SelectItem value="ambos">Veloe/Ticket</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Atribuição */}
              <div className="space-y-2">
                <label className="text-[0.82rem] font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-3 w-3" />
                  Atribuição
                </label>
                <Select
                  value={filters.atribuicao}
                  onValueChange={(value) =>
                    onFiltersChange({
                      ...filters,
                      atribuicao: value as VehicleFilters["atribuicao"],
                    })
                  }
                >
                  <SelectTrigger className="h-10 text-[0.92rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="atribuido">Com Colaborador</SelectItem>
                    <SelectItem value="disponivel">Sem Colaborador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Status Veículo */}
              <div className="space-y-2">
                <label className="text-[0.82rem] font-medium text-muted-foreground flex items-center gap-2">
                  <Truck className="h-3 w-3" />
                  Status do Veículo
                </label>
                <Select
                  value={filters.statusVeiculo}
                  onValueChange={(value) =>
                    onFiltersChange({
                      ...filters,
                      statusVeiculo: value as VehicleFilters["statusVeiculo"],
                    })
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="frota">Frota</SelectItem>
                    <SelectItem value="disponivel">Disponíveis</SelectItem>
                    <SelectItem value="ocupado">Ocupados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      
      {/* Filtros rápidos de situação */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground mr-1">Situação:</span>
        <Button
          variant={filters.situacao === "todos" ? "default" : "outline"}
          size="sm"
          className={`${quickFilterBaseClass} ${getQuickFilterClass(filters.situacao === "todos", "blue")}`}
          onClick={() => onFiltersChange({ ...filters, situacao: "todos" })}
        >
          Todos
        </Button>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Button
          variant={filters.tipoPropriedade === "proprio" ? "default" : "outline"}
          size="sm"
          className={`${quickFilterBaseClass} ${getQuickFilterClass(filters.tipoPropriedade === "proprio", "green")}`}
          onClick={() =>
            onFiltersChange({
              ...filters,
              tipoPropriedade: filters.tipoPropriedade === "proprio" ? "todos" : "proprio",
            })
          }
        >
          <CarFront className="h-3 w-3" />
          Próprios
        </Button>
        <Button
          variant={filters.tipoPropriedade === "alugado" ? "default" : "outline"}
          size="sm"
          className={`${quickFilterBaseClass} ${getQuickFilterClass(filters.tipoPropriedade === "alugado", "blue")}`}
          onClick={() =>
            onFiltersChange({
              ...filters,
              tipoPropriedade: filters.tipoPropriedade === "alugado" ? "todos" : "alugado",
            })
          }
        >
          <Truck className="h-3 w-3" />
          Alugados
        </Button>
        <Separator orientation="vertical" className="h-5 mx-1" />
        {/* Removido texto 'Disponibilidade:' */}
        <Button
          variant={filters.atribuicao === "disponivel" ? "default" : "outline"}
          size="sm"
          className={`${quickFilterBaseClass} ${getQuickFilterClass(filters.atribuicao === "disponivel", "green")}`}
          onClick={() =>
            onFiltersChange({
              ...filters,
              atribuicao: filters.atribuicao === "disponivel" ? "todos" : "disponivel",
            })
          }
        >
          <CheckCircle2 className="h-3 w-3" />
          Disponiveis
        </Button>
        <Button
          variant={filters.situacao === "contrato_vencendo" ? "default" : "outline"}
          size="sm"
          className={`${quickFilterBaseClass} ${getQuickFilterClass(filters.situacao === "contrato_vencendo", "red")}`}
          onClick={() => onFiltersChange({ ...filters, situacao: "contrato_vencendo" })}
        >
          <AlertTriangle className="h-3 w-3" />
          Contratos Vencendo
        </Button>
        <Button
          variant={filters.situacao === "na_oficina" ? "default" : "outline"}
          size="sm"
          className={`${quickFilterBaseClass} ${getQuickFilterClass(filters.situacao === "na_oficina", "orange")}`}
          onClick={() => onFiltersChange({ ...filters, situacao: "na_oficina" })}
        >
          <Wrench className="h-3 w-3" />
          Na Oficina
        </Button>
        <Button
          variant={filters.situacao === "para_revisao" ? "default" : "outline"}
          size="sm"
          className={`${quickFilterBaseClass} ${getQuickFilterClass(filters.situacao === "para_revisao", "violet")}`}
          onClick={() => onFiltersChange({ ...filters, situacao: "para_revisao" })}
        >
          <Settings className="h-3 w-3" />
          Para Revisão
        </Button>
        <Button
          variant={filters.situacao === "sem_parar" ? "default" : "outline"}
          size="sm"
          className={`${quickFilterBaseClass} ${getQuickFilterClass(filters.situacao === "sem_parar", "pink")}`}
          onClick={() => onFiltersChange({ ...filters, situacao: "sem_parar" })}
        >
          {/* Ícone de seta para cima para o Sem Parar */}
          <ArrowUp className="h-3 w-3" />
          Sem Parar
        </Button>
        
        {/* Filtros ativos */}
        {activeFiltersCount > 0 && (
          <>
            <Separator orientation="vertical" className="h-5 mx-2" />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-lg px-3 text-xs font-medium gap-1.5 text-muted-foreground"
              onClick={clearFilters}
            >
              <X className="h-3 w-3" />
              Limpar filtros
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
