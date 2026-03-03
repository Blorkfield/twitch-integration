export interface SimUser {
  id: string
  login: string
  displayName: string
  color: string
  profileImageUrl?: string
}

function makeUser(n: number, color: string): SimUser {
  const id = String(1000 + n)
  const name = `user${n}`
  return { id, login: name, displayName: name, color }
}

export const USER_POOL: SimUser[] = [
  makeUser(2841, '#FF4444'),
  makeUser(7193, '#44CC44'),
  makeUser(3057, '#4488FF'),
  makeUser(9412, '#FF8844'),
  makeUser(6280, '#44DDDD'),
  makeUser(1763, '#DD44FF'),
  makeUser(5534, '#FFDD44'),
  makeUser(8901, '#44FF88'),
]

export function randomUser(pool: SimUser[] = USER_POOL): SimUser {
  return pool[Math.floor(Math.random() * pool.length)]!
}

export function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}
