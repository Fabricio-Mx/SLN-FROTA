"use client"

import Image from "next/image"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { AlertCircle, CheckCircle2, CircleDashed, Database, HardDrive, Sparkles, Truck } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const DASHBOARD_BOOT_STORAGE_KEY = "dashboard-entry-boot-complete"

function readBootCompletionFlag() {
  if (typeof window === "undefined") return false

  try {
    return window.sessionStorage.getItem(DASHBOARD_BOOT_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

function writeBootCompletionFlag() {
  if (typeof window === "undefined") return

  try {
    window.sessionStorage.setItem(DASHBOARD_BOOT_STORAGE_KEY, "1")
  } catch {
    // Ignore storage failures so the dashboard can still render.
  }
}

type BootServiceState = {
  label: string
  ok: boolean | null
  message: string
  loadingMessage: string
  successMessage: string
  errorFallbackMessage: string
}

type DashboardEntryGateProps = {
  children: React.ReactNode
}

const INITIAL_SERVICES: BootServiceState[] = [
  {
    label: "Supabase",
    ok: null,
    message: "Aguardando validação.",
    loadingMessage: "Carregando Supabase.",
    successMessage: "Carregamento concluído com sucesso.",
    errorFallbackMessage: "Falha ao validar Supabase.",
  },
  {
    label: "Google Drive",
    ok: null,
    message: "Aguardando validação.",
    loadingMessage: "Carregando Google Drive.",
    successMessage: "Carregamento concluído com sucesso.",
    errorFallbackMessage: "Conta do Drive não carregada.",
  },
  {
    label: "Backup",
    ok: null,
    message: "Aguardando validação.",
    loadingMessage: "Validando rotina de backup.",
    successMessage: "Backup pronto para gravar no Drive.",
    errorFallbackMessage: "Falha ao validar a rotina de backup.",
  },
  {
    label: "Dados do painel",
    ok: null,
    message: "Aguardando validação.",
    loadingMessage: "Carregando dados do painel.",
    successMessage: "Carregamento concluído com sucesso.",
    errorFallbackMessage: "Falha ao validar os dados do painel.",
  },
]

function getServiceIcon(label: string) {
  if (label === "Supabase") return Database
  if (label === "Google Drive") return HardDrive
  if (label === "Backup") return HardDrive
  return Truck
}

function getGaugeTargetProgress(services: BootServiceState[]) {
  const completedCount = services.filter((service) => service.ok === true).length
  const hasActiveService = services.some((service) => service.ok === null && service.message === service.loadingMessage)

  if (hasActiveService) {
    return Math.min(0.96, (completedCount + 0.82) / services.length)
  }

  return completedCount / services.length
}

function getProgressSummary(progress: number, activeService: BootServiceState | undefined, isComplete: boolean, hasError: boolean) {
  if (hasError) {
    return "Carregamento concluído com avisos. Revendo integrações do sistema."
  }

  if (isComplete) {
    return "Tudo pronto. Preparando a abertura do painel."
  }

  if (progress < 0.18) {
    return "Preparando ambiente e iniciando validações."
  }

  if (progress < 0.52) {
    return activeService?.message || "Conectando os serviços principais da operação."
  }

  if (progress < 0.84) {
    return activeService?.message || "Conferindo dados e integrações da frota."
  }

  return "Finalizando verificações e organizando o painel inicial."
}

function getProgressHeadline(progress: number, activeService: BootServiceState | undefined, isComplete: boolean, hasError: boolean) {
  if (hasError) {
    return "Revisando integrações da operação"
  }

  if (isComplete) {
    return "Painel pronto para abrir"
  }

  if (activeService?.label === "Supabase") {
    return "Conectando a base principal"
  }

  if (activeService?.label === "Google Drive") {
    return "Sincronizando arquivos da operação"
  }

  if (activeService?.label === "Backup") {
    return "Validando proteção e rotina de backup"
  }

  if (activeService?.label === "Dados do painel") {
    return "Montando a visão inicial da frota"
  }

  if (progress < 0.22) {
    return "Preparando ambiente da frota"
  }

  if (progress < 0.7) {
    return "Verificando integrações essenciais"
  }

  return "Finalizando carregamento do painel"
}

function getGaugeSegmentProgress(progress: number, startFraction: number, endFraction: number) {
  const normalized = (progress - startFraction) / (endFraction - startFraction)
  return Math.min(1, Math.max(0, normalized))
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180
  const x = centerX + radius * Math.cos(angleInRadians)
  const y = centerY + radius * Math.sin(angleInRadians)

  return {
    x: Number(x.toFixed(3)),
    y: Number(y.toFixed(3)),
  }
}

function describeArc(centerX: number, centerY: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(centerX, centerY, radius, endAngle)
  const end = polarToCartesian(centerX, centerY, radius, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1"

  return ["M", start.x, start.y, "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(" ")
}

function buildArcPath(centerX: number, centerY: number, radius: number, startAngle: number, endAngle: number) {
  const normalizedEnd = endAngle >= startAngle ? endAngle : endAngle + 360
  const segments: string[] = []
  let currentStart = startAngle

  while (normalizedEnd - currentStart > 179.999) {
    segments.push(describeArc(centerX, centerY, radius, currentStart, currentStart + 179.999))
    currentStart += 179.999
  }

  segments.push(describeArc(centerX, centerY, radius, currentStart, normalizedEnd))
  return segments.join(" ")
}

function DashboardBootScreen({
  services,
  progress,
  isComplete,
  hasError,
  onContinue,
  onRetry,
}: {
  services: BootServiceState[]
  progress: number
  isComplete: boolean
  hasError: boolean
  onContinue: () => void
  onRetry: () => void
}) {
  const gaugeStartAngle = 224
  const gaugeSweep = 272
  const gaugeEndAngle = gaugeStartAngle + gaugeSweep
  const needleRotation = gaugeStartAngle + progress * gaugeSweep
  const activeService = services.find((service) => service.ok === null && service.message === service.loadingMessage)
  const activeServiceIndex = services.findIndex((service) => service.ok === null && service.message === service.loadingMessage)
  const progressPercent = Math.min(100, Math.max(0, progress * 100))
  const progressLabel = isComplete || progressPercent >= 99.95 ? "100%" : `${progressPercent.toFixed(1)}%`
  const progressSummary = getProgressSummary(progress, activeService, isComplete, hasError)
  const progressHeadline = getProgressHeadline(progress, activeService, isComplete, hasError)
  const gaugeSegments = [
    {
      key: "cool",
      path: buildArcPath(180, 180, 126, gaugeStartAngle, 286),
      baseColor: "rgba(88,220,255,0.26)",
      activeColor: "#7debff",
      glowColor: "rgba(88,220,255,0.48)",
      progress: getGaugeSegmentProgress(progress, 0, 62 / gaugeSweep),
    },
    {
      key: "warm",
      path: buildArcPath(180, 180, 126, 286, 345),
      baseColor: "rgba(240,215,93,0.24)",
      activeColor: "#ffe580",
      glowColor: "rgba(240,215,93,0.4)",
      progress: getGaugeSegmentProgress(progress, 62 / gaugeSweep, 121 / gaugeSweep),
    },
    {
      key: "hot",
      path: buildArcPath(180, 180, 126, 345, 32),
      baseColor: "rgba(240,147,48,0.22)",
      activeColor: "#ffb76a",
      glowColor: "rgba(240,147,48,0.4)",
      progress: getGaugeSegmentProgress(progress, 121 / gaugeSweep, 168 / gaugeSweep),
    },
    {
      key: "redline",
      path: buildArcPath(180, 180, 126, 32, 136),
      baseColor: "rgba(239,79,57,0.2)",
      activeColor: "#ff7a66",
      glowColor: "rgba(239,79,57,0.4)",
      progress: getGaugeSegmentProgress(progress, 168 / gaugeSweep, 1),
    },
  ]
  const gaugeLabels = [
    { label: "0", angle: 224, radius: 114, size: 31, color: "#b2f3ff" },
    { label: "1", angle: 248, radius: 114, size: 31, color: "#b2f3ff" },
    { label: "2", angle: 272, radius: 114, size: 31, color: "#b2f3ff" },
    { label: "3", angle: 298, radius: 114, size: 31, color: "#b2f3ff" },
    { label: "4", angle: 323, radius: 112, size: 31, color: "#eef8aa" },
    { label: "5", angle: 348, radius: 109, size: 31, color: "#fff0a2" },
    { label: "6", angle: 14, radius: 111, size: 31, color: "#ffe58b" },
    { label: "7", angle: 40, radius: 111, size: 26, color: "#ffc278" },
    { label: "8", angle: 60, radius: 114, size: 28, color: "#ff9672" },
    { label: "9", angle: 87, radius: 116, size: 28, color: "#ff7f69" },
    { label: "10", angle: 118, radius: 120, size: 28, color: "#ff7362" },
  ]

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden overflow-y-auto bg-[radial-gradient(circle_at_top,#f5f8ef_0%,#ffffff_52%,#eef6e7_100%)]">
      <div className="absolute left-0 top-0 h-[34vh] w-[68vw] rounded-br-[3.5rem] bg-[linear-gradient(135deg,#76b521_0%,#65a41b_50%,#8acb35_100%)] shadow-[0_20px_50px_rgba(91,145,32,0.28)]" />
      <div className="absolute left-[20%] top-0 h-[40vh] w-24 rotate-[40deg] bg-white/90 shadow-[0_0_24px_rgba(255,255,255,0.45)]" />
      <div className="absolute right-0 bottom-0 h-[28vh] w-[32vw] rounded-tl-[3rem] bg-[linear-gradient(135deg,#6fb51d_0%,#5ca117_80%,#8ccb36_100%)]" />
      <div className="absolute right-[4%] top-[6%] h-40 w-40 rounded-full border-[20px] border-[#dff0c9]/60" />
      <div className="absolute right-[1%] top-[18%] h-28 w-28 rounded-full border-[14px] border-[#eef8e2]/70" />
      <div className="absolute left-[-6%] bottom-[8%] h-64 w-64 rounded-full border-[26px] border-[#dbeec1]/55" />
      <div className="absolute left-[14%] bottom-[-4%] h-52 w-52 rounded-full border-[20px] border-[#e6f4d6]/60" />

      <div className="relative mx-auto flex min-h-[100dvh] w-full items-start justify-center px-3 py-3 sm:px-4 sm:py-4 lg:items-center lg:px-6 lg:py-5 xl:px-8">
        <div className="relative min-h-[calc(100dvh-0.75rem)] w-full max-w-[92rem] overflow-hidden rounded-[1.75rem] border border-[#d8e7c0] bg-white/92 shadow-[0_28px_70px_rgba(73,103,30,0.16)] backdrop-blur sm:min-h-[calc(100dvh-2rem)] sm:rounded-[2.1rem] lg:max-h-[calc(100dvh-2rem)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(219,239,190,0.36),transparent_34%),radial-gradient(circle_at_62%_44%,rgba(255,241,203,0.18),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.95),rgba(248,251,242,0.92))]" />
          <div className="absolute -left-[12%] top-[7%] h-[20rem] w-[52rem] rotate-[-33deg] rounded-[3.4rem] bg-[linear-gradient(135deg,#7cbc22_0%,#69a91b_65%,#89cd34_100%)] shadow-[0_24px_60px_rgba(91,145,32,0.24)]" />
          <div className="absolute left-[17%] top-[-5%] h-[16rem] w-16 rotate-[40deg] bg-white/92 shadow-[0_0_28px_rgba(255,255,255,0.5)]" />
          <div className="absolute -right-[10%] bottom-[-6%] h-[18rem] w-[30rem] rotate-[-28deg] rounded-[3rem] bg-[linear-gradient(135deg,#73b71d_0%,#5ea117_70%,#8bce37_100%)] shadow-[0_18px_40px_rgba(91,145,32,0.22)]" />
          <div className="absolute right-[24%] bottom-[-10%] h-[14rem] w-16 rotate-[44deg] bg-white/90 shadow-[0_0_26px_rgba(255,255,255,0.45)]" />
          <div className="absolute inset-y-0 left-0 w-[36%] bg-[linear-gradient(180deg,rgba(244,251,236,0.52)_0%,rgba(255,255,255,0.16)_100%)]" />
          <div className="absolute inset-y-0 right-0 w-[36%] bg-[linear-gradient(180deg,rgba(255,255,255,0.28)_0%,rgba(255,255,255,0.12)_100%)]" />
          <div className="absolute right-[7%] top-[22%] h-[2px] w-64 rotate-[28deg] rounded-full bg-[#edc58c] shadow-[0_0_14px_rgba(231,153,40,0.32)]" />
          <div className="absolute right-[11%] top-[32%] h-[2px] w-72 rotate-[-18deg] rounded-full bg-[#efcf9c] shadow-[0_0_14px_rgba(231,153,40,0.24)]" />
          <div className="absolute right-[8%] top-[48%] h-[2px] w-80 rotate-[36deg] rounded-full bg-[#efcf9c] shadow-[0_0_14px_rgba(231,153,40,0.22)]" />
          <div className="absolute right-[12%] bottom-[20%] h-[2px] w-72 rotate-[-32deg] rounded-full bg-[#efcf9c] shadow-[0_0_14px_rgba(231,153,40,0.2)]" />

          <div className="relative h-full px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6 xl:px-10">
            <div className="absolute left-[2rem] top-[1.5rem] hidden w-[10rem] xl:block">
              <div className="rounded-[1.6rem] bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.12)]">
                <div className="flex justify-center">
                  <Image src="/images/sln-logo.png" alt="SLN" width={84} height={84} className="h-20 w-20 object-contain" priority />
                </div>
              </div>
              <div className="mt-5 flex items-center justify-center gap-3 text-[#7aae32]">
                <div className="h-px w-8 bg-[#d7e9bd]" />
                <Truck className="h-5 w-5" />
                <div className="h-px w-8 bg-[#d7e9bd]" />
              </div>
              <div className="mt-3 text-center text-[#1d2437]">
                <p className="text-[1.15rem] font-semibold leading-6">Sistema de</p>
                <p className="text-[1.15rem] font-semibold leading-6">Gestão de Frota</p>
              </div>
            </div>

            <div className="pointer-events-none absolute right-[8%] top-[20%] hidden h-[18rem] w-[19rem] xl:block">
              <div className="absolute left-[52%] top-[8%] h-2.5 w-2.5 rounded-full bg-[#f0aa39] shadow-[0_0_14px_rgba(240,170,57,0.7)]" />
              <div className="absolute left-[10%] top-[72%] h-2.5 w-2.5 rounded-full bg-[#f0aa39] shadow-[0_0_14px_rgba(240,170,57,0.7)]" />
              <div className="absolute left-[36%] top-[92%] h-2.5 w-2.5 rounded-full bg-[#f0aa39] shadow-[0_0_14px_rgba(240,170,57,0.7)]" />
              <div className="absolute right-[14%] bottom-[18%] h-2.5 w-2.5 rounded-full bg-[#f0aa39] shadow-[0_0_14px_rgba(240,170,57,0.7)]" />
              <div className="absolute left-[54%] top-[20%] grid grid-cols-12 gap-[3px] opacity-75">
                {Array.from({ length: 120 }).map((_, index) => {
                  const row = Math.floor(index / 12)
                  const col = index % 12
                  const mask = [
                    "001111110000",
                    "011111111100",
                    "111111111110",
                    "111111111111",
                    "111111111110",
                    "011111111100",
                    "001111111000",
                    "000111110000",
                    "000111100000",
                    "000111000000",
                  ][row] ?? "000000000000"

                  return (
                    <span
                      key={`map-dot-${index}`}
                      className={cn(
                        "h-[5px] w-[5px] rounded-full",
                        mask[col] === "1" ? "bg-[#7ea83e]" : "bg-transparent"
                      )}
                    />
                  )
                })}
              </div>
            </div>

            <div className="relative mx-auto flex h-full w-full max-w-[74rem] flex-col pt-1 pb-2 sm:pt-2 sm:pb-3 lg:pt-3 lg:pb-4">
              <div className="relative z-10 flex w-full flex-col items-center justify-center gap-3 sm:gap-4 lg:flex-1 lg:gap-5">
                <div className="relative flex h-[14rem] w-[14rem] items-center justify-center sm:h-[17rem] sm:w-[17rem] md:h-[19rem] md:w-[19rem] lg:h-[21rem] lg:w-[21rem] xl:h-[24rem] xl:w-[24rem]">
                  <svg viewBox="0 0 360 360" className="h-full w-full overflow-visible drop-shadow-[0_30px_44px_rgba(15,23,42,0.34)]">
                    <defs>
                      <radialGradient id="gaugeFace" cx="50%" cy="40%" r="68%">
                        <stop offset="0%" stopColor="#172637" />
                        <stop offset="48%" stopColor="#09131f" />
                        <stop offset="100%" stopColor="#03070d" />
                      </radialGradient>
                      <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="rgba(255,129,39,0.30)" />
                        <stop offset="58%" stopColor="rgba(255,129,39,0.08)" />
                        <stop offset="100%" stopColor="rgba(255,129,39,0)" />
                      </radialGradient>
                      <linearGradient id="rimOuter" x1="0" x2="1" y1="0" y2="1">
                        <stop offset="0%" stopColor="#f7fbff" />
                        <stop offset="18%" stopColor="#98a2af" />
                        <stop offset="48%" stopColor="#dce2ea" />
                        <stop offset="78%" stopColor="#5f6978" />
                        <stop offset="100%" stopColor="#f7fafc" />
                      </linearGradient>
                      <linearGradient id="rimInner" x1="0" x2="1" y1="0" y2="1">
                        <stop offset="0%" stopColor="#3d4654" />
                        <stop offset="45%" stopColor="#8c97a8" />
                        <stop offset="100%" stopColor="#252d39" />
                      </linearGradient>
                      <linearGradient id="needleGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#ffe2a2" />
                        <stop offset="38%" stopColor="#ff9b33" />
                        <stop offset="100%" stopColor="#df4b1f" />
                      </linearGradient>
                      <linearGradient id="needleCore" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#ffdba4" />
                        <stop offset="100%" stopColor="#ff7a20" />
                      </linearGradient>
                      <filter id="needleGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                        <feMerge>
                          <feMergeNode in="coloredBlur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                      <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="8" />
                      </filter>
                      <filter id="gaugeArcGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="5" result="arcGlowBlur" />
                        <feMerge>
                          <feMergeNode in="arcGlowBlur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>

                    <circle cx="180" cy="180" r="171" fill="url(#rimOuter)" />
                    <circle cx="180" cy="180" r="160" fill="url(#rimInner)" />
                    <circle cx="180" cy="180" r="150" fill="#1e2633" stroke="#6d7787" strokeWidth="3" />
                    <circle cx="180" cy="180" r="144" fill="url(#gaugeFace)" />
                    <circle cx="180" cy="180" r="138" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
                    <circle cx="180" cy="180" r="92" fill="url(#centerGlow)" opacity="0.85" />
                    <ellipse cx="142" cy="118" rx="58" ry="24" fill="rgba(121,192,255,0.18)" filter="url(#softGlow)" />

                    {gaugeSegments.map((segment) => (
                      <g key={segment.key}>
                        <path d={segment.path} fill="none" stroke={segment.baseColor} strokeWidth="15" strokeLinecap="round" />
                        <path
                          d={segment.path}
                          fill="none"
                          stroke={segment.glowColor}
                          strokeWidth="19"
                          strokeLinecap="round"
                          pathLength={1}
                          strokeDasharray={`${segment.progress} 1`}
                          strokeDashoffset={1 - segment.progress}
                          filter="url(#gaugeArcGlow)"
                          opacity={0.95}
                        />
                        <path
                          d={segment.path}
                          fill="none"
                          stroke={segment.activeColor}
                          strokeWidth="15"
                          strokeLinecap="round"
                          pathLength={1}
                          strokeDasharray={`${segment.progress} 1`}
                          strokeDashoffset={1 - segment.progress}
                        />
                      </g>
                    ))}
                    <path d={buildArcPath(180, 180, 132, gaugeStartAngle, gaugeEndAngle)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.4" strokeDasharray="1.5 9" />

                    {Array.from({ length: 76 }).map((_, index) => {
                      const angle = gaugeStartAngle + index * (gaugeSweep / 75)
                      const normalizedAngle = angle % 360
                      const isMajor = index % 7 === 0
                      const isMedium = !isMajor && index % 2 === 0
                      const outer = polarToCartesian(180, 180, 132, angle)
                      const inner = polarToCartesian(180, 180, isMajor ? 92 : isMedium ? 101 : 108, angle)
                      const color = normalizedAngle <= 286 || normalizedAngle >= gaugeStartAngle ? "#96ebff" : normalizedAngle <= 345 ? "#ffe780" : normalizedAngle <= 32 ? "#ffb55b" : "#ff7158"

                      return (
                        <line
                          key={`tick-${angle}`}
                          x1={inner.x}
                          y1={inner.y}
                          x2={outer.x}
                          y2={outer.y}
                          stroke={color}
                          strokeWidth={isMajor ? 3.4 : isMedium ? 2 : 1.3}
                          strokeLinecap="round"
                          opacity={isMajor ? 1 : 0.9}
                        />
                      )
                    })}

                    {gaugeLabels.map(({ label, angle, radius, size, color }) => {
                      const point = polarToCartesian(180, 180, radius, angle)

                      return (
                        <text
                          key={`label-${label}`}
                          x={point.x}
                          y={point.y}
                          fill={color}
                          fontSize={size}
                          fontWeight="700"
                          fontStyle="italic"
                          stroke="rgba(7,14,24,0.8)"
                          strokeWidth="5"
                          paintOrder="stroke fill"
                          textAnchor="middle"
                          dominantBaseline="central"
                        >
                          {label}
                        </text>
                      )
                    })}

                    <text x="180" y="138" fill="rgba(255,255,255,0.72)" fontSize="14" letterSpacing="1.4" textAnchor="middle">
                      RPM x 1000
                    </text>
                    <text x="262" y="204" fill="#ff5a42" fontSize="13" fontWeight="700" textAnchor="middle">
                      REDLINE
                    </text>

                    <g transform={`rotate(${needleRotation} 180 180)`} filter="url(#needleGlow)">
                      <circle cx="180" cy="180" r="12" fill="rgba(255,150,54,0.22)" />
                      <path d="M 180 76 L 187 178 L 180 190 L 173 178 Z" fill="url(#needleGradient)" />
                      <path d="M 180 87 L 184 177 L 180 186 L 176 177 Z" fill="url(#needleCore)" />
                      <path d="M 180 183 L 230 191 L 180 174 Z" fill="#5a2417" opacity="0.9" />
                    </g>

                    <circle cx="180" cy="180" r="23" fill="#1f2631" stroke="#5c6776" strokeWidth="5" />
                    <circle cx="180" cy="180" r="14" fill="#ff8627" stroke="#ffd28a" strokeWidth="2" />
                    <circle cx="180" cy="180" r="7" fill="#ffe1b8" opacity="0.92" />
                  </svg>
                </div>

                <div className="w-full max-w-[34rem] rounded-[1.4rem] border border-[#deead0] bg-white/92 px-4 py-3 text-center shadow-[0_16px_34px_rgba(88,119,44,0.10)] backdrop-blur sm:rounded-[1.7rem] sm:px-5 sm:py-4 lg:rounded-[2rem] lg:px-6">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#6a8f30] sm:text-xs lg:text-sm lg:tracking-[0.32em]">Sistema de gestao de frota</p>
                  <p className="mt-2 text-[1.15rem] font-semibold uppercase tracking-tight text-[#1b2234] sm:text-[1.35rem] md:text-[1.55rem] xl:text-[1.8rem]">{progressHeadline}</p>
                  <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-[#d7e6bf] bg-[#f8fbf2] px-3 py-2 text-xs text-slate-600 sm:gap-3 sm:px-4 sm:text-sm lg:px-5">
                    <CircleDashed className="h-4.5 w-4.5 animate-spin text-[#7cb342]" />
                    <span className="truncate">{progressSummary}</span>
                  </div>
                  <p className="mt-3 text-[1.7rem] font-bold tabular-nums text-[#1b2234] sm:text-[2rem] xl:text-[2.3rem]">{progressLabel}</p>
                </div>
              </div>

              <div className="mt-2 w-full rounded-[1.5rem] border border-[#e0ebd1] bg-white/84 p-3 shadow-[0_12px_30px_rgba(88,119,44,0.08)] backdrop-blur sm:p-4 lg:mt-3 lg:max-w-[68rem] lg:self-center lg:rounded-[2rem]">
                <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                  {services.map((service, index) => {
                    const Icon = getServiceIcon(service.label)
                    const isActive = index === activeServiceIndex
                    const stateIcon = service.ok == null ? (
                      <Sparkles className="h-4 w-4 text-[#7aa63d]" />
                    ) : service.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-[#5f8828]" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-[#c05621]" />
                    )

                    return (
                      <div
                        key={service.label}
                        className={cn(
                          "rounded-[1.1rem] border px-3 py-3 transition-all duration-300 sm:px-4",
                          isActive
                            ? "border-[#9fcb57] bg-[linear-gradient(180deg,#ffffff_0%,#f4faea_100%)] shadow-[0_14px_28px_rgba(124,179,66,0.18)] ring-1 ring-[#d8ebb6]"
                            : service.ok == null
                              ? "border-[#dce8ce] bg-white"
                              : service.ok
                                ? "border-[#d7e8bf] bg-[#f6fbef]"
                                : "border-[#f1c8ba] bg-[#fff4ee]"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "mt-0.5 flex h-9 w-9 items-center justify-center rounded-full sm:h-10 sm:w-10",
                              isActive
                                ? "bg-[#edf8da] text-[#6da12f] shadow-[0_0_0_6px_rgba(210,233,170,0.45)]"
                                : "bg-[#eef5e3] text-[#679b29]"
                            )}
                          >
                            <Icon className={cn("h-4.5 w-4.5 sm:h-5 sm:w-5", isActive ? "animate-pulse" : "")} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-[0.82rem] font-semibold text-slate-800 sm:text-sm">
                              <span>{index + 1}. {service.label}</span>
                              {stateIcon}
                              {isActive ? <span className="rounded-full bg-[#ebf6d8] px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[#6b982f]">Em andamento</span> : null}
                            </div>
                            <p className={cn("mt-1 text-xs sm:text-sm", isActive ? "text-[#567127]" : "text-slate-500")}>{service.message}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div
                  className={cn(
                    "mt-3 rounded-[1.15rem] border px-3 py-3 text-xs font-medium sm:mt-4 sm:rounded-2xl sm:px-4 sm:text-sm",
                    hasError
                      ? "border-[#f0c4b4] bg-[#fff4ef] text-[#9a3412]"
                      : isComplete
                        ? "border-[#d5e7bf] bg-[#f5faee] text-[#4d6f22]"
                        : "border-[#e7eedc] bg-[#fafcf7] text-slate-600"
                  )}
                >
                  {hasError
                    ? "Carregamento concluido com avisos. Revise os servicos abaixo antes de seguir."
                    : isComplete
                      ? "Carregamento concluido sem erros."
                      : "Carregando informacoes iniciais do sistema..."}
                </div>

                {hasError ? (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button type="button" onClick={onRetry} className="rounded-xl bg-[#7CB342] text-white hover:bg-[#6d9d39]">
                      Tentar novamente
                    </Button>
                    <Button type="button" variant="outline" onClick={onContinue} className="rounded-xl border-[#d7dfeb] bg-white text-slate-700">
                      Continuar mesmo assim
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function DashboardEntryGate({ children }: DashboardEntryGateProps) {
  const startedRef = useRef(false)
  const animationFrameRef = useRef<number | null>(null)
  const bootScreenExitTimeoutRef = useRef<number | null>(null)
  const animatedProgressRef = useRef(0)
  const hasCompletedInSession = useSyncExternalStore(
    () => () => {},
    readBootCompletionFlag,
    () => false
  )
  const [hasCompletedBoot, setHasCompletedBoot] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [retryToken, setRetryToken] = useState(0)
  const [services, setServices] = useState<BootServiceState[]>(INITIAL_SERVICES)
  const [animatedProgress, setAnimatedProgress] = useState(0)
  const isReady = hasCompletedInSession || hasCompletedBoot
  const [showBootScreen, setShowBootScreen] = useState(() => !isReady)
  const targetProgress = isReady || hasError ? 1 : getGaugeTargetProgress(services)

  useEffect(() => {
    animatedProgressRef.current = animatedProgress
  }, [animatedProgress])

  useEffect(() => {
    if (typeof window === "undefined") return

    if (bootScreenExitTimeoutRef.current !== null) {
      window.clearTimeout(bootScreenExitTimeoutRef.current)
      bootScreenExitTimeoutRef.current = null
    }

    if (isReady) {
      bootScreenExitTimeoutRef.current = window.setTimeout(() => {
        setShowBootScreen(false)
        bootScreenExitTimeoutRef.current = null
      }, 460)
      return
    }

    return () => {
      if (bootScreenExitTimeoutRef.current !== null) {
        window.clearTimeout(bootScreenExitTimeoutRef.current)
        bootScreenExitTimeoutRef.current = null
      }
    }
  }, [isReady])

  useEffect(() => {
    if (typeof window === "undefined") return

    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    const initialProgress = animatedProgressRef.current
    const progressDelta = targetProgress - initialProgress

    if (Math.abs(progressDelta) < 0.001) {
      animatedProgressRef.current = targetProgress
      return
    }

    const finishWeight = Math.min(1, Math.max(0, (Math.max(initialProgress, targetProgress) - 0.72) / 0.28))
    const duration = Math.max(480, Math.min(2200, 560 + Math.abs(progressDelta) * 2600 + finishWeight * 520))
    const startTime = window.performance.now()

    const tick = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const normalizedTime = Math.min(elapsed / duration, 1)
      const smoothTime = normalizedTime * normalizedTime * (3 - 2 * normalizedTime)
      const endEaseTime = 1 - Math.pow(1 - normalizedTime, 4)
      const easedTime = smoothTime * (1 - finishWeight) + endEaseTime * finishWeight
      const nextProgress = initialProgress + progressDelta * easedTime

      animatedProgressRef.current = nextProgress
      setAnimatedProgress(nextProgress)

      if (normalizedTime < 1) {
        animationFrameRef.current = window.requestAnimationFrame(tick)
      } else {
        animationFrameRef.current = null
      }
    }

    animationFrameRef.current = window.requestAnimationFrame(tick)

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [targetProgress])

  useEffect(() => {
    if (isReady || startedRef.current) return
    startedRef.current = true

    let cancelled = false

    const run = async () => {
      const nextServices = INITIAL_SERVICES.map((service) => ({ ...service }))
      const endpoints = [
        "/api/health/supabase",
        "/api/health/drive",
        "/api/health/backup",
        "/api/health/dashboard-data",
      ]

      for (const [index, endpoint] of endpoints.entries()) {
        nextServices[index] = {
          ...nextServices[index],
          ok: null,
          message: nextServices[index].loadingMessage,
        }

        if (!cancelled) {
          setServices(nextServices.map((service) => ({ ...service })))
        }

        try {
          const response = await fetch(endpoint, { cache: "no-store" })
          const payload = await response.json().catch(() => ({}))

          nextServices[index] = {
            ...nextServices[index],
            ok: response.ok && payload?.ok !== false,
            message:
              response.ok && payload?.ok !== false
                ? nextServices[index].successMessage
                : payload?.hint || payload?.error || nextServices[index].errorFallbackMessage,
          }
        } catch (err) {
          nextServices[index] = {
            ...nextServices[index],
            ok: false,
            message: err instanceof Error ? err.message : nextServices[index].errorFallbackMessage,
          }
        }

        if (!cancelled) {
          setServices(nextServices.map((service) => ({ ...service })))
        }

        await new Promise((resolve) => setTimeout(resolve, 250))
        if (cancelled) {
          startedRef.current = false
          return
        }
      }

      const hasAnyError = nextServices.some((service) => service.ok === false)

      if (cancelled) return

      setServices(nextServices)
      setHasError(hasAnyError)

      if (hasAnyError) {
        if (process.env.NODE_ENV === "production") {
          await new Promise((resolve) => setTimeout(resolve, 760))
          if (cancelled) {
            startedRef.current = false
            return
          }
          writeBootCompletionFlag()
          setHasCompletedBoot(true)
        }

        startedRef.current = false
        return
      }

      await new Promise((resolve) => setTimeout(resolve, 320))
      if (cancelled) {
        startedRef.current = false
        return
      }

      writeBootCompletionFlag()
      setHasCompletedBoot(true)
      startedRef.current = false
    }

    void run()

    return () => {
      cancelled = true
      startedRef.current = false
    }
  }, [isReady, retryToken])

  return (
    <>
      <div
        className={cn(
          "transition-[opacity,transform,filter] duration-700 ease-out will-change-transform",
          isReady ? "opacity-100 translate-y-0 scale-100 blur-0" : "pointer-events-none opacity-0 translate-y-3 scale-[0.985] blur-[2px]"
        )}
      >
        {children}
      </div>

      {showBootScreen ? (
        <div
          className={cn(
            "fixed inset-0 z-50 transition-all duration-500 ease-out",
            isReady ? "translate-y-2 opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
          )}
        >
          <DashboardBootScreen
            services={services}
            progress={animatedProgress}
            isComplete={!hasError && services.every((service) => service.ok === true)}
            hasError={hasError}
            onContinue={() => {
              writeBootCompletionFlag()
              setHasCompletedBoot(true)
            }}
            onRetry={() => {
              startedRef.current = false
              setHasError(false)
              setServices(INITIAL_SERVICES)
              animatedProgressRef.current = 0
              setAnimatedProgress(0)
              setShowBootScreen(true)
              setRetryToken((currentValue) => currentValue + 1)
            }}
          />
        </div>
      ) : null}
    </>
  )
}