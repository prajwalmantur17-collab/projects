export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: string
  type: ToastType
  message: string
  title?: string
  duration?: number
}

type ToastListener = (toasts: ToastItem[]) => void

class ToastManager {
  private toasts: ToastItem[] = []
  private listeners: Set<ToastListener> = new Set()
  private recentMessages: Set<string> = new Set()

  subscribe(listener: ToastListener) {
    this.listeners.add(listener)
    listener(this.toasts)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify() {
    const snapshot = [...this.toasts]
    for (const listener of this.listeners) {
      listener(snapshot)
    }
  }

  show(type: ToastType, message: string, title?: string, duration = 4500) {
    const trimmed = message.trim()
    if (!trimmed) return

    // Prevent duplicate toast spam for the same event
    const dedupeKey = `${type}:${trimmed}`
    if (this.recentMessages.has(dedupeKey)) {
      return
    }
    this.recentMessages.add(dedupeKey)
    setTimeout(() => this.recentMessages.delete(dedupeKey), 2200)

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const toastItem: ToastItem = { id, type, message: trimmed, title, duration }

    // Keep at most 3 notifications at a time to prevent clutter
    this.toasts = [toastItem, ...this.toasts.slice(0, 2)]
    this.notify()

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id)
      }, duration)
    }
  }

  dismiss(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id)
    this.notify()
  }

  success(message: string, title?: string) {
    this.show('success', message, title)
  }

  error(message: string, title?: string) {
    this.show('error', message, title)
  }

  info(message: string, title?: string) {
    this.show('info', message, title)
  }

  warning(message: string, title?: string) {
    this.show('warning', message, title)
  }
}

export const toast = new ToastManager()
