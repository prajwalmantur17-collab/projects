import { describe, expect, it } from 'vitest'
import { toast } from './toast'

describe('toast notification manager', () => {
  it('adds and dismisses notifications', () => {
    let captured: any[] = []
    const unsubscribe = toast.subscribe((items) => {
      captured = items
    })

    toast.success('Machine created successfully')
    expect(captured.length).toBeGreaterThan(0)
    expect(captured[0].message).toBe('Machine created successfully')
    expect(captured[0].type).toBe('success')

    const id = captured[0].id
    toast.dismiss(id)
    expect(captured.find((t) => t.id === id)).toBeUndefined()

    unsubscribe()
  })

  it('prevents rapid duplicate notifications for identical messages', () => {
    let count = 0
    const unsubscribe = toast.subscribe((items) => {
      count = items.filter((i) => i.message === 'Duplicate check').length
    })

    toast.error('Duplicate check')
    toast.error('Duplicate check')
    expect(count).toBe(1)

    unsubscribe()
  })
})
