import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stats } from "@react-three/drei";
import React, { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { solveMoon, Inputs } from "../lib/astro";

type Props = {
  inputs: Inputs;
  // optional speed multiplier for auto-scrub playback
  speed?: number;
  textures: {
    color: string;
    bump: string;
  };
};

function MoonMesh({ inputs, textures }: Props) {
  const { camera } = useThree();
  const group = useRef<THREE.Group>(null);
  const light = useRef<THREE.DirectionalLight>(null);
  const moon = useRef<THREE.Mesh>(null);

  const colorMap = useMemo(
    () => new THREE.TextureLoader().load(textures.color),
    [textures.color],
  );
  const bumpMap = useMemo(
    () => new THREE.TextureLoader().load(textures.bump),
    [textures.bump],
  );

  // Configure texture wrapping and orientation for proper lunar mapping
  colorMap.wrapS = THREE.RepeatWrapping;
  colorMap.wrapT = THREE.ClampToEdgeWrapping;
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.ClampToEdgeWrapping;

  // Natural texture orientation - let physics handle the orientation
  colorMap.flipY = true;
  bumpMap.flipY = true;

  // No manual texture offset - tidal locking will orient the Moon correctly
  colorMap.offset.x = 0.2;
  bumpMap.offset.x = 0.2;

  // Set anisotropic filtering for better quality
  colorMap.anisotropy = 16;
  bumpMap.anisotropy = 16;

  // Recompute astronomy solution when inputs change
  const sol = useMemo(() => solveMoon(inputs), [inputs]);

  // Point the directional light at the Moon with the computed Sun direction.
  useFrame(() => {
    if (!light.current || !group.current) return;

    // LIGHTING: Direct positioning based on Moon age in cycle
    // sol.sunDir now represents lighting direction based on orbital position
    const d = sol.sunDir;
    const lightDistance = 50;

    // Position light to create correct phases:
    // New Moon: light from behind Moon (positive Z)
    // Full Moon: light from in front of Moon (negative Z)
    // Quarters: light from sides (X axis)
    light.current.position.set(
      d[0] * lightDistance,
      d[1] * lightDistance,
      d[2] * lightDistance,
    );
    light.current.target.position.set(0, 0, 0);
    light.current.target.updateMatrixWorld();

    // ORIENTATION: Simple tidal locking
    if (group.current) {
      group.current.rotation.set(0, 0, 0);

      // TIDAL LOCK: Earth-facing side toward camera
      // Camera is at [0,0,3] looking toward origin along -Z
      // Moon should show near side (familiar maria patterns) to camera
      // No rotation needed - texture is already oriented correctly

      // Apply parallactic angle for correct "up/down" orientation
      group.current.rotateZ(-sol.parallacticAngleRad);
    }
  });

  return (
    <group ref={group}>
      <mesh ref={moon}>
        <sphereGeometry args={[1, 256, 256]} />
        <meshPhysicalMaterial
          map={colorMap}
          bumpMap={bumpMap}
          bumpScale={10}
          displacementMap={bumpMap}
          displacementScale={0.02}
          displacementBias={-0.01}
          roughness={0.9}
          metalness={0.0}
          clearcoat={0.0}
        />
      </mesh>

      {/* Soft fill to see the night side - like Earthshine */}
      <ambientLight intensity={0.2} />

      {/* Sun light - creates the terminator and lunar phases */}
      <directionalLight ref={light} intensity={2.0} castShadow={true} />
    </group>
  );
}

export default function MoonScene(props: Props) {
  return (
    <Canvas
      camera={{ position: [0, 0, 3.0], fov: 35, zoom: 0.5 }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={["#05060a"]} />
      <Suspense fallback={null}>
        <MoonMesh {...props} />
      </Suspense>
      <OrbitControls enablePan={false} enableZoom={true} enableRotate={true} />
    </Canvas>
  );
}
