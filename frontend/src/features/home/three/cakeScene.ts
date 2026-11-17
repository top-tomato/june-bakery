import {
  ACESFilmicToneMapping,
  DirectionalLight,
  Group,
  Mesh,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  Texture,
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

/**
 * The cakes on a fixed full-screen canvas, moved every frame to sit on the hero spot, then fly to the story stage.
 *
 * Phone lessons baked in (see CHANGELOG):
 * - the canvas is sized to the tallest viewport and only resized when that grows (no rebuild while toolbars slide)
 * - all scroll maths use the frozen viewport height
 * - the cake shrinks away before the story section un-pins: after that the page scrolls natively and a JS-positioned
 *   object can only trail it, which looked like stutter
 * - once the stage has scrolled away the canvas is hidden instead of being cleared every frame
 */
export interface CakeSceneOptions {
  canvas: HTMLCanvasElement
  models: string[]
  heroSpot: HTMLElement
  stage: HTMLElement
  /** story progress written by the story section each frame: a = entering (0–1), p = through the pinned part (0–1) */
  story: { a: number; p: number }
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

  const items = o.models.map(() => ({ group: new Group(), loaded: false }))
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
        owned.push({ geometry: mesh.geometry, material: mesh.material })
        it.loaded = true
      },
      undefined,
      () => o.onModelError(i),
    )
  })

  let smooth = 0, away = false
  const off = onFrame({
    after: ({ t, y }) => {
      const VH = viewportHeight()
      const S = o.story
      const st = o.stage.getBoundingClientRect()
      const nowAway = st.bottom < -300
      if (nowAway !== away) {
        away = nowAway
        o.canvas.style.visibility = away ? 'hidden' : ''
        if (away) renderer.clear()
      }
      if (away) return
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
