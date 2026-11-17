import { createProgram } from '@/lib/gl'
import { rnd } from '@/lib/math'

/**
 * Cream drips between sections (mock/section-drips.html). Band + drips + beads merged with a smooth minimum in one
 * fragment shader, drawn straight into the strip's own canvas. They used to be divs behind an SVG blur filter, which
 * phones re-filtered on the CPU every scroll frame.
 */
export interface Drip {
  /** left edge in % of the strip */
  left: number
  /** width in px */
  w: number
  /** full length in px */
  len: number
}

export function makeDrips(count: number): Drip[] {
  const n = Math.max(7, Math.round(count * Math.min(1, innerWidth / 1300)))
  return Array.from({ length: n }, (_, i) => ({
    left: ((i + rnd(0.15, 0.85)) / n) * 100,
    w: rnd(20, 50) | 0,
    len: (Math.random() < 0.3 ? rnd(150, 235) : rnd(40, 130)) | 0,
  }))
}

const MAXD = 32
const fragment = (deriv: boolean) => `${deriv ? '#extension GL_OES_standard_derivatives : enable\n' : ''}#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 res;uniform float dpr;uniform vec3 col;uniform vec4 d[${MAXD}];uniform int n;uniform float g;
float smin(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}
void main(){
  vec2 p=vec2(gl_FragCoord.x,res.y-gl_FragCoord.y)/dpr;
  float f=p.y-60.;
  for(int i=0;i<${MAXD};i++){if(i>=n)break;vec4 q=d[i];
    if(abs(p.x-q.x)>q.y*.64+26.)continue;   // too far sideways to touch this pixel
    float r=q.y*.5,bot=30.+q.z*g;
    float body=length(p-vec2(q.x,clamp(p.y,-100.,bot-r)))-r;
    float bead=length(p-vec2(q.x,bot+5.-q.y*.64))-q.y*.64;
    f=smin(f,smin(body,bead,10.),24.);
  }
  float aa=${deriv ? 'max(fwidth(f)*.6,.02)' : '.75'};
  float a=1.-smoothstep(-aa,aa,f);
  gl_FragColor=vec4(col*a,a);
}`

export interface DripRenderer {
  /** g: 0.2–1 stretch; W,H: strip size in CSS px; rgb: 0–1 colour. Skips drawing when nothing visible changed. */
  draw: (g: number, W: number, H: number, rgb: readonly number[]) => void
  dispose: () => void
}

export function createDripRenderer(canvas: HTMLCanvasElement, drips: Drip[]): DripRenderer | null {
  const prog = createProgram(canvas, fragment)
  if (!prog) return null
  const { gl, uniform } = prog
  const uRes = uniform('res'), uDpr = uniform('dpr'), uCol = uniform('col'), uD = uniform('d'), uG = uniform('g')
  gl.uniform1i(uniform('n'), Math.min(MAXD, drips.length))
  const buf = new Float32Array(MAXD * 4)
  let lastW = 0, lastH = 0, lastG = -1, lastRGB = ''
  return {
    draw(g, W, H, rgb) {
      const key = rgb.join()
      if (W === lastW && H === lastH && key === lastRGB && Math.abs(g - lastG) < 0.002) return
      if (W !== lastW || H !== lastH) {
        const dpr = Math.min(devicePixelRatio || 1, 1.25)
        canvas.width = Math.round(W * dpr)
        canvas.height = Math.round(H * dpr)
        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.uniform2f(uRes, canvas.width, canvas.height)
        gl.uniform1f(uDpr, dpr)
        buf.fill(0)
        drips.slice(0, MAXD).forEach((q, i) => buf.set([(q.left / 100) * W + q.w / 2, q.w, q.len, 0], i * 4))
        gl.uniform4fv(uD, buf)
        lastW = W
        lastH = H
      }
      if (key !== lastRGB) {
        gl.uniform3f(uCol, rgb[0] ?? 0, rgb[1] ?? 0, rgb[2] ?? 0)
        lastRGB = key
      }
      gl.uniform1f(uG, g)
      lastG = g
      prog.draw()
    },
    dispose: prog.dispose,
  }
}

/** "rgb(62, 93, 88)" → [0.24, 0.36, 0.35] */
export function cssColorToRgb(color: string): number[] {
  return (color.match(/[\d.]+/g) ?? ['0', '0', '0']).slice(0, 3).map((v) => Number(v) / 255)
}
