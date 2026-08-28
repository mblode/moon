"use client";

import { useTexture } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useLayoutEffect, useRef } from "react";
import {
  type DirectionalLight,
  Matrix4,
  type Mesh,
  type PerspectiveCamera,
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

/**
 * Lunar diffuse BRDF: Lommel-Seeliger in place of Lambert.
 *
 * Regolith is retroreflective — loose, mutually shadowing grains scatter light
 * back toward its source — so radiance goes as mu0 / (mu0 + mu) rather than as
 * mu0 alone. The difference is the whole appearance of a full moon. With
 * Lambert the sun sits behind the viewer, mu0 becomes the cosine of the angle
 * from disk centre, and the limb falls to black: a shaded ball. Lommel-Seeliger
 * has mu ~ mu0 at full phase, the mu0 cancels, and the disk goes uniformly
 * bright right out to the silhouette, which is what the moon actually does.
 * There is no special case for full moon; it falls out of the ratio.
 *
 * three accumulates `directDiffuse` as mu0 * albedo / PI, so dividing by
 * (mu0 + mu) is the entire correction.
 *
 * Deliberately *not* normalised by the factor of 2 that would hold disk-centre
 * brightness at its Lambert value. The albedo map is a visually stretched LRO
 * product, not physical albedo: mean linear 0.32, max 0.91, with 13.6 percent
 * of pixels above 0.5. Doubling clips all of those to flat white at the sunward
 * limb, where mu is small and the ratio approaches 2. Unnormalised, the product
 * mu0 / (mu0 + mu) is bounded by 1 by construction, and the brightest value
 * this can put on screen is 0.89. Nothing clips at any phase, which matters
 * because the canvas is `flat` and has no tone mapping to catch an overshoot.
 * The cost is a full moon at half the albedo map's value — dimmer at the centre
 * than before, far brighter at the limb.
 *
 * Only `directDiffuse` is touched, so the ambient earthshine below keeps its
 * own geometry rather than inheriting the sun's phase angle. This assumes the
 * scene's one and only direct light is the sun; a second one would need the
 * correction applied per light instead.
 */
const LUNAR_BRDF = `
#if NUM_DIR_LIGHTS > 0
	{
		float lunarMu0 = max( dot( geometryNormal, directionalLights[ 0 ].direction ), 0.0 );
		float lunarMu = max( dot( geometryNormal, geometryViewDir ), 0.0 );
		// mu0 <= mu0 + mu, so the result is bounded by 1. The epsilon only keeps
		// the exact silhouette, where both cosines vanish, out of 0 / 0.
		reflectedLight.directDiffuse /= max( lunarMu0 + lunarMu, 1e-4 );
	}
#endif
#include <lights_fragment_end>
`;

/** Shared by the textured moon and its fallback, so the disk does not change
    brightness the moment the surface maps land. */
function applyLunarBrdf(shader: { fragmentShader: string }) {
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <lights_fragment_end>",
    LUNAR_BRDF
  );
}

/** Framing for a viewport at least as wide as it is tall. */
const CAMERA_Z = 5.5;
/** Disk radius as a share of the half-extent of the narrower axis. */
const DISK_FILL = 0.8;

/**
 * The fov is vertical, so on a phone held upright the disk grows with the
 * height until it is all but touching both edges: 92 percent of the width at
 * 390x844. Backing the camera off restores the margin.
 *
 * Only viewports taller than they are wide move. min(1, aspect) makes the
 * required distance fall below CAMERA_Z everywhere else, so a laptop keeps the
 * hand-tuned framing exactly.
 */
function FitCamera() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);

  useLayoutEffect(() => {
    const halfFov = (camera.fov * Math.PI) / 360;
    const aspect = size.width / size.height;
    camera.position.z = Math.max(
      CAMERA_Z,
      1 / (DISK_FILL * Math.tan(halfFov) * Math.min(1, aspect))
    );
    // Only the position changes, so the projection matrix still holds; r3f
    // rewrites it on resize. The frameloop is on demand, so ask for a frame.
    invalidate();
  }, [camera, size, invalidate]);

  return null;
}

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
      <meshStandardMaterial
        color="#8b8b88"
        metalness={0}
        onBeforeCompile={applyLunarBrdf}
        roughness={1}
      />
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
        onBeforeCompile={applyLunarBrdf}
        roughness={0.9}
      />
    </mesh>
  );
}

export default function MoonScene({ sol, textures }: Props) {
  return (
    <Canvas
      // 5.5 units back at 35 degrees leaves the disk clear of the console on a
      // laptop viewport, with black around it. FitCamera holds that margin on
      // taller-than-wide viewports, where the vertical fov would crop the disk.
      camera={{ fov: 35, position: [0, 0, CAMERA_Z] }}
      // `flat` disables ACES tone mapping, which crushes the midtones of a
      // single-light matte surface. Nothing here has any HDR range to map.
      dpr={[1, 2]}
      flat
      // Nothing animates: the light only moves when the solution changes.
      frameloop="demand"
      gl={{ alpha: true, antialias: true }}
    >
      <FitCamera />
      <Lighting sol={sol} />
      <Suspense fallback={<PlainMoon sol={sol} />}>
        <TexturedMoon sol={sol} textures={textures} />
      </Suspense>
    </Canvas>
  );
}
