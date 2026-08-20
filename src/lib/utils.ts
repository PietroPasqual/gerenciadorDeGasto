import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Gera um id temporário para linhas otimistas (substituído pelo id real do banco). */
export function tempId() {
  return `tmp_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

export function isTempId(id: string) {
  return id.startsWith('tmp_')
}
