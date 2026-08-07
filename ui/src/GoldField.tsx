import { useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// Campo de puntos con onda de profundidad — heredado del landing de SUR
// Protocol, reforjado en oro hermetico. GPU puro, ripple del mouse,
// respeta prefers-reduced-motion.
const COLS = 170;
const ROWS = 96;
const LAYERS = 3;

function buildGeometry() {
  const count = COLS * ROWS * LAYERS;
  const positions = new Float32Array(count * 3);
  const aLayer = new Float32Array(count);
  let i = 0;
  for (let l = 0; l < LAYERS; l++) {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        positions[i * 3 + 0] = (x / (COLS - 1) - 0.5) * 2;
        positions[i * 3 + 1] = (y / (ROWS - 1) - 0.5) * 2;
        positions[i * 3 + 2] = 0;
        aLayer[i] = l;
        i++;
      }
    }
  }
  return { positions, aLayer };
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uAspect;
  uniform float uReduced;
  uniform float uPixelRatio;
  attribute float aLayer;
  varying float vDepth;
  varying float vGlow;
  varying float vRand;

  void main() {
    vec3 p = position;
    float layer = aLayer;
    float lz = layer - 1.0;

    float t = uTime * (uReduced > 0.5 ? 0.0 : 1.0);

    float freq = 2.0 + layer * 0.5;
    float w = 0.0;
    w += sin(p.x * freq + t * 0.42 + layer) * 0.11;
    w += sin(p.y * (freq * 0.8) - t * 0.34 + layer * 1.7) * 0.09;
    w += sin((p.x + p.y) * 1.2 + t * 0.22) * 0.055;

    vec2 m = vec2(uMouse.x * uAspect, uMouse.y);
    vec2 g = vec2(p.x * uAspect, p.y);
    float d = distance(g, m);
    float ripple = exp(-d * d * 2.6) * 0.5;
    w += ripple;

    float z = lz * 0.5 + w;
    vec2 par = uMouse * (0.04 + layer * 0.045);
    vec3 worldPos = vec3((p.x + par.x) * uAspect * 3.2, (p.y + par.y) * 3.2, z);

    vec4 mv = modelViewMatrix * vec4(worldPos, 1.0);
    gl_Position = projectionMatrix * mv;

    float base = 1.0 + ripple * 3.6 + (2.0 - layer) * 0.35;
    gl_PointSize = clamp(base * (7.0 / -mv.z) * uPixelRatio, 1.0, 12.0);

    vDepth = z;
    vGlow = ripple;
    vRand = fract(sin(dot(p.xy, vec2(12.9898, 78.233))) * 43758.5453);
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;
  varying float vDepth;
  varying float vGlow;
  varying float vRand;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float dist = length(c);
    if (dist > 0.5) discard;
    float soft = smoothstep(0.5, 0.0, dist);

    // oro hermetico — un solo tono, el brillo hace el trabajo
    vec3 gold = vec3(0.77, 0.66, 0.31);
    float depthMix = clamp((vDepth + 1.0) * 0.5, 0.0, 1.0);
    float lum = 0.22 + depthMix * 0.36 + vGlow * 0.7 + (vRand - 0.5) * 0.10;
    vec3 col = gold * lum;

    float a = soft * clamp(0.22 + depthMix * 0.3 + vGlow * 0.5, 0.0, 0.85);
    gl_FragColor = vec4(col, a);
  }
`;

function Field() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const target = useRef(new THREE.Vector2(0, 0));
  const eased = useRef(new THREE.Vector2(0, 0));
  const { size } = useThree();

  const { positions, aLayer } = useMemo(buildGeometry, []);
  const reduced = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uAspect: { value: 1 },
      uReduced: { value: reduced ? 1 : 0 },
      uPixelRatio: {
        value: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1,
      },
    }),
    [reduced],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      target.current.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        -((e.clientY / window.innerHeight) * 2 - 1),
      );
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  useFrame((_, delta) => {
    eased.current.lerp(target.current, Math.min(1, delta * 3.2));
    const mat = matRef.current;
    if (mat) {
      mat.uniforms.uTime.value += delta;
      mat.uniforms.uMouse.value.copy(eased.current);
      mat.uniforms.uAspect.value = size.width / Math.max(1, size.height);
    }
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aLayer" args={[aLayer, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default function GoldField() {
  return (
    <Canvas
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 5], fov: 60 }}
    >
      <Field />
    </Canvas>
  );
}
