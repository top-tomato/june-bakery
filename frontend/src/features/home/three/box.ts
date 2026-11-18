import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Path,
  PlaneGeometry,
  RepeatWrapping,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  Box3,
  Vector3,
  type Material,
  type Matrix4,
  type Texture,
} from 'three'
import logoUrl from '@/assets/logo.png'

/**
 * The shop's kraft window box (mock/box-open.html): one-piece lock-corner box, four walls the same height, the lid is
 * the back wall folded over, with a small clear window, a front tuck flap and side flaps on its edges that slide just
 * inside the walls. A June logo sticker on the front. Four pieces of the cake drop in one by one and pack tight 2 x 2.
 *
 * Units: the box is W wide; the scene that shows it scales and places the group.
 */
export const BOX_W = 2.08
const H = 0.68
const T = 0.005
const L = BOX_W + T // lid, same width as the box
const BORDER = 0.42 // kraft around the lid window

export interface BoxModel {
  group: Group
  /** put four pieces of this cake mesh in the box (replaces any earlier pieces) */
  fill: (geometry: BufferGeometry, material: Material | Material[], matrix: Matrix4) => void
  /** lid angle in radians from closed (pi/2 = standing up, ~2.95 = lying back on the table) */
  pose: (lid: number) => void
  /** true once the logo sticker is drawn (stills taken before that would miss it) */
  ready: () => boolean
  /** drop the pieces in: ms since the drop started, or null = box still empty */
  drop: (ms: number | null) => void
  dispose: () => void
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}

/** Kraft paper, not wood: muted brown with tiny fibres in every direction and faint soft tone changes. */
function kraft(base: string): Texture {
  const [c, g] = canvas(512, 512)
  g.fillStyle = base
  g.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, a = Math.random() * Math.PI, l = 1 + Math.random() * 4
    g.strokeStyle = `rgba(${Math.random() < 0.55 ? '60,40,20' : '225,195,150'},${0.05 + Math.random() * 0.12})`
    g.lineWidth = 0.6 + Math.random() * 0.6
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l)
    g.stroke()
  }
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, r = 40 + Math.random() * 80
    const rg = g.createRadialGradient(x, y, 0, x, y, r)
    rg.addColorStop(0, `rgba(80,55,30,${Math.random() * 0.035})`)
    rg.addColorStop(1, 'rgba(80,55,30,0)')
    g.fillStyle = rg
    g.fillRect(x - r, y - r, 2 * r, 2 * r)
  }
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** Clear plastic: faint haze plus diagonal glare, so the window reads as film and not as a hole. */
function glare(): Texture {
  const [c, g] = canvas(256, 256)
  g.fillStyle = 'rgba(255,255,255,.22)'
  g.fillRect(0, 0, 256, 256)
  for (const [x, w, a] of [
    [40, 60, 0.55],
    [120, 18, 0.45],
    [175, 40, 0.35],
  ] as const) {
    const gr = g.createLinearGradient(x, 0, x + w, 0)
    gr.addColorStop(0, 'rgba(255,255,255,0)')
    gr.addColorStop(0.5, `rgba(255,255,255,${a})`)
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.save()
    g.translate(128, 128)
    g.rotate(-0.6)
    g.translate(-128, -128)
    g.fillStyle = gr
    g.fillRect(x - 200, -200, w, 700)
    g.restore()
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

/** Soft round shadow under the box (cheaper than shadow maps on phones). */
function blob(): Texture {
  const [c, g] = canvas(128, 128)
  const rg = g.createRadialGradient(64, 64, 10, 64, 64, 64)
  rg.addColorStop(0, 'rgba(30,40,30,.32)')
  rg.addColorStop(1, 'rgba(30,40,30,0)')
  g.fillStyle = rg
  g.fillRect(0, 0, 128, 128)
  return new CanvasTexture(c)
}

/** easeOutBounce: falls, then smaller and smaller hops */
function bounce(t: number) {
  const n = 7.5625, d = 2.75
  if (t < 1 / d) return n * t * t
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375
  return n * (t -= 2.625 / d) * t + 0.984375
}

const roundRect = <P extends Path>(p: P, x: number, y: number, w: number, h: number, r: number) => {
  p.moveTo(x + r, y)
  p.lineTo(x + w - r, y)
  p.quadraticCurveTo(x + w, y, x + w, y + r)
  p.lineTo(x + w, y + h - r)
  p.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  p.lineTo(x + r, y + h)
  p.quadraticCurveTo(x, y + h, x, y + h - r)
  p.lineTo(x, y + r)
  p.quadraticCurveTo(x, y, x + r, y)
  return p
}

export function createBox(): BoxModel {
  const disposables: { dispose: () => void }[] = []
  const keep = <D extends { dispose: () => void }>(d: D) => (disposables.push(d), d)

  const paper = keep(new MeshStandardMaterial({ map: keep(kraft('#7d5426')), roughness: 1, envMapIntensity: 0.6, side: DoubleSide }))
  const inner = keep(new MeshStandardMaterial({ map: keep(kraft('#8a5d2a')), roughness: 1, envMapIntensity: 0.6 }))
  const film = keep(
    new MeshPhysicalMaterial({
      map: keep(glare()),
      transparent: true,
      opacity: 0.9,
      roughness: 0.08,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.4,
      side: DoubleSide,
      depthWrite: false,
    }),
  )

  /** a flat panel; UVs in world units so the paper keeps one scale on every face instead of stretching into streaks */
  const part = (w: number, h: number, d: number, m: Material, x: number, y: number, z: number) => {
    const geo = keep(new BoxGeometry(w, h, d))
    const uv = geo.getAttribute('uv')
    for (const [f, [su, sv]] of ([[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]] as const).entries()) {
      for (let i = f * 4; i < f * 4 + 4; i++) uv.setXY(i, uv.getX(i) * su * 0.8, uv.getY(i) * sv * 0.8)
    }
    const o = new Mesh(geo, m)
    o.position.set(x, y, z)
    return o
  }

  const group = new Group()
  const W = BOX_W
  group.add(part(W, T, W, inner, 0, T / 2, 0))
  for (const [w, d, x, z] of [
    [W, T, 0, W / 2],
    [W, T, 0, -W / 2],
    [T, W, W / 2, 0],
    [T, W, -W / 2, 0],
  ] as const)
    group.add(part(w, H, d, paper, x, H / 2, z))

  const shadow = new Mesh(keep(new PlaneGeometry(W * 2.2, W * 2.2)), keep(new MeshBasicMaterial({ map: keep(blob()), transparent: true, depthWrite: false })))
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = -0.002
  group.add(shadow)

  let logoReady = false
  // logo sticker: cream oval label, logo in the shop's dark green
  {
    const [c, g] = canvas(920, 440)
    const tex = keep(new CanvasTexture(c))
    tex.colorSpace = SRGBColorSpace
    const draw = (img?: HTMLImageElement) => {
      g.clearRect(0, 0, 920, 440)
      g.fillStyle = '#fff6e6'
      g.beginPath()
      g.ellipse(460, 220, 452, 212, 0, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = '#3e5d58'
      g.lineWidth = 6
      g.beginPath()
      g.ellipse(460, 220, 428, 190, 0, 0, Math.PI * 2)
      g.stroke()
      if (img) {
        const [t, tg] = canvas(img.width, img.height)
        tg.drawImage(img, 0, 0)
        tg.globalCompositeOperation = 'source-in'
        tg.fillStyle = '#243b37'
        tg.fillRect(0, 0, t.width, t.height)
        const h = 300, w = (h * img.width) / img.height
        g.drawImage(t, 460 - w / 2, 220 - h / 2, w, h)
      }
      tex.needsUpdate = true
    }
    draw()
    const img = new Image()
    img.onload = () => {
      draw(img)
      logoReady = true
    }
    img.src = logoUrl
    const sticker = new Mesh(
      keep(new PlaneGeometry(0.92, 0.44)),
      keep(new MeshPhysicalMaterial({ map: tex, transparent: true, roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.3 })),
    )
    sticker.position.set(0, H * 0.5, W / 2 + T / 2 + 0.003)
    group.add(sticker)
  }

  // lid: hinged exactly on the back wall's top edge (same sheet folded), the plate reaches forward (+z)
  const hinge = new Group()
  hinge.position.set(0, H, -W / 2)
  group.add(hinge)
  const plate = roundRect(new Shape(), -L / 2, -0.012, L, L + 0.012, 0.006)
  plate.holes.push(roundRect(new Path(), -L / 2 + BORDER, BORDER, L - 2 * BORDER, L - 2 * BORDER, 0.12))
  const pg = keep(new ExtrudeGeometry(plate, { depth: T, bevelEnabled: false }))
  pg.rotateX(Math.PI / 2)
  pg.translate(0, T, 0)
  hinge.add(new Mesh(pg, paper))
  const win = new Mesh(keep(new PlaneGeometry(L - 2 * BORDER + 0.06, L - 2 * BORDER + 0.06)), film)
  win.rotation.x = -Math.PI / 2
  win.position.set(0, 0.002, L / 2)
  hinge.add(win)
  hinge.add(part(L - T * 3.4, 0.2, T, paper, 0, -0.1, L - T * 1.6)) // front tuck flap
  for (const sx of [-1, 1]) {
    const sh = new Shape()
    sh.moveTo(0, 0)
    sh.lineTo(L - 0.01, 0)
    sh.lineTo(L * 0.88, -0.2)
    sh.lineTo(L * 0.06, -0.2)
    sh.closePath()
    const g = keep(new ShapeGeometry(sh))
    g.rotateY(-Math.PI / 2)
    const f = new Mesh(g, paper)
    f.position.set(sx * (L / 2 - T * 1.6), 0, 0)
    hinge.add(f)
  }

  // cake: four pieces, slightly oversize and overlapping so their uneven sides press together like one cut sheet
  const pieces = new Group()
  group.add(pieces)
  const fill: BoxModel['fill'] = (geometry, material, matrix) => {
    pieces.clear()
    geometry.computeBoundingBox()
    const b = new Box3().copy(geometry.boundingBox!).applyMatrix4(matrix)
    const size = b.getSize(new Vector3()), c = b.getCenter(new Vector3())
    const cell = (W - T * 2) / 2, k = (cell / Math.max(size.x, size.z)) * 1.03, q = cell / 2 - 0.022
    const ky = Math.min(k, (H - 0.03) / size.y)
    ;([
      [-q, -q, 0],
      [q, -q, Math.PI / 2],
      [-q, q, Math.PI],
      [q, q, -Math.PI / 2],
    ] as const).forEach(([x, z, ry]) => {
      const m = new Mesh(geometry, material)
      m.applyMatrix4(matrix)
      m.position.x -= c.x
      m.position.y -= b.min.y
      m.position.z -= c.z
      const holder = new Group()
      holder.add(m)
      holder.scale.set(k, ky, k)
      holder.position.set(x, T, z)
      holder.rotation.y = ry
      holder.userData.home = { x, z, ry }
      holder.visible = false
      pieces.add(holder)
    })
  }

  return {
    group,
    fill,
    pose: (lid) => void (hinge.rotation.x = -lid),
    ready: () => logoReady,
    drop: (ms) =>
      pieces.children.forEach((h, k) => {
        const { x, z, ry } = h.userData.home as { x: number; z: number; ry: number }
        const t = ms == null ? 0 : Math.min(1, Math.max(0, (ms - k * 380) / 750))
        h.visible = t > 0
        const up = (1 - bounce(t)) * 3.2 // height above its place in the box
        // tilt and spin only while clear of the walls; inside the box it stays square so no corner pokes through
        const free = Math.min(1, Math.max(0, (up - 0.75) / 1.2))
        h.position.set(x, T + up, z)
        h.rotation.set(free * 0.45, ry + free * 0.8, free * -0.25)
      }),
    dispose: () => disposables.forEach((d) => d.dispose()),
  }
}
