import {
  ACESFilmicToneMapping,
  DirectionalLight,
  Group,
  Mesh,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  Texture,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { calm, debug, viewportHeight } from '@/lib/env'
import { onFrame } from '@/lib/frame'
import { clamp, ease, lerp } from '@/lib/math'
import { createBox } from './box'

/**
 * The cakes on a fixed full-screen canvas, moved every frame to sit on the hero spot, then fly to the story stage.
 *
 * Phone lessons baked in (see CHANGELOG):
 * - the canvas is sized to the tallest viewport and only resized when that grows (no rebuild while toolbars slide)
 * - all scroll maths use the frozen viewport height
 * - nothing on this fixed canvas follows a section that is scrolling natively (a JS-positioned object can only trail
 *   it, which looked like stutter): while the story or box section moves, a still picture inside the section stands in
 * - once the stage has scrolled away the canvas is hidden instead of being cleared every frame
 *
 * The same canvas then draws the box section (lid opens as you scroll, four pieces inside): a second scene on the
 * same renderer, not a second WebGL context. Same lesson: the live box only shows while its section is pinned; before
 * and after, stills of it sit in the section.
 */
export interface CakeSceneOptions {
  canvas: HTMLCanvasElement
  models: string[]
  heroSpot: HTMLElement
  /** the story section's stage; null on the page order without a story section (the hero sits mid-page then) */
  stage: HTMLElement | null
  /** story progress written by the story section each frame: a = entering (0–1), p = through the pinned part (0–1) */
  story: { a: number; p: number }
  /** the box section's stage, and its progress through the pinned part (0–1), written by that section */
  boxStage: HTMLElement
  box: { p: number }
  /** index of the cake picked in the hero */
  active: () => number
  /** extra rotation from dragging in the hero */
  dragX: () => number
  /** performance.now() time the cakes start dropping in */
  introAt: number
  onModelError: (index: number) => void
}

const outCubic = (t: number) => 1 - Math.pow(1 - t, 3)
const outBack = (t: number) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2)

export function createCakeScene(o: CakeSceneOptions): () => void {
  const renderer = new WebGLRenderer({ canvas: o.canvas, alpha: true, antialias: !debug.lowres })
  renderer.setPixelRatio(debug.lowres ? 1 : Math.min(devicePixelRatio, innerWidth < 700 ? 1.5 : 2))
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.9

  const scene = new Scene()
  const cam = new PerspectiveCamera(30, 1, 0.1, 50)
  cam.position.z = 8
  const pmrem = new PMREMGenerator(renderer)
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04)
  scene.environment = env.texture
  pmrem.dispose()
  const sun = new DirectionalLight(0xfff1dd, 1.2)
  sun.position.set(2, 4, 3)
  scene.add(sun)

  let cw = 0, ch = 0, worldPerPx = 1
  const size = () => {
    const w = o.canvas.clientWidth, h = o.canvas.clientHeight
    if (w === cw && h === ch) return
    cw = w
    ch = h
    renderer.setSize(cw, ch, false)
    cam.aspect = cw / ch
    cam.updateProjectionMatrix()
    worldPerPx = (2 * Math.tan((cam.fov * Math.PI) / 360) * cam.position.z) / ch
  }
  size()
  addEventListener('resize', size)

  const items = o.models.map(() => ({ group: new Group(), loaded: false, mesh: null as Mesh | null }))
  const owned: { geometry: BufferGeometry; material: Material | Material[] }[] = []
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  items.forEach((it, i) => {
    it.group.visible = false
    scene.add(it.group)
    const url = o.models[i]
    if (!url) return
    loader.load(
      url,
      (gltf) => {
        let mesh: Mesh | undefined
        gltf.scene.traverse((obj) => {
          if (obj instanceof Mesh) mesh = obj
        })
        if (!mesh) return o.onModelError(i)
        // compressed models keep their real size/position in the node transform
        gltf.scene.updateMatrixWorld(true)
        const m = new Mesh(mesh.geometry, mesh.material)
        m.applyMatrix4(mesh.matrixWorld)
        it.group.add(m)
        it.mesh = m
        owned.push({ geometry: mesh.geometry, material: mesh.material })
        it.loaded = true
      },
      undefined,
      () => o.onModelError(i),
    )
  })

  const boxScene = new Scene()
  boxScene.environment = env.texture
  const boxSun = new DirectionalLight(0xfff1dc, 1.6)
  boxSun.position.set(3, 6, 4)
  boxScene.add(boxSun)
  const box = createBox()
  boxScene.add(box.group)
  const boxCam = new PerspectiveCamera(32, 1, 0.1, 100)
  let boxFilled = -1
  let dropAt: number | null = null

  type Rect = { left: number; top: number; width: number; height: number }
  /** where an element sits on screen while its section is pinned (the pin's top is then 0) */
  const pinnedRect = (el: HTMLElement): Rect => {
    const r = el.getBoundingClientRect(), pin = el.closest('.pin')?.getBoundingClientRect()
    return { left: r.left, top: r.top - (pin?.top ?? 0), width: r.width, height: r.height }
  }

  /** pose the box and aim its camera at `r` (the stage on screen); returns the view window offset */
  const poseBox = (p: number, r: Rect, dropMs: number | null) => {
    box.drop(dropMs)
    const look = calm ? clamp((p - 0.62) / 0.25) : ease(clamp((p - 0.62) / 0.25))
    const open = lerp(1.75, 2.95, look)
    box.pose(open)
    box.group.rotation.y = lerp(-0.55, -0.15, p)
    // fill the stage: closed box ~1.6 widths across, more room at the end for the lid lying back; on a narrow phone
    // the box may use the full width (the stage is taller than wide there)
    // while the lid stands up it is the tallest thing: aim higher and pull back a little so it stays in frame
    const lift = Math.sin(clamp(open / Math.PI) * Math.PI) * (1 - look)
    const span = lerp(3.3, 4.4, look) + lift * 0.7, fit = Math.min(r.width * 1.3, r.height)
    const d = (ch * span) / fit / (2 * Math.tan((boxCam.fov * Math.PI) / 360))
    const dir = new Vector3(0, lerp(3.2, 9.6, look), lerp(8, 3.2, look)).normalize()
    boxCam.position.copy(dir.multiplyScalar(d))
    boxCam.lookAt(0, lerp(0.35, 0.2, look) + lift * 0.75, lerp(0, -0.7, look) - lift * 0.4)
    boxCam.aspect = cw / ch
    return { ox: cw / 2 - (r.left + r.width / 2), oy: ch / 2 - (r.top + r.height / 2) }
  }

  /**
   * Still pictures of the 3D, placed inside the section so they scroll with the page natively. They stand in while
   * a section moves (before it pins, after it un-pins), so the cake and the box never vanish, and nothing drawn on the
   * fixed canvas has to chase the page (the phone stutter lesson above).
   *
   * Taking one: render just that part of the screen stretched over the whole canvas, copy it into a 2D canvas, then
   * the normal frame is drawn over it in the same task, so it never shows.
   */
  // what the 3D is doing, for the ?fps meter on a real phone
  const dbg = ((window as unknown as { __june3d?: Record<string, string | number> }).__june3d ??= {})
  const snaps: HTMLCanvasElement[] = []
  const makeSnap = (parent: HTMLElement) => {
    const c = document.createElement('canvas')
    c.className = 'snap'
    c.setAttribute('aria-hidden', 'true')
    c.style.visibility = 'hidden'
    parent.append(c)
    snaps.push(c)
    return { el: c, key: '' }
  }
  const storySnap = makeSnap(o.stage ?? o.heroSpot)
  // no story section: the hero is mid-page and scrolls natively, so while the page moves a still of the cake stands in
  const heroSnap = makeSnap(o.heroSpot)
  let lastY = Number.NaN, movedAt = -1e9, spin = 0, lastT = 0, heroStill = false
  const boxStart = makeSnap(o.boxStage)
  const boxEnd = makeSnap(o.boxStage)
  const capture = (snap: { el: HTMLCanvasElement }, stage: Rect, margin: number, sc: Scene, camera: PerspectiveCamera, ox = 0, oy = 0) => {
    const R = { left: stage.left - margin, top: stage.top - margin, width: stage.width + margin * 2, height: stage.height + margin * 2 }
    const pr = renderer.getPixelRatio(), c = snap.el
    c.width = Math.round(R.width * pr)
    c.height = Math.round(R.height * pr)
    Object.assign(c.style, { left: `${-margin}px`, top: `${-margin}px`, width: `${R.width}px`, height: `${R.height}px` })
    camera.setViewOffset(cw, ch, ox + R.left, oy + R.top, R.width, R.height)
    camera.updateProjectionMatrix()
    renderer.render(sc, camera)
    // read the pixels straight from WebGL: copying the canvas with drawImage gave the previous frame on iPhone
    // (LINE), so the box's still showed the story's cake
    const gl = renderer.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight
    const px = new Uint8ClampedArray(W * H * 4)
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px)
    const img = new ImageData(W, H), row = W * 4
    let solid = 0
    for (let y = 0; y < H; y++) {
      const from = (H - 1 - y) * row, to = y * row // WebGL rows run bottom-up
      for (let i = 0; i < row; i += 4) {
        const a = px[from + i + 3] ?? 0, k = a ? 255 / a : 0 // undo premultiplied alpha
        img.data[to + i] = (px[from + i] ?? 0) * k
        img.data[to + i + 1] = (px[from + i + 1] ?? 0) * k
        img.data[to + i + 2] = (px[from + i + 2] ?? 0) * k
        img.data[to + i + 3] = a
        if (a > 128) solid++
      }
    }
    const tmp = document.createElement('canvas')
    tmp.width = W
    tmp.height = H
    tmp.getContext('2d')?.putImageData(img, 0, 0)
    c.getContext('2d')?.drawImage(tmp, 0, 0, W, H, 0, 0, c.width, c.height)
    dbg[c === boxEnd.el ? 'end' : c === boxStart.el ? 'start' : 'story'] = Math.round((solid * 100) / (W * H)) // % covered, for ?fps
    camera.clearViewOffset()
    camera.updateProjectionMatrix()
  }
  const show = (snap: { el: HTMLCanvasElement; key: string }, on: boolean) => {
    const v = on && snap.key ? '' : 'hidden'
    if (snap.el.style.visibility !== v) snap.el.style.visibility = v
  }

  /** the story's cake at the end of its spin (S.p = 1), for when the story section scrolls on */
  const snapStory = (i: number) => {
    const it = items[i]
    if (!it?.loaded) return
    if (!o.stage) return
    const r = pinnedRect(o.stage), key = `${i}|${cw}x${ch}|${Math.round(r.width)}x${Math.round(r.height)}|${Math.round(r.left)},${Math.round(r.top)}`
    if (storySnap.key === key) return
    items.forEach((x) => (x.group.visible = x === it))
    it.group.position.set((r.left + r.width / 2 - cw / 2) * worldPerPx, -(r.top + r.height / 2 - ch / 2) * worldPerPx, 0)
    it.group.scale.setScalar(r.height * 0.86 * worldPerPx)
    it.group.rotation.set(0.75, 0.35 + Math.PI * 2, 0)
    capture(storySnap, r, r.height * 0.15, scene, cam)
    storySnap.key = key
  }

  /** the box before it pins (open and empty) and after (full, lid back, seen from above) */
  const snapBox = () => {
    const i = Math.round(o.active()), it = items[i]
    if (!it?.mesh || !box.ready()) return
    if (boxFilled !== i) {
      box.fill(it.mesh.geometry, it.mesh.material, it.mesh.matrix)
      boxFilled = i
    }
    const r = pinnedRect(o.boxStage), key = `${i}|${cw}x${ch}|${Math.round(r.width)}x${Math.round(r.height)}|${Math.round(r.left)},${Math.round(r.top)}`
    if (boxStart.key === key) return
    dbg.geo = `${cw}x${ch} stage ${Math.round(r.width)}x${Math.round(r.height)}@${Math.round(r.top)} pr ${renderer.getPixelRatio()}`
    for (const [snap, p, ms] of [
      [boxStart, 0, null],
      [boxEnd, 1, 1e4],
    ] as const) {
      const { ox, oy } = poseBox(p, r, ms)
      capture(snap, r, r.height * 0.2, boxScene, boxCam, ox, oy)
      snap.key = key
    }
  }

  /** live box while its section is pinned; true when it should be drawn */
  const updateBox = () => {
    const p = o.box.p
    show(boxStart, p <= 0)
    show(boxEnd, p >= 1)
    if (p <= 0 || p >= 1) return false
    const r = o.boxStage.getBoundingClientRect()
    if (r.bottom < 0 || r.top > ch || !r.width) return false
    // the box waits open, the pieces drop in on their own clock (real bounce speed, however fast you scroll), then the
    // lid lies back and the camera looks down. Scrolling back to the top of the section empties it to play again.
    const now = performance.now()
    if (p > 0.08 && dropAt == null) dropAt = calm ? now - 1e4 : now
    if (p < 0.02) dropAt = null
    const { ox, oy } = poseBox(p, r, dropAt == null ? null : now - dropAt)
    boxCam.setViewOffset(cw, ch, ox, oy, cw, ch)
    boxCam.updateProjectionMatrix()
    return true
  }

  let smooth = 0, away = false, stillsBroken = false
  const off = onFrame({
    after: ({ t, y }) => {
      // re-check the canvas size every frame (cheap, layout is already fresh here): if the scene started before the
      // page CSS applied, the first size was the bare canvas default and the box/cakes were drawn off screen
      size()
      const VH = viewportHeight()
      const S = o.story
      const h = o.heroSpot.getBoundingClientRect()
      const st = o.stage ? o.stage.getBoundingClientRect() : h
      // page moving? (no-story order only: the hero cake then shows as a still until the page settles)
      if (y !== lastY) movedAt = t
      lastY = y
      const moving = !o.stage && t - movedAt < 160
      if (!moving) spin += t - lastT // the cake's idle turn pauses while it's a still
      lastT = t
      const bs = o.boxStage.getBoundingClientRect()
      // stills, taken once the sections are near (and again if the size or the cake changes). If taking one fails on
      // some phone, give up on stills for good rather than failing every frame (that froze the 3D on a real iPhone)
      if (!stillsBroken) {
        try {
          if (o.stage && (S.p > 0.5 || st.bottom < 0)) snapStory(Math.round(o.active()))
          if (bs.top < ch * 2) snapBox()
        } catch (e) {
          stillsBroken = true
          for (const c of snaps) c.style.visibility = 'hidden'
          dbg.err = `still: ${String(e)}`
        }
      }
      const done = !!o.stage && S.p >= 0.999 // story un-pinned: its still takes over
      show(storySnap, done)
      const boxOn = updateBox()
      dbg.p = o.box.p.toFixed(2)
      dbg.box = boxOn ? 'live' : '-'
      dbg.stills = stillsBroken ? 'off' : `${storySnap.key ? 's' : ''}${boxStart.key ? 'b' : ''}`
      dbg.frames = ((dbg.frames as number) || 0) + 1
      const heroOff = h.bottom < -300 || h.top > ch + 300
      const nowAway = (o.stage ? done || st.bottom < -300 : heroOff) && !boxOn
      if (nowAway !== away) {
        away = nowAway
        o.canvas.style.visibility = away ? 'hidden' : ''
      }
      if (away || boxOn) {
        if (heroStill) show(heroSnap, (heroStill = false))
        return away ? renderer.clear() : renderer.render(boxScene, boxCam)
      }
      smooth += (o.active() - smooth) * (calm ? 1 : 0.12)
      const cx = lerp(h.left + h.width / 2, st.left + st.width / 2, S.a)
      // with the hero at the top, the cake holds at 42% of the screen as the page starts to move; mid-page it simply
      // sits on the hero spot
      const cy = lerp(o.stage ? Math.max(h.top + h.height / 2, VH * 0.42) : h.top + h.height / 2, st.top + st.height / 2, S.a)
      const px = lerp(h.height, st.height * 0.86, S.a)
      const gap = (innerWidth < 700 ? innerWidth * 0.6 : Math.min(innerWidth * 0.3, 440)) * (1 + S.a * 5)
      const k = ease(clamp(S.p / 0.18))
      items.forEach((it, i) => {
        const dI = i - smooth
        const near = 1 - Math.min(1, Math.abs(dI))
        // intro: rise a little from below while growing 60% -> 105% -> 100% (mock/intro-drop.html)
        const d = calm ? 1 : clamp((t - o.introAt - i * 200) / 900)
        const drop = -(1 - outCubic(d)) * VH * 0.12
        const grow = lerp(0.6, 1, outBack(d))
        it.group.position.set((cx + dI * gap - cw / 2) * worldPerPx, -(cy - drop - ch / 2) * worldPerPx, 0)
        const hide = (1 - near) * ease(clamp(y / (VH * 0.3)))
        it.group.visible = it.loaded && hide < 0.99 && d > 0
        it.group.scale.setScalar(px * worldPerPx * (0.55 + 0.45 * near) * (1 - hide) * grow)
        const free = ((calm ? 0 : (o.stage ? t : spin) * 0.0004) + o.dragX() + i * 1.3 + (1 - d) * 1.5) % (Math.PI * 2)
        it.group.rotation.set(
          lerp(0.5, 0.75, S.a) - Math.sin(S.p * Math.PI) * 0.35 * near,
          lerp(free, 0.35, k) + ease(clamp((S.p - 0.15) / 0.8)) * Math.PI * 2 * near,
          0,
        )
      })
      if (!o.stage && !stillsBroken) {
        // page started moving: take a still of the cake as it is now and let it scroll with the hero
        if (moving && !heroStill) {
          try {
            capture(heroSnap, { left: h.left, top: h.top, width: h.width, height: h.height }, h.height * 0.25, scene, cam)
            heroSnap.key = 'x'
            heroStill = true
            show(heroSnap, true)
          } catch (e) {
            stillsBroken = true
            dbg.err = `hero still: ${String(e)}`
          }
        } else if (!moving && heroStill) show(heroSnap, (heroStill = false))
        if (heroStill) return renderer.clear()
      }
      renderer.render(scene, cam)
    },
  })

  // three.js skill: memory-dispose-on-unmount / memory-renderer-dispose
  return () => {
    off()
    for (const c of snaps) c.remove()
    box.dispose()
    removeEventListener('resize', size)
    for (const { geometry, material } of owned) {
      geometry.dispose()
      for (const m of Array.isArray(material) ? material : [material]) {
        // textures are not freed by material.dispose() (three.js skill: memory-dispose-material)
        for (const v of Object.values(m)) if (v instanceof Texture) v.dispose()
        m.dispose()
      }
    }
    env.texture.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
  }
}
