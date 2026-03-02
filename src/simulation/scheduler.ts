import type { SimUser } from './users.js'
import type { ActionType } from './actions.js'
import { randomUser, randomChoice } from './users.js'

export interface SchedulerOptions {
  durationSeconds: number
  actionsPerSecond: number
  users: 'random' | SimUser[]
  actions: ActionType[]
  onFire: (user: SimUser, action: ActionType) => void
  onComplete?: () => void
}

export class Scheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private timeoutId: ReturnType<typeof setTimeout> | null = null

  get running(): boolean {
    return this.intervalId !== null
  }

  start(opts: SchedulerOptions): void {
    this.stop()

    const intervalMs = 1000 / opts.actionsPerSecond
    const pool = opts.users === 'random' ? null : opts.users

    this.intervalId = setInterval(() => {
      const user = pool ? randomUser(pool) : randomUser()
      const action = randomChoice(opts.actions)
      opts.onFire(user, action)
    }, intervalMs)

    this.timeoutId = setTimeout(() => {
      this.stop()
      opts.onComplete?.()
    }, opts.durationSeconds * 1000)
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }
}
