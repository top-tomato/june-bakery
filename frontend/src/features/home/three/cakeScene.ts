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
 * - the cake shrinks away before the story section un-pins: after that the page scrolls natively and a JS-positioned
 *   object can only trail it, which looked like stutter
 * - once the stage has scrolled away the canvas is hidden instead of being cleared every frame
 *
 * The same canvas then draws the box section (lid opens as you scroll, four pieces inside): a second scene on the
 * same renderer, not a second WebGL context. Same lesson: the box only shows while its section is pinned, growing in
 * after the pin starts and shrinking away before it ends.
 */
export interface CakeSceneOptions {
  canvas: HTMLCanvasElement
  models: string[]
  heroSpot: HTMLElement
  stage: HTMLElement
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

  /** pose the box for this frame; true when it should be drawn */
  const updateBox = () => {
    const p = o.box.p
    const show = calm ? (p > 0 && p < 1 ? 1 : 0) : ease(clamp(p / 0.06)) * (1 - ease(clamp((p - 0.94) / 0.06)))
    if (show < 0.01) return false
    const r = o.boxStage.getBoundingClientRect()
    if (r.bottom < 0 || r.top > ch || !r.width) return false
    const i = Math.round(o.active()), it = items[i]
    if (it?.mesh && boxFilled !== i) {
      box.fill(it.mesh.geometry, it.mesh.material, it.mesh.matrix)
      boxFilled = i
    }
    // the box waits open, the pieces drop in on their own clock (real bounce speed, however fast you scroll), then the
    // lid lies back and the camera looks down. Scrolling back to the top of the section empties it to play again.
    const now = performance.now()
    if (p > 0.08 && dropAt == null) dropAt = calm ? now - 1e4 : now
    if (p < 0.02) dropAt = null
    box.drop(dropAt == null ? null : now - dropAt)
    const look = calm ? clamp((p - 0.62) / 0.25) : ease(clamp((p - 0.62) / 0.25))
    const open = lerp(1.75, 2.95, look)
    box.pose(open)
    box.group.rotation.y = lerp(-0.55, -0.15, p)
    box.group.scale.setScalar(lerp(0.6, 1, show))
    // fill the stage: closed box ~1.6 widths across, more room at the end for the lid lying back; on a narrow phone
    // the box may use the full width (the stage is taller than wide there)
    // while the lid stands up it is the tallest thing: aim higher and pull back a little so it stays in frame
    const lift = Math.sin(clamp(open / Math.PI) * Math.PI) * (1 - look)
    const span = lerp(3.3, 4.4, look) + lift * 0.7, fit = Math.min(r.width * 1.3, r.height)
    const d = (ch * span) / fit / (2 * Math.tan((boxCam.fov * Math.PI) / 360))
    boxCam.aspect = cw / ch
    boxCam.setViewOffset(cw, ch, cw / 2 - (r.left + r.width / 2), ch / 2 - (r.top + r.height / 2), cw, ch)
    const dir = new Vector3(0, lerp(3.2, 9.6, look), lerp(8, 3.2, look)).normalize()
    boxCam.position.copy(dir.multiplyScalar(d))
    boxCam.lookAt(0, lerp(0.35, 0.2, look) + lift * 0.75, lerp(0, -0.7, look) - lift * 0.4)
    boxCam.updateProjectionMatrix()
    return true
  }

  let smooth = 0, away = false
  const off = onFrame({
    after: ({ t, y }) => {
      // re-check the canvas size every frame (cheap, layout is already fresh here): if the scene started before the
      // page CSS applied, the first size was the bare canvas default and the box/cakes were drawn off screen
      size()
      const VH = viewportHeight()
      const S = o.story
      const st = o.stage.getBoundingClientRect()
      const boxOn = updateBox()
      const nowAway = st.bottom < -300 && !boxOn
      if (nowAway !== away) {
        away = nowAway
        o.canvas.style.visibility = away ? 'hidden' : ''
        if (away) renderer.clear()
      }
      if (away) return
      if (boxOn) return renderer.render(boxScene, boxCam)
      const h = o.heroSpot.getBoundingClientRect()
      const outro = calm ? (S.p >= 0.999 ? 1 : 0) : ease(clamp((S.p - 0.9) / 0.09))
      smooth += (o.active() - smooth) * (calm ? 1 : 0.12)
      const cx = lerp(h.left + h.width / 2, st.left + st.width / 2, S.a)
      const cy = lerp(Math.max(h.top + h.height / 2, VH * 0.42), st.top + st.height / 2, S.a)
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
        it.group.visible = it.loaded && hide < 0.99 && d > 0 && outro < 0.995
        it.group.scale.setScalar(px * worldPerPx * (0.55 + 0.45 * near) * (1 - hide) * grow * (1 - outro))
        const free = ((calm ? 0 : t * 0.0004) + o.dragX() + i * 1.3 + (1 - d) * 1.5) % (Math.PI * 2)
        it.group.rotation.set(
          lerp(0.5, 0.75, S.a) - Math.sin(S.p * Math.PI) * 0.35 * near,
          lerp(free, 0.35, k) + ease(clamp((S.p - 0.15) / 0.8)) * Math.PI * 2 * near,
          0,
        )
      })
      renderer.render(scene, cam)
    },
  })

  // three.js skill: memory-dispose-on-unmount / memory-renderer-dispose
  return () => {
    off()
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
