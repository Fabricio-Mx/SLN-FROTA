export function parseFuelDateTime(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(value.getTime())
  }

  const trimmed = value.trim()
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/) 
  if (isoMatch) {
    const [, year, month, day, hour = "0", minute = "0", second = "0"] = isoMatch
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second))
  }

  return new Date(trimmed)
}

export function formatFuelDateTimeStorage(parts: {
  year: number
  month: number
  day: number
  hour?: number
  minute?: number
  second?: number
}): string {
  const year = `${parts.year}`.padStart(4, "0")
  const month = `${parts.month}`.padStart(2, "0")
  const day = `${parts.day}`.padStart(2, "0")
  const hour = `${parts.hour ?? 0}`.padStart(2, "0")
  const minute = `${parts.minute ?? 0}`.padStart(2, "0")
  const second = `${parts.second ?? 0}`.padStart(2, "0")

  return `${year}-${month}-${day}T${hour}:${minute}:${second}`
}