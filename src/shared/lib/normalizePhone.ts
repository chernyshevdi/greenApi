/**
 * Оставляет в номере только цифры: `+7 (987) 654-32-10` → `79876543210`.
 * checkAccount принимает номер только в международном формате цифрами.
 */
export function normalizePhone(input: string): string {
  return input.replace(/\D/g, '')
}

/** Международный номер: от 8 до 15 цифр (E.164). */
export function isValidPhone(normalized: string): boolean {
  return /^\d{8,15}$/.test(normalized)
}
