import { createProgram } from '@/lib/gl'
import { clamp, cubicBezier, lerp, rnd } from '@/lib/math'

/**
 * Intro cream curtain (mock/intro-curtain-webgl.html, "WebGL ครีม"). Every drip is a capsule merged with a smooth
 * minimum; depth faked from the distance field gives shading, gloss and a soft shadow. Same timings as the original
 * CSS + SVG-filter curtain, which phones redrew on the CPU every frame.
 */
const MAXB = 24
const fragment = () => `precision mediump float;
uniform vec2 res;uniform float dpr;uniform vec4 bars[${MAXB}];uniform int n;
float cap(vec2 p,vec4 b){float h=b.w-b.z;if(h<=0.)return 1e5;float r=min(b.y,h*.5);return length(p-vec2(b.x,clamp(p.y,b.z+r,b.w-r)))-r;}
float smin(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}
float field(vec2 p){float d=1e5;
  for(int i=0;i<${MAXB};i++){if(i>=n)break;vec4 b=bars[i];d=smin(d,cap(p,b),30.);
    if(mod(float(i),2.)<.5&&b.w-b.z>b.y*3.)d=smin(d,length(p-vec2(b.x,b.w-b.y*.95))-b.y*1.12,18.);}
  return d;}
void main(){
  vec2 p=vec2(gl_FragCoord.x,res.y-gl_FragCoord.y)/dpr;
  float d=field(p),a=1.-smoothstep(-.75,.75,d);
  vec2 g=vec2(field(p+vec2(1.5,0.))-d,field(p+vec2(0.,1.5))-d);g/=max(length(g),1e-4);
  float h=clamp(-d/18.,0.,1.);
  vec3 nrm=normalize(vec3(g*(1.-h)*1.8,1.)),L=normalize(vec3(-.35,-.75,.6));
  float diff=max(dot(nrm,L),0.),spec=pow(max(dot(reflect(-L,nrm),vec3(0.,0.,1.)),0.),26.);
  vec3 col=mix(vec3(.91,.84,.72),vec3(1.,.965,.902),smoothstep(.25,.95,diff+.2*h))+spec*.5;
  float sa=.3*(1.-smoothstep(-2.,16.,field(p-vec2(0.,7.))));
  gl_FragColor=vec4(min(col,1.)*a,a+sa*(1.-a));
}`

export const CURTAIN_MS = 4700

const E1 = cubicBezier(0.7, 0, 0.2, 1)
const E2 = cubicBezier(0.6, 0, 0.8, 0.4)
const EIN = cubicBezier(0.42, 0, 1, 1)

/** Starts drawing immediately; returns a per-frame draw(ms) and dispose, or null without WebGL. */
export function createCurtain(canvas: HTMLCanvasElement) {
  const prog = createProgram(canvas, fragment)
  if (!prog) return null
  const { gl, uniform } = prog
  const N = innerWidth < 700 ? 6 : 12
  const dpr = Math.min(devicePixelRatio || 1, 1.5)
  const W = innerWidth, H = innerHeight, CW = W + 80, CH = H + 80
  canvas.width = Math.round(W * dpr)
  canvas.height = Math.round(H * dpr)
  gl.viewport(0, 0, canvas.width, canvas.height)
  gl.uniform2f(uniform('res'), canvas.width, canvas.height)
  gl.uniform1f(uniform('dpr'), dpr)
  gl.uniform1i(uniform('n'), N * 2)
  const uBars = uniform('bars')
  const plan = Array.from({ length: N }, () => ({
    bh: rnd(50, 68), bDur: rnd(800, 1100), bDel: 1550 + rnd(0, 250),
    len: rnd(7, 24), t1Dur: rnd(1000, 1500), t1Del: 900 + rnd(0, 380), t2Del: 3500 + rnd(0, 300),
  }))
  const buf = new Float32Array(MAXB * 4)

  return {
    draw(ms: number) {
      plan.forEach((p, i) => {
        const w = (100 / N) * 1.35, l = (i * 100) / N - w * 0.13
        const cx = -40 + ((l + w / 2) / 100) * CW, hw = (w / 200) * CW
        let th = 125
        if (ms >= p.t2Del) th = lerp(p.len, 0, EIN(clamp((ms - p.t2Del) / 800)))
        else if (ms >= p.t1Del) th = lerp(125, p.len, E1(clamp((ms - p.t1Del) / p.t1Dur)))
        const bh = lerp(p.bh, 0, E2(clamp((ms - p.bDel) / p.bDur)))
        buf.set([cx, hw, -40 - 2 * hw, -40 + (th / 100) * CH], i * 8) // top drip; hidden end stays off-screen
        buf.set([cx, hw, -40 + CH - (bh / 100) * CH, -40 + CH + 2 * hw], i * 8 + 4) // bottom bump
      })
      gl.uniform4fv(uBars, buf)
      prog.draw()
    },
    dispose: prog.dispose,
  }
}
