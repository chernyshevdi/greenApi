const AVATAR_COLORS = ['#ff885e', '#ffcd6a', '#82b1ff', '#a0de7e', '#53edd6', '#d669ed', '#e57373']

/** Стабильный цвет аватара по идентификатору (chatId или имени). */
export function avatarColor(seed: string): string {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.codePointAt(0)!) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

/** Инициалы из имени: «Василиса Премудрая» → «ВП», один символ для одного слова. */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '#'
  const letters = words.length === 1 ? [words[0]] : [words[0], words[1]]
  return letters
    .map((word) => String.fromCodePoint(word.codePointAt(0)!))
    .join('')
    .toUpperCase()
}
