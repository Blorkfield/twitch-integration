export interface SimUser {
  id: string
  login: string
  displayName: string
  color: string
  /** Profile picture URL. Assigned by TwitchSimulator at instantiation time. */
  profileImageUrl?: string
}

function avatar(name: string, color: string): string {
  const bg = color.replace('#', '')
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${bg}&color=fff&size=100&bold=true`
}

export const USER_POOL: SimUser[] = [
  { id: '11002841', login: 'alice_webb',  displayName: 'AliceWebb',  color: '#FF4444', profileImageUrl: avatar('Alice Webb',  '#FF4444') },
  { id: '11007193', login: 'bob_chen',    displayName: 'BobChen',    color: '#44CC44', profileImageUrl: avatar('Bob Chen',    '#44CC44') },
  { id: '11003057', login: 'carol_diaz',  displayName: 'CarolDiaz',  color: '#4488FF', profileImageUrl: avatar('Carol Diaz',  '#4488FF') },
  { id: '11009412', login: 'dave_kim',    displayName: 'DaveKim',    color: '#FF8844', profileImageUrl: avatar('Dave Kim',    '#FF8844') },
  { id: '11006280', login: 'eve_park',    displayName: 'EvePark',    color: '#44DDDD', profileImageUrl: avatar('Eve Park',    '#44DDDD') },
  { id: '11001763', login: 'frank_liu',   displayName: 'FrankLiu',   color: '#DD44FF', profileImageUrl: avatar('Frank Liu',   '#DD44FF') },
  { id: '11005534', login: 'grace_yoon',  displayName: 'GraceYoon',  color: '#FFDD44', profileImageUrl: avatar('Grace Yoon',  '#FFDD44') },
  { id: '11008901', login: 'henry_ross',  displayName: 'HenryRoss',  color: '#44FF88', profileImageUrl: avatar('Henry Ross',  '#44FF88') },
]

export function randomUser(pool: SimUser[] = USER_POOL): SimUser {
  return pool[Math.floor(Math.random() * pool.length)]!
}

export function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}
