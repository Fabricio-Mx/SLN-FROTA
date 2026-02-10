"use client"

import { Search, Filter, X, AlertTriangle, Wrench, Settings, Car, CreditCard, Users, Truck, AlertCircle } from "lucide-react"
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
  tipoPropriedade: "todos",
  cartaoCombustivel: "todos",
  atribuicao: "todos",
  statusVeiculo: "todos",
  situacao: "todos",
}

export function Filters({ filters, onFiltersChange }: FiltersProps) {
  const activeFiltersCount = [
    filters.tipoPropriedade !== "todos",
    filters.cartaoCombustivel !== "todos",
    filters.atribuicao !== "todos",
    filters.statusVeiculo !== "todos",
    filters.situacao !== "todos",
  ].filter(Boolean).length

  const clearFilters = () => {
    onFiltersChange({ ...defaultFilters, search: filters.search })
  }

  return (
    <div className="space-y-4">
      {/* Barra de busca e filtro principal */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por placa, chassi ou modelo..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="pl-9"
          />
        </div>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 bg-transparent">
              <Filter className="h-4 w-4" />
              Filtros
              {activeFiltersCount > 0 && (
                <Badge className="ml-1 h-5 w-5 rounded-full p-0 text-xs">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4" align="end">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Filtros Avançados</h4>
                {activeFiltersCount > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-auto p-1 text-xs text-muted-foreground"
                    onClick={clearFilters}
                  >
                    Limpar filtros
                  </Button>
                )}
              </div>
              
              <Separator />
              
              {/* Propriedade */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                  <Car className="h-3 w-3" />
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
                  <SelectTrigger className="h-9">
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
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
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
                  <SelectTrigger className="h-9">
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
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
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
                  <SelectTrigger className="h-9">
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
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
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
          className="h-7 text-xs gap-1.5"
          onClick={() => onFiltersChange({ ...filters, situacao: "todos" })}
        >
          Todos
        </Button>
        <Button
          variant={filters.situacao === "contrato_vencendo" ? "default" : "outline"}
          size="sm"
          className={`h-7 text-xs gap-1.5 ${
            filters.situacao !== "contrato_vencendo" 
              ? "border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive" 
              : "bg-destructive hover:bg-destructive/90"
          }`}
          onClick={() => onFiltersChange({ ...filters, situacao: "contrato_vencendo" })}
        >
          <AlertTriangle className="h-3 w-3" />
          Contratos Vencendo
        </Button>
        <Button
          variant={filters.situacao === "na_oficina" ? "default" : "outline"}
          size="sm"
          className={`h-7 text-xs gap-1.5 ${
            filters.situacao !== "na_oficina" 
              ? "border-chart-3/50 text-chart-3 hover:bg-chart-3/10 hover:text-chart-3" 
              : "bg-chart-3 hover:bg-chart-3/90"
          }`}
          onClick={() => onFiltersChange({ ...filters, situacao: "na_oficina" })}
        >
          <Wrench className="h-3 w-3" />
          Na Oficina
        </Button>
        <Button
          variant={filters.situacao === "para_revisao" ? "default" : "outline"}
          size="sm"
          className={`h-7 text-xs gap-1.5 ${
            filters.situacao !== "para_revisao" 
              ? "border-chart-4/50 text-chart-4 hover:bg-chart-4/10 hover:text-chart-4" 
              : "bg-chart-4 hover:bg-chart-4/90"
          }`}
          onClick={() => onFiltersChange({ ...filters, situacao: "para_revisao" })}
        >
          <Settings className="h-3 w-3" />
          Para Revisão
        </Button>
        <Button
          variant={filters.situacao === "sem_parar" ? "default" : "outline"}
          size="sm"
          className={`h-7 text-xs gap-1.5 ${
            filters.situacao !== "sem_parar" 
              ? "border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive" 
              : "bg-destructive hover:bg-destructive/90"
          }`}
          onClick={() => onFiltersChange({ ...filters, situacao: "sem_parar" })}
        >
          <AlertCircle className="h-3 w-3" />
          Sem Parar
        </Button>
        
        {/* Filtros ativos */}
        {activeFiltersCount > 0 && (
          <>
            <Separator orientation="vertical" className="h-5 mx-2" />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1.5 text-muted-foreground"
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
