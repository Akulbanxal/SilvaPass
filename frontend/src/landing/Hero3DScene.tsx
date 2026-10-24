import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { AlertTriangle, ShieldAlert, Sparkles, RefreshCw } from "lucide-react";

interface Hero3DSceneProps {
  onExploreClick?: () => void;
}

export const Hero3DScene: React.FC<Hero3DSceneProps> = ({ onExploreClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webGLSupported] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const testCanvas = document.createElement("canvas");
      return !!(testCanvas.getContext("webgl") || testCanvas.getContext("experimental-webgl"));
    } catch {
      return false;
    }
  });
  const [animPhase, setAnimPhase] = useState<"ingest" | "compare" | "resolved" | "invariant">("ingest");
  const [phaseProgress, setPhaseProgress] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !webGLSupported) return;

    const width = container.clientWidth;
    const height = container.clientHeight || 580;

    // Detect reduced motion preference
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // 1. Scene & Camera Setup with atmospheric depth
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x07130f, 0.038);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 9.2, 13.5);
    camera.lookAt(0, 0.2, 0);

    // 2. Renderer with tone mapping and shadow handling
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.appendChild(renderer.domElement);

    // 3. Lighting Setup: Multiple Directional & Rim Lights for Depth
    const ambientLight = new THREE.AmbientLight(0x0e2418, 2.4);
    scene.add(ambientLight);

    // Sun / Satellite screening light
    const sunLight = new THREE.DirectionalLight(0xb7ed78, 3.2);
    sunLight.position.set(9, 16, 9);
    scene.add(sunLight);

    // Soft cyan rim light from below/side
    const rimLight = new THREE.DirectionalLight(0x80ddb0, 2.2);
    rimLight.position.set(-10, -3, -8);
    scene.add(rimLight);

    // Dynamic focus point light hovering over the target plot
    const focusPointLight = new THREE.PointLight(0xb7ed78, 3.8, 14);
    focusPointLight.position.set(0.1, 2.8, 0.1);
    scene.add(focusPointLight);

    // 4. Floating Procedural Terrain Tile with Layered Elevation Depth
    const terrainGroup = new THREE.Group();
    scene.add(terrainGroup);

    const terrainSize = 10.5;
    const segments = 56;
    const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, segments, segments);
    terrainGeo.rotateX(-Math.PI / 2);

    const pos = terrainGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const dist = Math.sqrt(x * x + z * z);

      // Multi-frequency agricultural terrace elevation
      const baseElev =
        Math.sin(x * 0.42) * Math.cos(z * 0.42) * 0.42 +
        Math.sin(x * 0.85 + z * 0.75) * 0.16 +
        Math.cos(x * 1.2 - z * 0.9) * 0.08;

      // Subtle stepped contour terraces
      const terraced = Math.floor(baseElev * 4.5) / 4.5;
      const edgeWeight = Math.max(0, 1 - Math.pow(dist / (terrainSize * 0.52), 4));
      const finalY = terraced * edgeWeight * 0.92;
      pos.setY(i, finalY);

      // Vertex color depth gradient: Low valleys = deep forest, Terraces = natural olive
      const elevNorm = Math.min(1, Math.max(0, (finalY + 0.3) / 0.85));
      const colR = 0.04 + elevNorm * 0.08;
      const colG = 0.12 + elevNorm * 0.18;
      const colB = 0.08 + elevNorm * 0.08;

      colors[i * 3] = colR;
      colors[i * 3 + 1] = colG;
      colors[i * 3 + 2] = colB;
    }

    terrainGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.82,
      metalness: 0.15,
      flatShading: true,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainGroup.add(terrainMesh);

    // Beveled dark pedestal base underneath
    const baseGeo = new THREE.BoxGeometry(terrainSize, 0.45, terrainSize);
    const baseMat = new THREE.MeshBasicMaterial({ color: 0x030906 });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = -0.25;
    terrainGroup.add(baseMesh);

    // Fine topographic grid wireframe
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x1b4332,
      wireframe: true,
      transparent: true,
      opacity: 0.38,
    });
    const wireMesh = new THREE.Mesh(terrainGeo, wireMat);
    wireMesh.position.y += 0.008;
    terrainGroup.add(wireMesh);

    // 5. Neighboring Reference Plots (Contextual Cadastral Parcels)
    const contextPlotMat = new THREE.LineBasicMaterial({
      color: 0x163327,
      transparent: true,
      opacity: 0.6,
    });
    const bgPlots = [
      [
        [-4.0, -1.8],
        [-2.2, -2.0],
        [-2.4, -4.2],
        [-4.2, -4.0],
      ],
      [
        [2.0, 1.4],
        [4.2, 1.7],
        [3.9, 4.0],
        [1.8, 3.6],
      ],
      [
        [-3.9, 1.8],
        [-2.0, 2.0],
        [-2.1, 4.0],
        [-4.1, 3.8],
      ],
      [
        [2.1, -2.0],
        [4.0, -1.8],
        [4.1, -4.0],
        [2.3, -4.2],
      ],
    ];

    bgPlots.forEach((coords) => {
      const pts = coords.map(([px, pz]) => new THREE.Vector3(px, 0.1, pz));
      pts.push(pts[0].clone());
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geo, contextPlotMat);
      terrainGroup.add(line);
    });

    // 6. Base Active Registered Plot (Plot A - Reference Polygon)
    const plotACoords = [
      [-1.4, -1.2],
      [1.0, -1.4],
      [1.55, 0.9],
      [0.25, 1.55],
      [-1.3, 1.0],
    ];

    const plotAPoints = plotACoords.map(([px, pz]) => new THREE.Vector3(px, 0.14, pz));
    plotAPoints.push(plotAPoints[0].clone());
    const plotAGeo = new THREE.BufferGeometry().setFromPoints(plotAPoints);

    const plotALineMat = new THREE.LineBasicMaterial({
      color: 0xb7ed78,
      linewidth: 2,
    });
    const plotALine = new THREE.Line(plotAGeo, plotALineMat);
    terrainGroup.add(plotALine);

    // Plot A interior surface fill
    const plotAShape = new THREE.Shape();
    plotAShape.moveTo(plotACoords[0][0], -plotACoords[0][1]);
    for (let i = 1; i < plotACoords.length; i++) {
      plotAShape.lineTo(plotACoords[i][0], -plotACoords[i][1]);
    }
    plotAShape.closePath();

    const shapeGeo = new THREE.ShapeGeometry(plotAShape);
    shapeGeo.rotateX(-Math.PI / 2);
    const plotAFillMat = new THREE.MeshBasicMaterial({
      color: 0xb7ed78,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
    });
    const plotAFill = new THREE.Mesh(shapeGeo, plotAFillMat);
    plotAFill.position.y = 0.13;
    terrainGroup.add(plotAFill);

    // 7. Candidate Duplicate Plot (Plot B - Shifted & Jittered Polygon)
    const plotBCoords = [
      [-1.31, -1.13], // ~1.27m geodesic drift offset
      [1.09, -1.31],
      [1.62, 0.99],
      [0.34, 1.61],
      [-1.23, 1.07],
    ];

    const plotBPoints = plotBCoords.map(([px, pz]) => new THREE.Vector3(px, 0.32, pz));
    plotBPoints.push(plotBPoints[0].clone());
    const plotBGeo = new THREE.BufferGeometry().setFromPoints(plotBPoints);

    const plotBLineMat = new THREE.LineBasicMaterial({
      color: 0x80ddb0,
      transparent: true,
      opacity: 0.95,
    });
    const plotBLine = new THREE.Line(plotBGeo, plotBLineMat);
    terrainGroup.add(plotBLine);

    const plotBShape = new THREE.Shape();
    plotBShape.moveTo(plotBCoords[0][0], -plotBCoords[0][1]);
    for (let i = 1; i < plotBCoords.length; i++) {
      plotBShape.lineTo(plotBCoords[i][0], -plotBCoords[i][1]);
    }
    plotBShape.closePath();

    const shapeBGeo = new THREE.ShapeGeometry(plotBShape);
    shapeBGeo.rotateX(-Math.PI / 2);
    const plotBFillMat = new THREE.MeshBasicMaterial({
      color: 0x80ddb0,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    });
    const plotBFill = new THREE.Mesh(shapeBGeo, plotBFillMat);
    plotBFill.position.y = 0.3;
    terrainGroup.add(plotBFill);

    // 8. Vertex Drift Connector Vectors (Illustrating Spatial IoU Comparison)
    const driftVectorsGroup = new THREE.Group();
    terrainGroup.add(driftVectorsGroup);

    const driftLinesMat = new THREE.LineDashedMaterial({
      color: 0xf59e0b,
      dashSize: 0.08,
      gapSize: 0.05,
      transparent: true,
      opacity: 0.85,
    });

    for (let i = 0; i < plotACoords.length; i++) {
      const pA = new THREE.Vector3(plotACoords[i][0], 0.14, plotACoords[i][1]);
      const pB = new THREE.Vector3(plotBCoords[i][0], 0.32, plotBCoords[i][1]);
      const driftGeo = new THREE.BufferGeometry().setFromPoints([pA, pB]);
      const driftLine = new THREE.Line(driftGeo, driftLinesMat);
      driftLine.computeLineDistances();
      driftVectorsGroup.add(driftLine);

      // Vertex marker sphere
      const dotA = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xb7ed78 })
      );
      dotA.position.copy(pA);
      driftVectorsGroup.add(dotA);

      const dotB = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b })
      );
      dotB.position.copy(pB);
      driftVectorsGroup.add(dotB);
    }
    driftVectorsGroup.visible = false;

    // 9. Scanning Laser Sweep across boundaries
    const scanGeo = new THREE.PlaneGeometry(0.09, 3.6);
    scanGeo.rotateX(-Math.PI / 2);
    const scanMat = new THREE.MeshBasicMaterial({
      color: 0xb7ed78,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const scanMesh = new THREE.Mesh(scanGeo, scanMat);
    scanMesh.position.set(0, 0.36, 0);
    terrainGroup.add(scanMesh);

    // 10. Central Plot Identity Beacon Node
    const centroidBeaconGroup = new THREE.Group();
    centroidBeaconGroup.position.set(0.05, 0.16, 0.14);
    terrainGroup.add(centroidBeaconGroup);

    const beaconCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xb7ed78 })
    );
    centroidBeaconGroup.add(beaconCore);

    const beaconPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 2.2, 8),
      new THREE.MeshBasicMaterial({ color: 0x80ddb0, transparent: true, opacity: 0.65 })
    );
    beaconPillar.position.y = 1.1;
    centroidBeaconGroup.add(beaconPillar);

    const beaconHalo = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.32, 28),
      new THREE.MeshBasicMaterial({ color: 0xb7ed78, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
    );
    beaconHalo.rotateX(-Math.PI / 2);
    beaconHalo.position.y = 0.02;
    centroidBeaconGroup.add(beaconHalo);

    // 11. Connecting Spline Route Lines to Outward Claim Ledger Hub
    const routeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.05, 0.35, 0.14),
      new THREE.Vector3(1.8, 1.0, -0.7),
      new THREE.Vector3(3.6, 1.4, -2.0),
      new THREE.Vector3(5.2, 0.7, -2.8),
    ]);
    const routePoints = routeCurve.getPoints(60);
    const routeGeo = new THREE.BufferGeometry().setFromPoints(routePoints);
    const routeLine = new THREE.Line(
      routeGeo,
      new THREE.LineBasicMaterial({ color: 0x80ddb0, transparent: true, opacity: 0.6 })
    );
    terrainGroup.add(routeLine);

    // Moving data pulse packet along route
    const packetMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 14, 14),
      new THREE.MeshBasicMaterial({ color: 0xb7ed78 })
    );
    terrainGroup.add(packetMesh);

    // 12. Floating Atmospheric Particle Dust Field
    const particleCount = 140;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 16;
      particlePositions[i + 1] = Math.random() * 5.5 + 0.2;
      particlePositions[i + 2] = (Math.random() - 0.5) * 16;
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x80ddb0,
      size: 0.07,
      transparent: true,
      opacity: 0.5,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // 13. Gentle Mouse Pointer Parallax / Tilt
    let targetRotationX = 0.32;
    let targetRotationY = -0.42;
    let currentRotationX = targetRotationX;
    let currentRotationY = targetRotationY;

    const handlePointerMove = (e: MouseEvent) => {
      if (prefersReducedMotion) return;
      const rect = container.getBoundingClientRect();
      const normX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const normY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      targetRotationY = -0.42 + normX * 0.32;
      targetRotationX = 0.32 - normY * 0.2;
    };

    // Only attach pointer movement on devices supporting hover/pointer
    const hasPointer = window.matchMedia("(hover: hover)").matches;
    if (hasPointer && !prefersReducedMotion) {
      window.addEventListener("mousemove", handlePointerMove);
    }

    // 14. 4-Phase Plot Identity & Invariant Animation Loop
    const clock = new THREE.Clock();
    let animId: number;
    const cycleDuration = 10.0;

    const animate = () => {
      animId = requestAnimationFrame(animate);

      const elapsed = clock.getElapsedTime();
      const cycleTime = prefersReducedMotion ? 6.0 : elapsed % cycleDuration;
      const progress = cycleTime / cycleDuration;
      setPhaseProgress(progress);

      // Smooth camera / terrain tilt interpolation
      if (!prefersReducedMotion) {
        currentRotationX += (targetRotationX - currentRotationX) * 0.045;
        currentRotationY += (targetRotationY - currentRotationY) * 0.045;
        terrainGroup.rotation.x = currentRotationX;
        terrainGroup.rotation.y = currentRotationY;

        particleSystem.rotation.y = elapsed * 0.025;

        const haloScale = 1.0 + Math.sin(elapsed * 4) * 0.22;
        beaconHalo.scale.set(haloScale, haloScale, haloScale);

        const packetT = (elapsed * 0.35) % 1;
        const packetPos = routeCurve.getPoint(packetT);
        packetMesh.position.copy(packetPos);
      }

      // --- Sequence Phases ---
      if (cycleTime < 2.5) {
        // Phase 1: Ingestion
        setAnimPhase("ingest");
        const t = cycleTime / 2.5;
        plotBFill.position.y = 0.75 - t * 0.45;
        plotBLine.position.y = 0.75 - t * 0.45;
        plotBLineMat.color.setHex(0x80ddb0);
        plotBFillMat.color.setHex(0x80ddb0);
        scanMesh.visible = false;
        driftVectorsGroup.visible = false;
        focusPointLight.color.setHex(0xb7ed78);
      } else if (cycleTime < 5.0) {
        // Phase 2: Boundary Scanning & Vector Comparison
        setAnimPhase("compare");
        plotBFill.position.y = 0.3;
        plotBLine.position.y = 0.32;
        scanMesh.visible = true;
        driftVectorsGroup.visible = true;

        const scanT = (cycleTime - 2.5) / 2.5;
        scanMesh.position.x = -1.8 + scanT * 3.6;
        scanMesh.position.z = -0.15 + Math.sin(scanT * Math.PI) * 0.25;

        plotBLineMat.color.setHex(0xf59e0b);
        plotBFillMat.color.setHex(0xf59e0b);
        focusPointLight.color.setHex(0xf59e0b);
      } else if (cycleTime < 7.5) {
        // Phase 3: Identity Resolved & Duplicate Flagged (Amber)
        setAnimPhase("resolved");
        scanMesh.visible = false;
        driftVectorsGroup.visible = true;

        plotBLineMat.color.setHex(0xf59e0b);
        plotBFillMat.color.setHex(0xf59e0b);
        const pulse = 0.18 + Math.sin(elapsed * 8) * 0.12;
        plotBFillMat.opacity = pulse;
        focusPointLight.color.setHex(0xf59e0b);
      } else {
        // Phase 4: Shared Invariant Rejection (Crisp Red)
        setAnimPhase("invariant");
        scanMesh.visible = false;
        driftVectorsGroup.visible = false;

        plotBLineMat.color.setHex(0xef4444);
        plotBFillMat.color.setHex(0xef4444);
        focusPointLight.color.setHex(0xef4444);
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize handling
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight || 580;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      if (hasPointer && !prefersReducedMotion) {
        window.removeEventListener("mousemove", handlePointerMove);
      }
      window.removeEventListener("resize", handleResize);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      terrainGeo.dispose();
      terrainMat.dispose();
      baseGeo.dispose();
      baseMat.dispose();
      shapeGeo.dispose();
      shapeBGeo.dispose();
      scanGeo.dispose();
      scanMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      renderer.dispose();
    };
  }, [webGLSupported]);

  return (
    <div className="relative w-full h-[460px] sm:h-[540px] lg:h-[620px] rounded-2xl overflow-hidden bg-[#07130F] border border-[#1b4332]/60 shadow-2xl flex items-center justify-center">
      {/* 3D WebGL Canvas */}
      {webGLSupported ? (
        <div ref={containerRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />
      ) : (
        /* Accessible Fallback for WebGL restricted browsers */
        <div className="flex flex-col items-center justify-center p-8 text-center text-[#A2B4A8] max-w-md">
          <ShieldAlert className="w-12 h-12 text-[#B7ED78] mb-3" />
          <h4 className="text-base font-semibold text-[#F2F5ED] mb-1">Interactive 3D Engine Preview</h4>
          <p className="text-xs mb-4">
            WebGL acceleration is restricted on this browser. Procedural plot resolution visualization is shown in 2D mode below.
          </p>
          <div className="w-full bg-[#10251C] border border-[#1b4332] rounded-lg p-4 font-mono text-xs text-left">
            <div className="text-[#B7ED78] font-bold mb-1">&bull; BASE PLOT: PLOT-BASE-DEMO (30.06 ha)</div>
            <div className="text-[#F59E0B] font-bold mb-1">&bull; CANDIDATE: PLOT-DUP-DEMO (IoU 99.25%)</div>
            <div className="text-[#EF4444] font-bold">&bull; CLAIM REJECTION: 2,000 kg &gt; 1,200 kg remaining</div>
          </div>
        </div>
      )}

      {/* Atmospheric Radial Lighting */}
      <div className="absolute inset-0 pointer-events-none bg-radial-glow opacity-80" />

      {/* Integrated Tactical Reticle HUD: Top Left (Resolution Engine) */}
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10 max-w-[220px] sm:max-w-[270px] backdrop-blur-md bg-[#07130F]/80 border border-[#1b4332]/90 rounded-xl p-2.5 sm:p-3 shadow-xl pointer-events-none">
        {/* Reticle corner accent markers */}
        <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-[#1b4332]/70">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                animPhase === "invariant"
                  ? "bg-[#EF4444]"
                  : animPhase === "resolved"
                  ? "bg-[#F59E0B]"
                  : "bg-[#B7ED78]"
              } animate-pulse`}
            />
            <span className="text-[9px] sm:text-[10px] font-mono tracking-wider uppercase text-[#95d5b2] font-semibold">
              RESOLUTION ENGINE
            </span>
          </div>
          <span className="text-[8px] sm:text-[9px] font-mono text-[#A2B4A8]">H3-RES9</span>
        </div>

        <div className="space-y-1 text-[10px] sm:text-[11px] font-mono">
          <div className="flex justify-between items-center">
            <span className="text-[#A2B4A8]">Base Plot:</span>
            <span className="text-[#F2F5ED] font-semibold">PLOT-BASE-DEMO</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#A2B4A8]">Candidate:</span>
            <span className="text-[#80DDB0]">PLOT-DUP-DEMO</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#A2B4A8]">Overlap:</span>
            <span className="text-[#F59E0B] font-bold">IoU 99.25%</span>
          </div>
          <div className="hidden sm:flex justify-between items-center">
            <span className="text-[#A2B4A8]">Centroid Drift:</span>
            <span className="text-[#F2F5ED]">1.27 meters</span>
          </div>
        </div>

        {/* Dynamic Status Tag */}
        <div className="mt-2 pt-1.5 border-t border-[#1b4332]/60 flex items-center justify-between">
          <span className="text-[8px] sm:text-[9px] text-[#A2B4A8]">STATUS:</span>
          {animPhase === "ingest" && (
            <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold text-[#80DDB0]">
              <Sparkles className="w-2.5 h-2.5 animate-spin" /> Ingesting...
            </span>
          )}
          {animPhase === "compare" && (
            <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold text-[#F59E0B]">
              <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Boundary Scan
            </span>
          )}
          {animPhase === "resolved" && (
            <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold text-[#F59E0B]">
              <AlertTriangle className="w-2.5 h-2.5" /> Flagged Duplicate
            </span>
          )}
          {animPhase === "invariant" && (
            <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold text-[#EF4444]">
              <ShieldAlert className="w-2.5 h-2.5" /> Invariant Enforced
            </span>
          )}
        </div>
      </div>

      {/* Integrated Tactical Reticle HUD: Bottom Right (Claim Invariant Ledger) */}
      <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-10 max-w-[230px] sm:max-w-[280px] backdrop-blur-md bg-[#07130F]/85 border border-[#1b4332]/90 rounded-xl p-2.5 sm:p-3 shadow-xl pointer-events-none">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] sm:text-[10px] font-mono tracking-wider uppercase text-[#B7ED78] font-bold">
            CLAIM INVARIANT LEDGER
          </span>
          <span className="text-[7px] sm:text-[8px] tracking-wider uppercase px-1 py-0.2 rounded bg-[#10251C] text-[#80DDB0] border border-[#1b4332]">
            DEMO DATA
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 py-1.5 px-2 bg-[#10251C]/80 rounded-lg border border-[#1b4332]/80 text-center font-mono">
          <div>
            <div className="text-[8px] sm:text-[9px] text-[#A2B4A8]">APPROVED</div>
            <div className="text-[10px] sm:text-xs font-bold text-[#F2F5ED]">3,000 kg</div>
          </div>
          <div>
            <div className="text-[8px] sm:text-[9px] text-[#A2B4A8]">CLAIMED</div>
            <div className="text-[10px] sm:text-xs font-bold text-[#80DDB0]">1,800 kg</div>
          </div>
          <div>
            <div className="text-[8px] sm:text-[9px] text-[#A2B4A8]">REMAINING</div>
            <div className="text-[10px] sm:text-xs font-bold text-[#B7ED78]">1,200 kg</div>
          </div>
        </div>

        {/* Claim Attempt Notification */}
        <div className="mt-2 pt-1.5 border-t border-[#1b4332]/60">
          <div className="flex items-start gap-1.5 bg-[#190d0e]/90 border border-[#EF4444]/40 rounded-lg p-1.5 text-[9px] sm:text-[10px] font-mono">
            <span className="text-[#EF4444] font-bold shrink-0 mt-0.5">[X]</span>
            <div>
              <span className="text-[#EF4444] font-semibold block">ATTEMPT: 2,000 kg &bull; REJECTED</span>
              <p className="text-[#A2B4A8] text-[8px] sm:text-[9px] mt-0.5 leading-tight">
                Exceeds remaining 1,200 kg by 800 kg. Balance preserved.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-1 text-[7px] sm:text-[8px] text-[#A2B4A8] text-right font-mono">
          ILLUSTRATIVE DEMONSTRATION DATA
        </div>
      </div>

      {/* Progress timeline bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#10251C]">
        <div
          className={`h-full transition-all duration-300 ${
            animPhase === "invariant" ? "bg-[#EF4444]" : animPhase === "resolved" ? "bg-[#F59E0B]" : "bg-[#B7ED78]"
          }`}
          style={{ width: `${Math.round(phaseProgress * 100)}%` }}
        />
      </div>

      {/* Small 3D Scene Controls */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 flex items-center gap-2 pointer-events-auto">
        <span className="text-[9px] sm:text-[10px] font-mono text-[#A2B4A8] hidden md:inline-block bg-[#07130F]/70 px-2 py-1 rounded border border-[#1b4332]">
          Drag to tilt 3D terrain
        </span>
        {onExploreClick && (
          <button
            onClick={onExploreClick}
            className="text-[9px] sm:text-[10px] font-mono text-[#80DDB0] hover:text-[#B7ED78] bg-[#07130F]/80 px-2.5 py-1 rounded border border-[#1b4332] hover:border-[#80DDB0] transition cursor-pointer"
          >
            Inspect Invariant &rarr;
          </button>
        )}
      </div>
    </div>
  );
};
