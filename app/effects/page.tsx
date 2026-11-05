'use client';
import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/layout/LayoutShell';

/* Real WebGL shader effects — only these are implemented. */
const VERT = `attribute vec2 p; varying vec2 uv; void main(){ uv = (p+1.0)/2.0; gl_Position = vec4(p, 0., 1.); }`;

const FRAGS: Record<string, { name: string; src: string; params: { key: string; label: string; min: number; max: number; step: number; def: number }[] }> = {
  brightness_contrast: {
    name: 'Brightness / Contrast',
    params: [
      { key: 'u_bright', label: 'Brightness', min: -1, max: 1, step: 0.01, def: 0 },
      { key: 'u_contrast', label: 'Contrast', min: -1, max: 1, step: 0.01, def: 0 },
    ],
    src: `precision mediump float; varying vec2 uv; uniform sampler2D tex; uniform float u_bright; uniform float u_contrast;
void main(){ vec4 c = texture2D(tex, uv); c.rgb += u_bright; c.rgb = (c.rgb - 0.5) * (u_contrast + 1.0) + 0.5; gl_FragColor = c; }`,
  },
  hue_saturation: {
    name: 'Hue / Saturation',
    params: [
      { key: 'u_hue', label: 'Hue shift', min: -3.14, max: 3.14, step: 0.01, def: 0 },
      { key: 'u_sat', label: 'Saturation', min: 0, max: 2, step: 0.01, def: 1 },
    ],
    src: `precision mediump float; varying vec2 uv; uniform sampler2D tex; uniform float u_hue; uniform float u_sat;
vec3 rgb2hsv(vec3 c){ vec4 K=vec4(0.,-1./3.,2./3.,-1.); vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g)); vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.xyz),step(p.x,c.r)); float d=q.x-min(q.w,q.y); float e=1e-10; return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x); }
vec3 hsv2rgb(vec3 c){ vec3 p=abs(fract(c.xxx+vec3(1.,2./3.,1./3.))*6.-3.); return c.z*mix(vec3(1.),clamp(p-1.,0.,1.),c.y); }
void main(){ vec4 c=texture2D(tex,uv); vec3 h=rgb2hsv(c.rgb); h.x=fract(h.x+u_hue/6.28318); h.y*=u_sat; gl_FragColor=vec4(hsv2rgb(h),c.a); }`,
  },
  blur: {
    name: 'Gaussian blur (radius)',
    params: [{ key: 'u_r', label: 'Radius', min: 0, max: 1, step: 0.005, def: 0.01 }],
    src: `precision mediump float; varying vec2 uv; uniform sampler2D tex; uniform float u_r;
void main(){ vec4 sum=vec4(0.); float c=0.;
for(int i=-8;i<=8;i++){ for(int j=-8;j<=8;j++){
  vec2 o=vec2(float(i),float(j))*0.012*u_r;
  float w=exp(-(o.x*o.x+o.y*o.y)/(2.0*fmax(0.001,u_r)));
  sum += texture2D(tex, uv+o)*w; c+=w; } }
gl_FragColor = sum/c; }`,
  },
  pixelate: {
    name: 'Pixelate',
    params: [{ key: 'u_px', label: 'Pixel size', min: 0.001, max: 0.2, step: 0.001, def: 0.02 }],
    src: `precision mediump float; varying vec2 uv; uniform sampler2D tex; uniform float u_px;
void main(){ vec2 g = vec2(uv.x - mod(uv.x, u_px*0.02), uv.y - mod(uv.y, u_px*0.02)); gl_FragColor = texture2D(tex, g); }`,
  },
  sepia: {
    name: 'Sepia',
    params: [{ key: 'u_amt', label: 'Amount', min: 0, max: 1, step: 0.01, def: 0.5 }],
    src: `precision mediump float; varying vec2 uv; uniform sampler2D tex; uniform float u_amt;
void main(){ vec4 c=texture2D(tex,uv); vec3 s=vec3(clamp(c.r*0.393+c.g*0.769+c.b*0.189,0.,1.),clamp(c.r*0.349+c.g*0.686+c.b*0.168,0.,1.),clamp(c.r*0.272+c.g*0.534+c.b*0.131,0.,1.)); gl_FragColor=vec4(mix(c.rgb,s,u_amt),c.a); }`,
  },
};

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'Shader failed');
  return s;
}

export default function EffectsPage() {
  const toast = useToast();
  const canvasA = useRef<HTMLCanvasElement>(null);
  const canvasB = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [effectKey, setEffectKey] = useState<string>('brightness_contrast');
  const [params, setParams] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const c = canvasA.current;
    if (!c) return;
    try {
      const gl = c.getContext('webgl') as WebGLRenderingContext;
      glRef.current = gl;
    } catch { setError('WebGL is unavailable in this browser'); }
  }, []);

  useEffect(() => {
    if (!imgSrc) return;
    const img = new Image();
    img.onload = () => { imgRef.current = img; draw(); };
    img.src = imgSrc;
  }, [imgSrc]);

  const draw = () => {
    const gl = glRef.current;
    const img = imgRef.current;
    if (!gl || !img) return;
    const cA = canvasA.current!, cB = canvasB.current!;
    const w = gl.canvas.width, h = gl.canvas.height;
    cB.width = w; cB.height = h;

    const def = FRAGS[effectKey];
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, def.src.replace('__FLAGS__', '')));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      setError(gl.getProgramInfoLog(prog) || 'Shader link failed'); return;
    }
    gl.useProgram(prog);

    // Upload texture
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(gl.getUniformLocation(prog, 'tex'), 0);

    // Buffers
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.viewport(0, 0, w, h);

    gl.uniform1f(gl.getUniformLocation(prog, 'u_px'), 1.0);

    const drawPass = (canvas: HTMLCanvasElement, uniforms: Record<string, number>) => {
      gl.canvas.width = canvas.width; gl.canvas.height = canvas.height;
      for (const p of def.params) {
        gl.uniform1f(gl.getUniformLocation(prog, p.key), uniforms[p.key] ?? p.def);
      }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    // Baseline (before) pass with all defaults
    const defaults = Object.fromEntries(def.params.map((p) => [p.key, p.def]));
    drawPass(cB, defaults);

    // Effect (after) pass with adjusted params
    const adjusted = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v]));
    drawPass(cA, adjusted);
  };

  useEffect(() => {
    if (imgRef.current) { setError(null); try { draw(); } catch (err: any) { setError(err?.message || 'Failed to render effect'); } }
  }, [imgSrc, effectKey, params]);

  const effect = FRAGS[effectKey];

  return (
    <div>
      <h1 className="page-title">Preview Effects</h1>
      <p className="page-sub">Real WebGL shader effects running on your own image. Only implemented effects appear here.</p>

      <div className="card">
        <label className="btn primary" style={{ width: '100' }}>
          ⇪ Upload an image
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const r = new FileReader();
            r.onload = () => setImgSrc(String(r.result));
            r.readAsDataURL(f);
          }} />
        </label>
        {error && <ErrorState text={error} />}
      </div>

      {imgSrc && (
        <>
          <div className="effects-cmp" style={{ marginTop: 16 }}>
            <div className="card">
              <h3>After (effect applied)</h3>
              <canvas ref={canvasA} width={480} height={320} />
            </div>
            <div className="card">
              <h3>Before (original)</h3>
              <canvas ref={canvasB} width={480} height={320} />
            </div>
          </div>

          <div className="card" style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
              <span className="badge">Effect</span>
              <select className="select" style={{ maxWidth: 240 }} value={effectKey} onChange={(e) => { setEffectKey(e.target.value); setParams({}); }}>
                {Object.entries(FRAGS).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
              </select>
              <button className="btn sm" onClick={() => setParams({})}>↺ Reset settings</button>
            </div>
            {effect.params.map((p) => (
              <div key={p.key}>
                <label className="ctl-label"><span>{p.label}</span><b>{(params[p.key] ?? p.def).toFixed(3)}</b></label>
                <input
                  type="range"
                  min={p.min} max={p.max} step={p.step}
                  value={params[p.key] ?? p.def}
                  style={{ width: '100%' }}
                  onChange={(e) => setParams((prev) => ({ ...prev, [p.key]: Number(e.target.value) }))}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ErrorState({ text }: { text: string }) {
  return <div className="error-state" style={{ marginTop: 10 }}>✕ {text}</div>;
}
