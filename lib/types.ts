export type UserRole = 'mestre' | 'consulta' | 'administrativo' | 'administrativo_rh' | 'logistico'

export interface AppUser {
  id: string
  email: string
  nome: string
  role: UserRole
  avatarUrl?: string | null
  isMaster?: boolean
}

export type EmpresaLocacao = 'localiza' | 'lok_motors' | '4loc' | 'veiculo_sln' | string
export type FornecedorProprio =
  | 'veiculo_sln'
  | 'bradesco_financiamento'
  | 'banco_pan'
  | 'banco_volkswagen'
  | 'sisprime_cdc'
  | string

export interface Vehicle {
  id: string
  placa: string
  chassi: string
  renavan?: string | null
  modelo: string
  km: number
  kmUltimaRevisao?: number | null
  mensalidade: number
  dataVencimentoContrato: string
  tipoPropriedade: 'alugado' | 'proprio'
  empresaLocacao?: EmpresaLocacao | null
  fornecedorProprio?: FornecedorProprio | null
  cartaoCombustivel: 'veloe' | 'ticket' | 'ambos'
  numeroCartaoCombustivel?: string | null
  placaCartaoCombustivel?: string | null
  frota: boolean
  naOficina: boolean
  paraRevisao: boolean
  semParar: boolean
  tipoContratacao?: 'clt' | 'pj' | string | null
  cpfAgregado?: string | null
  dataVencimentoCNHAgregado?: string | null
  agregadoColaboradorNome?: string | null
  agregadoFuncao?: string | null
  agregadoContrato?: string | null
  agregadoCentroCusto?: string | null
  agregadoAnoModelo?: string | null
  agregadoDataInicial?: string | null
  agregadoDias?: number | null
  agregadoObservacao?: string | null
  colaboradorId?: string | null
  imagens?: DriveFile[]
  checklists?: DriveFile[]
  createdAt: string
  updatedAt: string
}

export type VehicleFormData = Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>

export interface Colaborador {
  id: string
  nome: string
  cpf: string
  telefone: string
  email: string
  departamento: string
  tipo: string
  segmento: string
  centroCusto: string
  cep: string
  endereco: string
  dataVencimentoCNH: string
  cnhNumero: string
  cnhCategoria: string
  cnhArquivos?: DriveFile[]
  documentos?: DriveFile[]
  imagensVeiculo?: DriveFile[]
  createdAt: string
  updatedAt: string
}

export interface DriveFile {
  id: string
  name: string
  webViewLink?: string | null
  webContentLink?: string | null
  mimeType?: string | null
  size?: string | null
}

export type ColaboradorFormData = Omit<Colaborador, 'id' | 'createdAt' | 'updatedAt'>

export type MultaGravidade = 'leve' | 'media' | 'grave' | 'gravissima'
export type MultaStatus = 'pendente' | 'enviado'
export type MultaIndicacaoStatus = 'sim' | 'expirado'
export type MultaRhStatus = 'pendente' | 'pago'
export type MultaColaboradorStatus = 'ativo' | 'desligado'

export interface Multa {
  id: string
  vehicleId?: string | null
  colaboradorId?: string | null
  dataHoraInfracao: string
  placa: string
  condutor: string
  tipo: string
  gravidade: MultaGravidade
  pontos: number
  autoInfracao: string
  valor: number
  dataLimiteIndicar: string
  status: MultaStatus
  indicacaoStatus: MultaIndicacaoStatus
  colaboradorStatus?: MultaColaboradorStatus | null
  statusEnviadoEm?: string | null
  rhStatus: MultaRhStatus
  rhPagoEm?: string | null
  valorNic?: number | null
  valorTotalDesconto?: number | null
  locadora: string
  observacoes: string
  createdAt: string
  updatedAt: string
}

export type MultaFormData = Omit<Multa, 'id' | 'createdAt' | 'updatedAt'>

export type FornecedorRegiao = 'norte' | 'nordeste' | 'centro_oeste' | 'sudeste' | 'sul'

export interface Fornecedor {
  id: string
  razaoSocial: string
  cnpj: string
  telefone: string
  email: string
  responsavel: string
  regiao: FornecedorRegiao | null
  uf: string
  chavePix: string
  banco: string
  agencia: string
  conta: string
  observacoes: string
  ativo: boolean
  createdAt: string
  updatedAt: string
}

export type FornecedorFormData = Omit<Fornecedor, 'id' | 'createdAt' | 'updatedAt'>

export type OrdemServicoStatus = 'aguardando' | 'aprovado' | 'rejeitado' | 'concluido'

export interface BoletoParcela {
  id: string
  numero: number
  vencimento: string
  valor: number | null
  pago: boolean
  pagoEm: string | null
  arquivos: DriveFile[]
}

export interface OrdemServico {
  id: string
  fornecedorId: string | null
  vehicleId: string | null
  placa: string
  descricao: string
  valorPecas: number
  valorMaoObra: number
  valorTotal: number
  kmVeiculo: number | null
  dataAbertura: string
  previsaoEntrega: string
  status: OrdemServicoStatus
  aprovadoPor: string | null
  aprovadoEm: string | null
  motivoRejeicao: string | null
  parcelasQuantidade: number | null
  prazosDias: number[]
  boletoVencimento: string
  boletoValor: number | null
  boletoArquivos: DriveFile[]
  boletoParcelas: BoletoParcela[]
  notaFiscalNumero: string
  notaFiscalEmissao: string
  notaFiscalValor: number | null
  notaFiscalArquivos: DriveFile[]
  observacoes: string
  createdAt: string
  updatedAt: string
}

export type OrdemServicoFormData = Omit<OrdemServico, 'id' | 'createdAt' | 'updatedAt'>

export interface VehicleFilters {
  search: string
  searchScope: 'todos' | 'placa_veiculo' | 'placa_cartao' | 'colaborador'
  tipoPropriedade: 'todos' | 'alugado' | 'proprio'
  cartaoCombustivel: 'todos' | 'veloe' | 'ticket' | 'ambos'
  atribuicao: 'todos' | 'atribuido' | 'disponivel'
  statusVeiculo: 'todos' | 'frota' | 'disponivel' | 'ocupado'
  situacao: 'todos' | 'contrato_vencendo' | 'na_oficina' | 'para_revisao' | 'sem_parar'
}
