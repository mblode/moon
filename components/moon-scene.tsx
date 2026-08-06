"use client";

import { OrbitControls, useTexture } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useLayoutEffect, useRef } from "react";
import {
  type DirectionalLight,
  Matrix4,
  type Mesh,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from "three";

import type { MoonSolution } from "@/lib/astro";

export interface MoonTextures {
  color: string;
  normal: string;
  roughness: string;
}

interface Props {
  sol: MoonSolution;
  textures: MoonTextures;
}

/**
 * Lunar body frame -> sphere geometry frame.
 *
 * three's SphereGeometry puts u=0 at -X and increases u as a positive rotation
 * about +Y, and its uv.y=1 (the image's top row, with the default flipY) sits at
 * +Y. So for a north-up equirectangular map, lunar north lands on +Y and
 * selenographic longitude runs eastward with u.
 *
 * Which longitude sits at u=0 depends on the map product. This one is centred on
 * 0 degrees, i.e. lon 0 is at u=0.5 -> geometry +X. Calibrated from the image
 * rather than by eye: Mare Crisium (17N, 59E) is the isolated dark patch at
 * u=0.667, which puts lon 0 at u=0.503. Cross-checks: the far side brightness
 * peak falls at u=0.99 (180 degrees) and the western mare boundary at u=0.29
 * (Oceanus Procellarum, about 77W).
 *
 * Columns are the geometry axes expressed in body coordinates.
 */
const TEXTURE_FIX = new Matrix4().makeBasis(
  new Vector3(1, 0, 0),
  new Vector3(0, 0, 1),
  new Vector3(0, -1, 0)
);

/** Radiance is albedo/PI * intensity * N.L, so PI puts the sub-solar point at
    exactly the albedo map's value. */
const SUN_INTENSITY = Math.PI;
const LIGHT_DISTANCE = 100;

function Lighting({ sol }: { sol: MoonSolution }) {
  const light = useRef<DirectionalLight>(null);
  const { invalidate } = useThree();

  useLayoutEffect(() => {
    if (!light.current) {
      return;
    }
    const [x, y, z] = sol.sunDir;
    light.current.position.set(
      x * LIGHT_DISTANCE,
      y * LIGHT_DISTANCE,
      z * LIGHT_DISTANCE
    );
    light.current.target.position.set(0, 0, 0);
    light.current.target.updateMatrixWorld();
    invalidate();
  }, [sol, invalidate]);

  return (
    <>
      {/* Earthshine. Earth's lit fraction seen from the moon is the complement
          of the moon's phase, so this is brightest at new moon and gone at full,
          which is exactly when you can and cannot see it. */}
      <ambientLight intensity={0.025 * (1 - sol.illumFraction)} />
      <directionalLight intensity={SUN_INTENSITY} ref={light} />
    </>
  );
}

function useOrientation(sol: MoonSolution) {
  const mesh = useRef<Mesh>(null);
  const { invalidate } = useThree();

  useLayoutEffect(() => {
    if (!mesh.current) {
      return;
    }
    const { x, y, z } = sol.bodyAxes;
    const sceneFromBody = new Matrix4().makeBasis(
      new Vector3(...x),
      new Vector3(...y),
      new Vector3(...z)
    );
    mesh.current.quaternion.setFromRotationMatrix(
      sceneFromBody.multiply(TEXTURE_FIX)
    );
    invalidate();
  }, [sol, invalidate]);

  return mesh;
}

/** Shown while the surface maps download. Untextured, but lit from the correct
    direction, so the phase is readable in the first frame. */
function PlainMoon({ sol }: { sol: MoonSolution }) {
  const mesh = useOrientation(sol);
  return (
    <mesh ref={mesh}>
      <sphereGeometry args={[1, 64, 64]} />
      <meshStandardMaterial color="#8b8b88" metalness={0} roughness={1} />
    </mesh>
  );
}

function TexturedMoon({ sol, textures }: Props) {
  const mesh = useOrientation(sol);
  const { gl } = useThree();

  const maps = useTexture(
    {
      map: textures.color,
      normalMap: textures.normal,
      roughnessMap: textures.roughness,
    },
    (loaded) => {
      const anisotropy = Math.min(16, gl.capabilities.getMaxAnisotropy());
      for (const texture of Object.values(loaded)) {
        texture.anisotropy = anisotropy;
      }
      // Only the albedo carries colour; normal and roughness are data and must
      // stay linear (three's default).
      loaded.map.colorSpace = SRGBColorSpace;
    }
  );

  return (
    <mesh ref={mesh}>
      {/* 128 segments: silhouette error is 3e-4 of the radius, sub-pixel at any
          size this renders. Relief comes from the normal map, not geometry. */}
      <sphereGeometry args={[1, 128, 128]} />
      <meshStandardMaterial
        {...maps}
        metalness={0}
        normalScale={new Vector2(1, 1)}
        roughness={0.9}
      />
    </mesh>
  );
}

export default function MoonScene({ sol, textures }: Props) {
  return (
    <Canvas
      // 5.5 units back at 35 degrees leaves the disk clear of the console on a
      // laptop viewport, with black around it.
      camera={{ fov: 35, position: [0, 0, 5.5] }}
      // `flat` disables ACES tone mapping, which crushes the midtones of a
      // single-light matte surface. Nothing here has any HDR range to map.
      dpr={[1, 2]}
      flat
      // Nothing animates: the light only moves when the solution changes.
      frameloop="demand"
      gl={{ alpha: true, antialias: true }}
    >
      <Lighting sol={sol} />
      <Suspense fallback={<PlainMoon sol={sol} />}>
        <TexturedMoon sol={sol} textures={textures} />
      </Suspense>
      {/* Zoom is off so the wheel scrolls the page, and the orbit is clamped:
          free rotation would let you spin the moon out of the orientation the
          page is claiming is correct. */}
      <OrbitControls
        enableDamping={false}
        enablePan={false}
        enableZoom={false}
        maxAzimuthAngle={Math.PI / 7}
        maxPolarAngle={Math.PI / 2 + 0.4}
        minAzimuthAngle={-Math.PI / 7}
        minPolarAngle={Math.PI / 2 - 0.4}
      />
    </Canvas>
  );
}
