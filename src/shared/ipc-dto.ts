const SERIALIZATION_ERROR = '设置包含无法序列化的数据，请检查输入后重试。'

/** Copy JSON-compatible data without retaining references, functions, or custom prototypes.
 * This cannot rescue a Proxy rejected by contextBridge before the preload function runs:
 * renderer callers must build their DTO before crossing that boundary.
 */
export function cleanForIpc<T>(value: T): T {
  const seen = new WeakSet<object>()
  function copy(input: unknown, top = false): unknown {
    if (input === null || typeof input === 'string' || typeof input === 'boolean') return input
    if (typeof input === 'number' && Number.isFinite(input)) return input
    if (input === undefined && top) return undefined
    if (!input || typeof input !== 'object' || seen.has(input)) throw new Error(SERIALIZATION_ERROR)
    const prototype = Object.getPrototypeOf(input)
    if (!Array.isArray(input) && prototype !== Object.prototype && prototype !== null) throw new Error(SERIALIZATION_ERROR)
    seen.add(input)
    let result: unknown
    if (Array.isArray(input)) result = Array.from(input, item => copy(item))
    else {
      if (Object.getOwnPropertySymbols(input).length) throw new Error(SERIALIZATION_ERROR)
      const record: Record<string, unknown> = {}
      for (const key of Object.keys(input)) {
        const item = (input as Record<string, unknown>)[key]
        // Preserve optional object-field semantics used by existing settings patches.
        if (item === undefined) continue
        Object.defineProperty(record, key, {value:copy(item),enumerable:true,writable:true,configurable:true})
      }
      result = record
    }
    seen.delete(input)
    return result
  }
  try { return copy(value, true) as T }
  catch { throw new Error(SERIALIZATION_ERROR) } // Never include input values, getters' errors, or credentials.
}
