/** Tiny helpers for the full-screen-triangle fragment shaders (curtain, drips). */

export interface Program {
  gl: WebGLRenderingContext
  uniform: (name: string) => WebGLUniformLocation | null
  draw: () => void
  dispose: () => void
}

const VERT = 'attribute vec2 v;void main(){gl_Position=vec4(v,0.,1.);}'

export function createProgram(canvas: HTMLCanvasElement, fragment: (derivatives: boolean) => string): Program | null {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false })
  if (!gl) return null
  const derivatives = !!gl.getExtension('OES_standard_derivatives')
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)
    if (!s) return null
    gl.shaderSource(s, src)
    gl.compileShader(s)
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null
  }
  const vs = compile(gl.VERTEX_SHADER, VERT)
  const fs = compile(gl.FRAGMENT_SHADER, fragment(derivatives))
  const pr = gl.createProgram()
  if (!vs || !fs || !pr) return null
  gl.attachShader(pr, vs)
  gl.attachShader(pr, fs)
  gl.linkProgram(pr)
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null
  gl.useProgram(pr)
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(pr, 'v')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  return {
    gl,
    uniform: (name) => gl.getUniformLocation(pr, name),
    draw: () => {
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
    dispose: () => {
      gl.deleteBuffer(buf)
      gl.deleteProgram(pr)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
}
