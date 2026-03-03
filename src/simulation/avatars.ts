type ShapeFn = (bgColor: string) => string

const SHAPES: ShapeFn[] = [
  smiley,
  triangle,
  diamond,
  star5,
  hexagon,
  ring,
  star4,
  pentagon,
]

export function generateAvatarSvg(color: string, shapeIndex: number): string {
  const fn = SHAPES[shapeIndex % SHAPES.length]!
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<rect width="100" height="100" fill="${color}"/>` +
    fn(color) +
    `</svg>`
  )
}

export function avatarDataUri(color: string, shapeIndex: number): string {
  return `data:image/svg+xml;base64,${btoa(generateAvatarSvg(color, shapeIndex))}`
}

// ── Shapes (white on background color) ────────────────────────────────────────

function smiley(_c: string): string {
  return (
    '<circle cx="50" cy="50" r="36" stroke="white" stroke-width="5" fill="none"/>' +
    '<circle cx="37" cy="42" r="5" fill="white"/>' +
    '<circle cx="63" cy="42" r="5" fill="white"/>' +
    '<path d="M33,60 Q50,74 67,60" stroke="white" stroke-width="5" fill="none" stroke-linecap="round"/>'
  )
}

function triangle(_c: string): string {
  return '<polygon points="50,18 83,75 17,75" fill="white"/>'
}

function diamond(_c: string): string {
  return '<polygon points="50,14 82,50 50,86 18,50" fill="white"/>'
}

function star5(_c: string): string {
  return '<polygon points="50,13 58.8,37.9 85.2,38.6 64.3,54.6 71.8,79.9 50,65 28.2,79.9 35.7,54.6 14.8,38.6 41.2,37.9" fill="white"/>'
}

function hexagon(_c: string): string {
  return '<polygon points="50,13 82,31.5 82,68.5 50,87 18,68.5 18,31.5" fill="white"/>'
}

function ring(c: string): string {
  return (
    `<circle cx="50" cy="50" r="34" fill="white"/>` +
    `<circle cx="50" cy="50" r="17" fill="${c}"/>`
  )
}

function star4(_c: string): string {
  return '<polygon points="50,13 60.6,39.4 87,50 60.6,60.6 50,87 39.4,60.6 13,50 39.4,39.4" fill="white"/>'
}

function pentagon(_c: string): string {
  return '<polygon points="50,13 85.2,38.6 71.8,79.9 28.2,79.9 14.8,38.6" fill="white"/>'
}
