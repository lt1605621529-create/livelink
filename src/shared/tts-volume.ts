// Legacy values were signed offsets from unity, not percentages of full scale.
// Map them onto the new curve while keeping the old attenuation approximately intact.
export function normalizeMasterVolume(value: unknown): number {
  if (typeof value === 'string' && /^[+-]\d+%$/.test(value)) {
    const legacyGain = Math.max(0, Math.min(1, 1 + parseFloat(value) / 100))
    return Math.round(Math.sqrt(legacyGain) * 100)
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) return 100
  return Math.round(Math.max(0, Math.min(100, value)))
}

export function masterPlaybackGain(value: unknown): number {
  return (normalizeMasterVolume(value) / 100) ** 2
}
