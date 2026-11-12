import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  LineChart,
  Grid,
  Box,
  Compass,
  Calculator,
  Plus,
  Trash2,
  Play,
  Pause,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Share2,
  Sparkles,
  FileSignature,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  detectFreeParameters,
  sampleDesmosCurve,
  computePointsOfInterest,
  computeCalculusAnalysis,
  computeMatrixDeterminant,
  computeMatrixInverse,
  computeMatrixTranspose,
  computeMatrixTrace,
  computeMatrixRREF,
  multiplyMatrices,
  addMatrices,
  computeEigenvaluesAndCharPoly,
  solveLinearSystemAxEqualsB,
  formatMatrixAsLatex,
  evaluate3DSurfaceZ,
  compute3DVectorOperations,
  computePolygonGeometryMetrics,
  computeRayOpticsBench,
  computeFreeBodyForceEquilibrium,
  decimalToExactFraction,
  evaluateMathWithParams,
  type PointOfInterest,
  type GeometryVertex,
} from '../utils/desmosStudyToolsEngine';
import {
  convertStudyUnit,
  calculateDatasetStatistics,
} from '../utils/learnmate2Engine';
import { studyStorage } from '../services/storageService';
import { MathText } from './MathText';

export type StudyToolSubTab = 'graph2d' | 'matrix' | 'surface3d' | 'geometry' | 'scientific';

interface StudyToolsWorkspaceViewProps {
  initialTool?: StudyToolSubTab;
  initialPlotExpression?: string | null;
  initialPlotLabel?: string | null;
  onConsumeInitialPlot?: () => void;
  onAskAiTutor?: (questionPrompt: string) => void;
  onOpenReviseHandwritten?: () => void;
}

interface GraphCurveItem {
  id: string;
  expression: string;
  color: string;
  visible: boolean;
  label?: string;
}

const CURVE_PALETTE = ['#4F46E5', '#0D9488', '#D97706', '#E11D48', '#7C3AED', '#0284C7'];

const GRAPH_PRESETS: Array<{ label: string; exprs: string[] }> = [
  { label: 'Parabola & Line Intersection', exprs: ['y = x^2 - 4', 'y = 2*x - 1'] },
  { label: 'Damped SHM Wave (Sliders a, b)', exprs: ['y = a * exp(-0.2*x) * cos(b*x) {0 <= x <= 10}'] },
  { label: 'Polar 3-Petal Rose', exprs: ['r = 4 * cos(3 * theta)'] },
  { label: 'Lissajous Parametric Curve', exprs: ['(4*sin(2*t), 4*cos(3*t))'] },
  { label: 'Linear Programming Inequality', exprs: ['y <= -0.8*x + 4', 'y >= 0.5*x - 2'] },
];

export const StudyToolsWorkspaceView: React.FC<StudyToolsWorkspaceViewProps> = ({
  initialTool = 'graph2d',
  initialPlotExpression,
  initialPlotLabel,
  onConsumeInitialPlot,
  onAskAiTutor,
  onOpenReviseHandwritten,
}) => {
  const [activeTool, setActiveTool] = useState<StudyToolSubTab>(initialTool);
  const [snapToastMessage, setSnapToastMessage] = useState<string | null>(null);
  const [shareCopiedUrl, setShareCopiedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (initialTool) {
      setActiveTool(initialTool);
    }
  }, [initialTool]);

  /* ============================================================================
   * 1. DESMOS 2D GRAPHING CALCULATOR STATE
   * ============================================================================ */
  const [curves, setCurves] = useState<GraphCurveItem[]>([
    { id: 'c-1', expression: 'y = x^2 - 4', color: CURVE_PALETTE[0], visible: true },
    { id: 'c-2', expression: 'y = 2*x - 1', color: CURVE_PALETTE[1], visible: true },
  ]);
  const [newCurveInput, setNewCurveInput] = useState('y = a * sin(b * x)');
  const [viewport, setViewport] = useState({ xMin: -10, xMax: 10, yMin: -8, yMax: 8 });
  const [sliderValues, setSliderValues] = useState<Record<string, number>>({
    a: 2,
    b: 1,
    c: 0,
    k: 1,
  });
  const [animatingParams, setAnimatingParams] = useState<Record<string, boolean>>({});
  const [selectedPoi, setSelectedPoi] = useState<PointOfInterest | null>(null);

  // Calculus Derivative & Definite Integral State
  const [calculusEnabled, setCalculusEnabled] = useState(true);
  const [calculusCurveId, setCalculusCurveId] = useState('c-1');
  const [tangentX, setTangentX] = useState<number>(2);
  const [integralLower, setIntegralLower] = useState<number>(-2);
  const [integralUpper, setIntegralUpper] = useState<number>(2);

  // Handle incoming formula plot from Formula Book
  useEffect(() => {
    if (initialPlotExpression) {
      setActiveTool('graph2d');
      const newId = `c-plot-${Date.now()}`;
      setCurves((prev) => [
        {
          id: newId,
          expression: initialPlotExpression,
          color: CURVE_PALETTE[0],
          visible: true,
          label: initialPlotLabel || 'From Formula Book',
        },
        ...prev.slice(0, 4),
      ]);
      setCalculusCurveId(newId);
      onConsumeInitialPlot?.();
    }
  }, [initialPlotExpression, initialPlotLabel, onConsumeInitialPlot]);

  // Detect all free parameters across expressions
  const detectedParams = useMemo(() => {
    return detectFreeParameters(curves.map((c) => c.expression));
  }, [curves]);

  // Animate active parameter sliders
  useEffect(() => {
    const activeKeys = Object.keys(animatingParams).filter((k) => animatingParams[k]);
    if (activeKeys.length === 0) return;

    const timer = window.setInterval(() => {
      setSliderValues((prev) => {
        const next = { ...prev };
        for (const key of activeKeys) {
          const cur = prev[key] ?? 1;
          let updated = cur + 0.15;
          if (updated > 5) updated = -5;
          next[key] = Number(updated.toFixed(2));
        }
        return next;
      });
    }, 80);

    return () => window.clearInterval(timer);
  }, [animatingParams]);

  // Sample 2D curves
  const sampledCurves = useMemo(() => {
    return curves.map((curve) => ({
      curve,
      sampled: sampleDesmosCurve({
        id: curve.id,
        rawExpression: curve.expression,
        xMin: viewport.xMin,
        xMax: viewport.xMax,
        yMin: viewport.yMin,
        yMax: viewport.yMax,
        sliderValues,
        samples: 420,
      }),
    }));
  }, [curves, viewport, sliderValues]);

  // Compute Points of Interest (Roots, Extrema, Y-intercepts, Intersections)
  const pointsOfInterest = useMemo(() => {
    return computePointsOfInterest({
      curves: curves.map((c) => ({
        id: c.id,
        rawExpression: c.expression,
        visible: c.visible,
      })),
      xMin: viewport.xMin,
      xMax: viewport.xMax,
      yMin: viewport.yMin,
      yMax: viewport.yMax,
      sliderValues,
    });
  }, [curves, viewport, sliderValues]);

  // Compute Calculus Analysis (Tangent & Definite Integral Shading)
  const activeCalculusCurve = useMemo(() => {
    return curves.find((c) => c.id === calculusCurveId) || curves[0];
  }, [curves, calculusCurveId]);

  const calculusResult = useMemo(() => {
    if (!calculusEnabled || !activeCalculusCurve) return null;
    return computeCalculusAnalysis({
      rawExpression: activeCalculusCurve.expression,
      sliderValues,
      tangentX,
      integralLower,
      integralUpper,
    });
  }, [calculusEnabled, activeCalculusCurve, sliderValues, tangentX, integralLower, integralUpper]);

  // Pan & Zoom handlers on the 2D Graph SVG
  const graphSvgRef = useRef<SVGSVGElement | null>(null);
  const dragStateRef = useRef<{
    dragging: boolean;
    startClientX: number;
    startClientY: number;
    startViewport: typeof viewport;
  } | null>(null);

  const svgW = 860;
  const svgH = 520;
  const pad = 42;
  const plotW = svgW - pad * 2;
  const plotH = svgH - pad * 2;

  const mapX = (x: number) =>
    pad + ((x - viewport.xMin) / Math.max(1e-6, viewport.xMax - viewport.xMin)) * plotW;
  const mapY = (y: number) =>
    pad + plotH - ((y - viewport.yMin) / Math.max(1e-6, viewport.yMax - viewport.yMin)) * plotH;

  const handleGraphMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    dragStateRef.current = {
      dragging: true,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startViewport: { ...viewport },
    };
  };

  const handleGraphMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragStateRef.current?.dragging || !graphSvgRef.current) return;
    const rect = graphSvgRef.current.getBoundingClientRect();
    const dxPx = e.clientX - dragStateRef.current.startClientX;
    const dyPx = e.clientY - dragStateRef.current.startClientY;
    const { xMin, xMax, yMin, yMax } = dragStateRef.current.startViewport;
    const xSpan = xMax - xMin;
    const ySpan = yMax - yMin;
    const dxUnits = (dxPx / Math.max(1, rect.width)) * xSpan;
    const dyUnits = (dyPx / Math.max(1, rect.height)) * ySpan;

    setViewport({
      xMin: Number((xMin - dxUnits).toFixed(3)),
      xMax: Number((xMax - dxUnits).toFixed(3)),
      yMin: Number((yMin + dyUnits).toFixed(3)),
      yMax: Number((yMax + dyUnits).toFixed(3)),
    });
  };

  const handleGraphMouseUp = () => {
    dragStateRef.current = null;
  };

  const handleGraphWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.15 : 0.86;
    handleZoom2D(factor);
  };

  const handleZoom2D = (factor: number) => {
    setViewport((prev) => {
      const cx = (prev.xMin + prev.xMax) / 2;
      const cy = (prev.yMin + prev.yMax) / 2;
      const halfW = Math.max(0.5, ((prev.xMax - prev.xMin) / 2) * factor);
      const halfH = Math.max(0.5, ((prev.yMax - prev.yMin) / 2) * factor);
      return {
        xMin: Number((cx - halfW).toFixed(2)),
        xMax: Number((cx + halfW).toFixed(2)),
        yMin: Number((cy - halfH).toFixed(2)),
        yMax: Number((cy + halfH).toFixed(2)),
      };
    });
  };

  /* ============================================================================
   * 2. MATRIX & LINEAR ALGEBRA CALCULATOR STATE
   * ============================================================================ */
  const [matrixDim, setMatrixDim] = useState<2 | 3>(3);
  const [matrixA, setMatrixA] = useState<number[][]>([
    [2, 1, -1],
    [-3, -1, 2],
    [-2, 1, 2],
  ]);
  const [matrixB, setMatrixB] = useState<number[][]>([
    [1, 0, 2],
    [0, 3, -1],
    [2, 1, 1],
  ]);
  const [vectorB, setVectorB] = useState<number[]>([8, -11, -3]);
  const [selectedMatrixOp, setSelectedMatrixOp] = useState<
    'det_inv' | 'rref' | 'multiply' | 'add' | 'eigen' | 'solve_axb'
  >('det_inv');

  const handleChangeMatrixDim = (dim: 2 | 3) => {
    setMatrixDim(dim);
    if (dim === 2) {
      setMatrixA([
        [4, 1],
        [2, 3],
      ]);
      setMatrixB([
        [1, 2],
        [0, 1],
      ]);
      setVectorB([9, 8]);
    } else {
      setMatrixA([
        [2, 1, -1],
        [-3, -1, 2],
        [-2, 1, 2],
      ]);
      setMatrixB([
        [1, 0, 2],
        [0, 3, -1],
        [2, 1, 1],
      ]);
      setVectorB([8, -11, -3]);
    }
  };

  const matrixAnalysis = useMemo(() => {
    const detA = computeMatrixDeterminant(matrixA);
    const invA = computeMatrixInverse(matrixA);
    const transA = computeMatrixTranspose(matrixA);
    const traceA = computeMatrixTrace(matrixA);
    const rrefA = computeMatrixRREF(matrixA);
    const prodAB = multiplyMatrices(matrixA, matrixB);
    const sumAB = addMatrices(matrixA, matrixB, 1);
    const eigA = computeEigenvaluesAndCharPoly(matrixA);
    const sysAxB = solveLinearSystemAxEqualsB(matrixA, vectorB);

    return {
      detA,
      invA,
      transA,
      traceA,
      rrefA,
      prodAB,
      sumAB,
      eigA,
      sysAxB,
    };
  }, [matrixA, matrixB, vectorB]);

  /* ============================================================================
   * 3. 3D SURFACE & VECTOR SPACE CALCULATOR STATE (THREE.JS)
   * ============================================================================ */
  const [surface3dExpr, setSurface3dExpr] = useState('z = sin(sqrt(x^2 + y^2)) * 2');
  const [vecA, setVecA] = useState<[number, number, number]>([3, 2, 1]);
  const [vecB, setVecB] = useState<[number, number, number]>([-1, 3, 2]);
  const [sliceAxis, setSliceAxis] = useState<'none' | 'x' | 'y' | 'z'>('none');
  const [sliceValue, setSliceValue] = useState<number>(0);
  const [dockCollapsed3D, setDockCollapsed3D] = useState(false);

  const vector3dOps = useMemo(() => compute3DVectorOperations(vecA, vecB), [vecA, vecB]);

  const canvas3dMountRef = useRef<HTMLDivElement | null>(null);
  const threeRequestRenderRef = useRef<(() => void) | null>(null);
  const surfaceStateRef = useRef({
    surface3dExpr,
    vecA,
    vecB,
    sliceAxis,
    sliceValue,
    sliderValues,
  });

  useEffect(() => {
    surfaceStateRef.current = {
      surface3dExpr,
      vecA,
      vecB,
      sliceAxis,
      sliceValue,
      sliderValues,
    };
    threeRequestRenderRef.current?.();
  }, [surface3dExpr, vecA, vecB, sliceAxis, sliceValue, sliderValues]);

  useEffect(() => {
    if (activeTool !== 'surface3d' || !canvas3dMountRef.current) return;
    const container = canvas3dMountRef.current;

    const isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = Math.max(320, container.clientWidth || 800);
    const height = Math.max(380, container.clientHeight || 520);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1120);
    scene.fog = new THREE.FogExp2(0x0b1120, 0.025);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200);
    let camTheta = 0.75;
    let camPhi = 1.05;
    let camRadius = 15;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.localClippingEnabled = true;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.9);
    scene.add(hemiLight);
    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.4);
    keyLight.position.set(12, 18, 10);
    scene.add(keyLight);

    // Coordinate Grid & Axes Group
    const gridHelper = new THREE.GridHelper(12, 12, 0x4f46e5, 0x1e293b);
    gridHelper.position.y = -0.02;
    scene.add(gridHelper);
    const axesHelper = new THREE.AxesHelper(6.5);
    scene.add(axesHelper);

    // Dynamic Surface Mesh Group
    const dynamicGroup = new THREE.Group();
    scene.add(dynamicGroup);

    const rebuildSceneGeometry = () => {
      while (dynamicGroup.children.length > 0) {
        const child = dynamicGroup.children[0] as THREE.Mesh;
        if (child.geometry) child.geometry.dispose();
        dynamicGroup.remove(child);
      }

      const st = surfaceStateRef.current;
      const segs = isSoftwareGl ? 36 : 56;
      const span = 5;
      const positions = new Float32Array((segs + 1) * (segs + 1) * 3);
      const colors = new Float32Array((segs + 1) * (segs + 1) * 3);
      const indices: number[] = [];
      const tmpColor = new THREE.Color();

      let ptr = 0;
      for (let iy = 0; iy <= segs; iy++) {
        const mathY = -span + (iy / segs) * (span * 2);
        for (let ix = 0; ix <= segs; ix++) {
          const mathX = -span + (ix / segs) * (span * 2);
          const rawZ = evaluate3DSurfaceZ(st.surface3dExpr, mathX, mathY, st.sliderValues);
          const clampedZ = Number.isFinite(rawZ) ? Math.max(-6, Math.min(6, rawZ)) : 0;

          // Map math (x, y, z) to Three.js (x, z_up, y)
          positions[ptr * 3] = mathX;
          positions[ptr * 3 + 1] = clampedZ;
          positions[ptr * 3 + 2] = mathY;

          const t = (clampedZ + 4) / 8;
          tmpColor.setHSL(0.62 - Math.max(0, Math.min(1, t)) * 0.45, 0.82, 0.54);
          colors[ptr * 3] = tmpColor.r;
          colors[ptr * 3 + 1] = tmpColor.g;
          colors[ptr * 3 + 2] = tmpColor.b;
          ptr++;
        }
      }

      for (let iy = 0; iy < segs; iy++) {
        for (let ix = 0; ix < segs; ix++) {
          const a = iy * (segs + 1) + ix;
          const b = iy * (segs + 1) + (ix + 1);
          const c = (iy + 1) * (segs + 1) + ix;
          const d = (iy + 1) * (segs + 1) + (ix + 1);
          indices.push(a, b, d, a, d, c);
        }
      }

      const surfGeo = new THREE.BufferGeometry();
      surfGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      surfGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      surfGeo.setIndex(indices);
      surfGeo.computeVertexNormals();

      const clipPlanes: THREE.Plane[] = [];
      if (st.sliceAxis === 'x') {
        clipPlanes.push(new THREE.Plane(new THREE.Vector3(-1, 0, 0), st.sliceValue));
      } else if (st.sliceAxis === 'y') {
        clipPlanes.push(new THREE.Plane(new THREE.Vector3(0, 0, -1), st.sliceValue));
      } else if (st.sliceAxis === 'z') {
        clipPlanes.push(new THREE.Plane(new THREE.Vector3(0, -1, 0), st.sliceValue));
      }

      const surfMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        roughness: 0.35,
        metalness: 0.15,
        clippingPlanes: clipPlanes,
      });
      const surfMesh = new THREE.Mesh(surfGeo, surfMat);
      dynamicGroup.add(surfMesh);

      // Slice indicator plane
      if (st.sliceAxis !== 'none') {
        const planeGeo = new THREE.PlaneGeometry(10, 10);
        const planeMat = new THREE.MeshBasicMaterial({
          color: 0xf59e0b,
          transparent: true,
          opacity: 0.22,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const sliceMesh = new THREE.Mesh(planeGeo, planeMat);
        if (st.sliceAxis === 'x') {
          sliceMesh.rotation.y = Math.PI / 2;
          sliceMesh.position.x = st.sliceValue;
        } else if (st.sliceAxis === 'y') {
          sliceMesh.position.z = st.sliceValue;
        } else if (st.sliceAxis === 'z') {
          sliceMesh.rotation.x = Math.PI / 2;
          sliceMesh.position.y = st.sliceValue;
        }
        dynamicGroup.add(sliceMesh);
      }

      // 3D Vector Arrows for vecA, vecB, and vecA x vecB
      const addVectorArrow = (vec: [number, number, number], hexColor: number) => {
        const dir = new THREE.Vector3(vec[0], vec[2], vec[1]);
        const len = dir.length();
        if (len < 1e-4) return;
        dir.normalize();
        const arrow = new THREE.ArrowHelper(
          dir,
          new THREE.Vector3(0, 0, 0),
          Math.min(6, len),
          hexColor,
          0.45,
          0.25
        );
        dynamicGroup.add(arrow);
      };

      const ops = compute3DVectorOperations(st.vecA, st.vecB);
      addVectorArrow(st.vecA, 0x38bdf8); // Cyan: Vector A
      addVectorArrow(st.vecB, 0x34d399); // Emerald: Vector B
      addVectorArrow(ops.crossProduct, 0xf43f5e); // Rose: Cross Product A x B
    };

    const updateCameraPosition = () => {
      camera.position.x = camRadius * Math.sin(camPhi) * Math.cos(camTheta);
      camera.position.y = camRadius * Math.cos(camPhi);
      camera.position.z = camRadius * Math.sin(camPhi) * Math.sin(camTheta);
      camera.lookAt(0, 0, 0);
    };
    updateCameraPosition();

    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const poll = () => {
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const requestRender = () => {
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        renderDirty = false;
        rebuildSceneGeometry();
        updateCameraPosition();
        renderer.render(scene, camera);
        const done = () => {
          renderBusy = false;
          if (renderDirty) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    };

    threeRequestRenderRef.current = requestRender;
    requestRender();

    // Pointer drag orbit + wheel zoom on canvas
    let isPointerDown = false;
    let lastX = 0;
    let lastY = 0;

    const onPointerDown = (e: PointerEvent) => {
      isPointerDown = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isPointerDown) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      camTheta -= dx * 0.01;
      camPhi = Math.max(0.2, Math.min(Math.PI - 0.2, camPhi - dy * 0.01));
      requestRender();
    };
    const onPointerUp = () => {
      isPointerDown = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camRadius = Math.max(5, Math.min(32, camRadius + (e.deltaY > 0 ? 1.2 : -1.2)));
      requestRender();
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    domElem.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      domElem.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      domElem.removeEventListener('wheel', onWheel);
      renderer.dispose();
    };
  }, [activeTool]);

  /* ============================================================================
   * 4. INTERACTIVE GEOMETRY, RAY OPTICS & FORCE VECTOR SANDBOX STATE
   * ============================================================================ */
  const [sandboxMode, setSandboxMode] = useState<'geometry' | 'optics' | 'forces'>('geometry');
  const [vertices, setVertices] = useState<GeometryVertex[]>([
    { id: 'vA', label: 'A', x: -4, y: -2 },
    { id: 'vB', label: 'B', x: 4, y: -2 },
    { id: 'vC', label: 'C', x: 1, y: 4 },
  ]);
  const [draggingVertexId, setDraggingVertexId] = useState<string | null>(null);
  const geoSvgRef = useRef<SVGSVGElement | null>(null);

  const polygonMetrics = useMemo(() => computePolygonGeometryMetrics(vertices), [vertices]);

  // Ray Optics Bench State
  const [opticsElement, setOpticsElement] = useState<'convex_lens' | 'concave_lens' | 'concave_mirror'>('convex_lens');
  const [focalLengthAbs, setFocalLengthAbs] = useState<number>(20);
  const [objectDistanceAbs, setObjectDistanceAbs] = useState<number>(35);
  const [objectHeight, setObjectHeight] = useState<number>(4);

  const opticsResult = useMemo(
    () =>
      computeRayOpticsBench({
        element: opticsElement,
        focalLengthAbs,
        objectDistanceAbs,
        objectHeight,
      }),
    [opticsElement, focalLengthAbs, objectDistanceAbs, objectHeight]
  );

  // Free-Body Force Diagram State
  const [forces, setForces] = useState([
    { id: 'f1', label: 'Tension T₁', magnitudeN: 40, angleDeg: 35 },
    { id: 'f2', label: 'Tension T₂', magnitudeN: 30, angleDeg: 145 },
    { id: 'f3', label: 'Weight mg', magnitudeN: 45, angleDeg: 270 },
  ]);
  const [blockMassKg, setBlockMassKg] = useState<number>(5);

  const forceResult = useMemo(
    () => computeFreeBodyForceEquilibrium(forces, blockMassKg),
    [forces, blockMassKg]
  );

  /* ============================================================================
   * 5. SCIENTIFIC CALCULATOR (ANS, EXACT FRACTIONS, COMBINATORICS, CONVERTER, STATS)
   * ============================================================================ */
  const [sciExpr, setSciExpr] = useState('ncr(10, 3) / 160 + sin(pi / 6)');
  const [lastAns, setLastAns] = useState<number>(0);
  const [showExactFraction, setShowExactFraction] = useState(true);
  const [sciHistory, setSciHistory] = useState<
    Array<{ expr: string; decimal: string; fraction: string }>
  >([]);

  const sciEvalValue = useMemo(() => {
    return evaluateMathWithParams(sciExpr, { ans: lastAns });
  }, [sciExpr, lastAns]);

  const sciFraction = useMemo(() => {
    return decimalToExactFraction(sciEvalValue);
  }, [sciEvalValue]);

  const [unitVal, setUnitVal] = useState('100');
  const [fromUnit, setFromUnit] = useState('km/h');
  const [toUnit, setToUnit] = useState('m/s');
  const unitResult = useMemo(
    () => convertStudyUnit(Number(unitVal), fromUnit, toUnit),
    [unitVal, fromUnit, toUnit]
  );

  const [statsInput, setStatsInput] = useState('12, 15, 18, 22, 25, 30, 34');
  const statsSummary = useMemo(() => {
    const nums = statsInput
      .split(/[\s,]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
    return calculateDatasetStatistics(nums);
  }, [statsInput]);

  /* ============================================================================
   * CROSS-APP ACTIONS: SNAP TO NOTES, ASK AI TUTOR, SHARE LINK, EXPORT SVG/PNG
   * ============================================================================ */

  const handleSnapToNotes = () => {
    const nowIso = new Date().toISOString();
    let title = 'Desmos 2D Graph Snapshot';
    let markdownBody = '';

    if (activeTool === 'graph2d') {
      const exprList = curves
        .filter((c) => c.visible)
        .map((c) => `- $${c.expression}$`)
        .join('\n');
      const poiList = pointsOfInterest
        .slice(0, 6)
        .map((p) => `- **${p.label}**`)
        .join('\n');
      title = `2D Graph Analysis: ${curves[0]?.expression || 'Curve'}`;
      markdownBody = `### Plotted Equations\n${exprList}\n\n### Points of Interest (Roots, Extrema & Intersections)\n${
        poiList || '- None in active viewport'
      }\n\n${
        calculusResult
          ? `### Calculus Analysis\n- Tangent at $x = ${calculusResult.tangentX}$: $${calculusResult.tangentEquationLatex}$\n- Definite Integral $\\int_{${calculusResult.integralLower}}^{${calculusResult.integralUpper}} f(x)\\,dx = ${calculusResult.definiteIntegralArea}$`
          : ''
      }`;
    } else if (activeTool === 'matrix') {
      title = `Matrix Linear Algebra (${matrixDim}×${matrixDim})`;
      markdownBody = `### Matrix A\n$$A = ${formatMatrixAsLatex(matrixA)}$$\n\n- **Determinant**: $\\det(A) = ${
        matrixAnalysis.detA ?? 0
      }$\n- **Trace**: $\\text{tr}(A) = ${matrixAnalysis.traceA ?? 0}$\n- **Rank**: $\\text{rank}(A) = ${
        matrixAnalysis.rrefA.rank
      }$\n${
        matrixAnalysis.eigA
          ? `- **Characteristic Polynomial**: $${matrixAnalysis.eigA.characteristicPolynomialLatex}$\n- **Eigenvalues**: $${matrixAnalysis.eigA.eigenvalues.join(', ')}$`
          : ''
      }\n- **Linear System $Ax = b$**: $${matrixAnalysis.sysAxB.latexSummary}$`;
    } else if (activeTool === 'surface3d') {
      title = `3D Surface & Vector Space: ${surface3dExpr}`;
      markdownBody = `### 3D Surface\n$$${surface3dExpr}$$\n\n### 3D Vector Operations\n- $\\vec{a} = (${vecA.join(
        ', '
      )})$, $\\vec{b} = (${vecB.join(', ')})$\n- **Dot Product**: $\\vec{a} \\cdot \\vec{b} = ${
        vector3dOps.dotProduct
      }$\n- **Cross Product**: $\\vec{a} \\times \\vec{b} = (${vector3dOps.crossProduct.join(
        ', '
      )})$\n- **Angle**: $\\theta = ${vector3dOps.angleDegrees}^\\circ$\n- **Parallelogram Area**: $|\\vec{a} \\times \\vec{b}| = ${
        vector3dOps.areaOfParallelogram
      }$`;
    } else if (activeTool === 'geometry') {
      title =
        sandboxMode === 'optics'
          ? `Ray Optics Analysis (${opticsElement.replace('_', ' ')})`
          : sandboxMode === 'forces'
          ? 'Free-Body Force Equilibrium Analysis'
          : 'Polygon Geometry Construction';
      markdownBody =
        sandboxMode === 'optics'
          ? `### Ray Optics Bench\n- Formula: $${opticsResult.formulaLatex}$\n- Object Distance $u = ${opticsResult.u}\\,\\text{cm}$, Focal Length $f = ${opticsResult.f}\\,\\text{cm}$\n- **Image Distance**: $v = ${opticsResult.v}\\,\\text{cm}$\n- **Magnification**: $m = ${opticsResult.magnification}$\n- **Nature**: **${opticsResult.nature}**`
          : sandboxMode === 'forces'
          ? `### Free-Body Force Resolution\n- $\\sum F_x = ${forceResult.sumFx}\\,\\text{N}$, $\\sum F_y = ${forceResult.sumFy}\\,\\text{N}$\n- **Resultant Force**: $|\\vec{F}_{\\text{net}}| = ${forceResult.netForceN}\\,\\text{N}$ at $${forceResult.netAngleDeg}^\\circ$\n- **Acceleration**: $a = ${forceResult.accelerationMs2}\\,\\text{m/s}^2$`
          : `### Euclidean Polygon Metrics\n- **Perimeter**: $${polygonMetrics.perimeter}$ units\n- **Enclosed Area**: $${polygonMetrics.area}$ sq. units\n- **Centroid**: $(${polygonMetrics.centroid.x}, ${polygonMetrics.centroid.y})$`;
    } else {
      title = `Scientific Calculation: ${sciExpr}`;
      markdownBody = `### Expression\n$$${sciExpr} = ${sciFraction.latex} \\approx ${
        Number.isFinite(sciEvalValue) ? Number(sciEvalValue.toFixed(6)) : 'NaN'
      }$$`;
    }

    studyStorage.saveNotebookEntry({
      id: `nb-graph-${Date.now()}`,
      title,
      type: 'manual_note',
      cleanContent: markdownBody,
      handwrittenContent: markdownBody,
      uncertainSegments: [],
      summary: `Snapped from Desmos Study Tools Lab (${activeTool})`,
      keyConcepts: ['Study Tools', activeTool],
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    const primaryFormulaLatex =
      activeTool === 'graph2d'
        ? curves[0]?.expression || 'y = x^2'
        : activeTool === 'matrix'
        ? `\\det(A) = ${matrixAnalysis.detA ?? 0}`
        : activeTool === 'surface3d'
        ? surface3dExpr
        : opticsResult.formulaLatex;

    studyStorage.saveHandwrittenNote({
      id: `hw-graph-${Date.now()}`,
      documentId: 'study-tools-lab',
      documentTitle: 'Desmos Study Tools Lab',
      title,
      workflowSource: 'study_material',
      notebookStyle: 'grid',
      density: 'concise',
      inkColor: 'indigo_ink',
      subject: 'Mathematics',
      selectedPageNumbers: [1],
      pages: [
        {
          pageNumber: 1,
          pageTitle: title,
          sections: [
            {
              id: `sec-${Date.now()}`,
              heading: title,
              sourceLabel: 'Study Tools Lab',
              sourcePage: 1,
              bulletPoints: markdownBody
                .split('\n')
                .map((l) => l.replace(/^[-*#]+\s*/, '').trim())
                .filter((l) => l.length > 0),
              highlightedTerms: [activeTool],
              formulas: [
                {
                  label: 'Primary Expression',
                  latex: primaryFormulaLatex,
                },
              ],
              marginCallout: 'Snapped from Desmos Study Tools Lab',
            },
          ],
        },
      ],
      keyFormulasCount: 1,
      diagramsCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    setSnapToastMessage(`Saved "${title}" to your Handwritten & Sticky Notes!`);
    setTimeout(() => setSnapToastMessage(null), 4000);
  };

  const handleAskTutorCurrentTool = () => {
    if (!onAskAiTutor) return;
    if (activeTool === 'graph2d') {
      const exprs = curves
        .filter((c) => c.visible)
        .map((c) => c.expression)
        .join(', ');
      const pois = pointsOfInterest
        .slice(0, 5)
        .map((p) => p.label)
        .join('; ');
      onAskAiTutor(
        `Please explain the mathematical behavior of the plotted graph(s) ${exprs}. Its key points of interest are: ${
          pois || 'none in range'
        }. ${
          calculusResult
            ? `Also explain why the definite integral from x = ${calculusResult.integralLower} to ${calculusResult.integralUpper} equals ${calculusResult.definiteIntegralArea} and tangent slope at x = ${calculusResult.tangentX} is ${calculusResult.derivativeSlope}.`
            : ''
        }`
      );
    } else if (activeTool === 'matrix') {
      onAskAiTutor(
        `Please explain step-by-step how to find the determinant (${matrixAnalysis.detA}), inverse, RREF, and eigenvalues of the matrix A = ${JSON.stringify(
          matrixA
        )}, and solve A*x = ${JSON.stringify(vectorB)} for JEE / engineering entrance exams.`
      );
    } else if (activeTool === 'surface3d') {
      onAskAiTutor(
        `Please explain the 3D surface ${surface3dExpr} and the geometric meaning of the 3D vectors a = (${vecA.join(
          ', '
        )}) and b = (${vecB.join(', ')}) with dot product ${vector3dOps.dotProduct} and cross product (${vector3dOps.crossProduct.join(
          ', '
        )}).`
      );
    } else if (activeTool === 'geometry') {
      onAskAiTutor(
        sandboxMode === 'optics'
          ? `Explain the ray diagram and sign convention for a ${opticsElement.replace(
              '_',
              ' '
            )} with u = ${opticsResult.u} cm and f = ${opticsResult.f} cm, producing v = ${opticsResult.v} cm (${opticsResult.nature}).`
          : `Explain how to resolve the free-body forces into sum Fx = ${forceResult.sumFx} N and sum Fy = ${forceResult.sumFy} N to find net acceleration ${forceResult.accelerationMs2} m/s^2.`
      );
    } else {
      onAskAiTutor(
        `Explain the mathematical evaluation of ${sciExpr} = ${sciFraction.display} (${sciEvalValue}).`
      );
    }
  };

  const handleShareCurrentTool = async () => {
    try {
      const response = await fetch('/api/share/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'desmos_graph',
          title: `LearnMate ${activeTool.toUpperCase()} Workspace`,
          subtitle: 'Interactive Desmos-grade Study Tools snapshot',
          payload: {
            activeTool,
            curves,
            viewport,
            sliderValues,
            matrixA,
            surface3dExpr,
          },
        }),
      });
      const data = await response.json();
      if (data.shareUrl && typeof window !== 'undefined') {
        const fullUrl = `${window.location.origin}${data.shareUrl}`;
        await navigator.clipboard?.writeText(fullUrl).catch(() => {});
        setShareCopiedUrl(fullUrl);
        setTimeout(() => setShareCopiedUrl(null), 4000);
      }
    } catch {
      // ignore offline
    }
  };

  const handleExportSvgOrPng = (format: 'svg' | 'png') => {
    const svgEl = activeTool === 'geometry' ? geoSvgRef.current : graphSvgRef.current;
    if (!svgEl) return;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgEl);

    if (format === 'svg') {
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LearnMate_${activeTool}_Plot.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }

    // High-res PNG export via offscreen canvas
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1720;
      canvas.height = 1040;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pngUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = `LearnMate_${activeTool}_HighRes.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const zeroX = Math.min(svgW - pad, Math.max(pad, mapX(0)));
  const zeroY = Math.min(svgH - pad, Math.max(pad, mapY(0)));

  return (
    <div
      data-testid="study-tools-workspace-view"
      className="space-y-6"
    >
      {/* Top Workspace Header & 5-Tool Switcher + Cross-App Integration Bar */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#111827] border border-line flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold text-ink">
            Desmos-Grade Mathematical &amp; Study Tools Lab
          </h1>
          <p className="text-sm text-muted">
            Interactive 2D Graphing, Matrix Linear Algebra, 3D Surface &amp; Vector Space, Geometry/Optics Sandbox, and Exact Scientific Calculator
          </p>
        </div>

        {/* Cross-App Integration Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleSnapToNotes}
            data-testid="study-tools-snap-to-notes-btn"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-brand text-white hover:opacity-95 text-xs font-semibold transition-opacity cursor-pointer whitespace-nowrap"
          >
            <FileSignature className="w-4 h-4" />
            <span>Snap to Handwritten &amp; Sticky Notes</span>
          </button>

          {onAskAiTutor && (
            <button
              type="button"
              onClick={handleAskTutorCurrentTool}
              data-testid="study-tools-ask-ai-tutor-btn"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-line bg-canvas hover:bg-soft text-ink text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4 text-brand" />
              <span>Ask AI Tutor to Explain</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleShareCurrentTool}
            data-testid="study-tools-share-link-btn"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-line bg-canvas hover:bg-soft text-ink text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            {shareCopiedUrl ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Share Link Copied</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 text-brand" />
                <span>Share Read-Only Link</span>
              </>
            )}
          </button>

          {(activeTool === 'graph2d' || activeTool === 'geometry') && (
            <div className="inline-flex items-center rounded-xl border border-line bg-canvas p-0.5">
              <button
                type="button"
                onClick={() => handleExportSvgOrPng('png')}
                data-testid="export-graph-png-btn"
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-ink hover:bg-white dark:hover:bg-[#1E293B] transition-colors cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 inline mr-1 text-brand" />
                PNG
              </button>
              <button
                type="button"
                onClick={() => handleExportSvgOrPng('svg')}
                data-testid="export-graph-svg-btn"
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-ink hover:bg-white dark:hover:bg-[#1E293B] transition-colors cursor-pointer whitespace-nowrap"
              >
                SVG
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Toast when Snapped to Notes */}
      {snapToastMessage && (
        <div
          role="status"
          data-testid="snap-to-notes-toast"
          className="px-5 py-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-4 text-xs font-semibold text-emerald-900 dark:text-emerald-200"
        >
          <span>{snapToastMessage}</span>
          {onOpenReviseHandwritten && (
            <button
              type="button"
              onClick={onOpenReviseHandwritten}
              className="px-3 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer whitespace-nowrap"
            >
              Open Handwritten Notes
            </button>
          )}
        </div>
      )}

      {/* 5-Tool Segmented Selector */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-white dark:bg-[#111827] border border-line">
        {(
          [
            { id: 'graph2d', label: '2D Graphing Calculator', icon: LineChart },
            { id: 'matrix', label: 'Matrix Calculator', icon: Grid },
            { id: 'surface3d', label: '3D Surface & Vectors', icon: Box },
            { id: 'geometry', label: 'Geometry, Optics & Forces', icon: Compass },
            { id: 'scientific', label: 'Scientific, Units & Stats', icon: Calculator },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTool === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTool(tab.id)}
              data-testid={`study-tool-tab-${tab.id}`}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-brand text-white shadow-xs'
                  : 'text-muted hover:text-ink hover:bg-soft'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* =====================================================================
          TOOL 1: DESMOS 2D GRAPHING CALCULATOR
         ===================================================================== */}
      {activeTool === 'graph2d' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 4-Col Expression, Sliders, Calculus & POI Deck */}
          <div className="lg:col-span-4 space-y-4">
            {/* Expressions List Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-line space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-bold text-ink">
                  Equations, Polar, Parametric &amp; Inequalities
                </h2>
                <span className="text-xs text-muted">Domain: {'{0 <= x <= 5}'}</span>
              </div>

              {/* Add New Curve Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const trimmed = newCurveInput.trim();
                  if (!trimmed) return;
                  const nextColor = CURVE_PALETTE[curves.length % CURVE_PALETTE.length];
                  setCurves((prev) => [
                    ...prev,
                    { id: `c-${Date.now()}`, expression: trimmed, color: nextColor, visible: true },
                  ]);
                  setNewCurveInput('');
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={newCurveInput}
                  onChange={(e) => setNewCurveInput(e.target.value)}
                  placeholder="e.g. y = a*sin(b*x) {-3.14 <= x <= 3.14} or r = 2*theta"
                  data-testid="desmos-new-expression-input"
                  className="flex-1 px-3 py-2 rounded-xl bg-canvas border border-line text-xs font-mono text-ink focus:outline-none focus:border-brand"
                />
                <button
                  type="submit"
                  data-testid="desmos-add-expression-btn"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand text-white text-xs font-semibold cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </form>

              {/* Active Expression Rows */}
              <div className="space-y-2">
                {curves.map((c, idx) => (
                  <div
                    key={c.id}
                    className="p-2.5 rounded-xl border border-line bg-canvas flex items-center gap-2"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setCurves((prev) =>
                          prev.map((item) =>
                            item.id === c.id ? { ...item, visible: !item.visible } : item
                          )
                        )
                      }
                      aria-label={`Toggle curve ${idx + 1} visibility`}
                      className="p-1.5 rounded-lg hover:bg-soft cursor-pointer shrink-0"
                    >
                      {c.visible ? (
                        <Eye className="w-3.5 h-3.5" style={{ color: c.color }} />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5 text-muted" />
                      )}
                    </button>

                    <span
                      className="w-2.5 h-6 rounded-full shrink-0"
                      style={{ backgroundColor: c.color }}
                    />

                    <input
                      type="text"
                      value={c.expression}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCurves((prev) =>
                          prev.map((item) =>
                            item.id === c.id ? { ...item, expression: val } : item
                          )
                        );
                      }}
                      data-testid={`desmos-curve-input-${idx}`}
                      className="flex-1 bg-transparent text-xs font-mono text-ink focus:outline-none min-w-0"
                    />

                    {curves.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setCurves((prev) => prev.filter((item) => item.id !== c.id))
                        }
                        aria-label={`Delete curve ${idx + 1}`}
                        className="p-1.5 rounded-lg text-muted hover:text-danger cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Preset Templates */}
              <div className="pt-2 border-t border-line space-y-1.5">
                <div className="text-[11px] font-semibold text-muted">
                  Quick JEE &amp; STEM Graph Templates:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {GRAPH_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        const loaded = preset.exprs.map((ex, i) => ({
                          id: `preset-${Date.now()}-${i}`,
                          expression: ex,
                          color: CURVE_PALETTE[i % CURVE_PALETTE.length],
                          visible: true,
                        }));
                        setCurves(loaded);
                        setCalculusCurveId(loaded[0].id);
                      }}
                      className="px-2.5 py-1 rounded-lg border border-line bg-canvas hover:bg-soft text-[11px] font-medium text-ink cursor-pointer transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Dynamic Parameter Sliders (a, b, c, k) with Play Animation */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-line space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-ink">
                  Parameter Sliders ({detectedParams.length > 0 ? detectedParams.join(', ') : 'a, b'})
                </h3>
                <span className="text-xs text-muted">Animate parameters live</span>
              </div>

              {(detectedParams.length > 0 ? detectedParams : ['a', 'b']).map((param) => {
                const val = sliderValues[param] ?? 1;
                const isPlaying = Boolean(animatingParams[param]);
                return (
                  <div
                    key={param}
                    className="p-3 rounded-xl bg-canvas border border-line space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-ink tabular-nums">
                        {param} = {val}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setAnimatingParams((prev) => ({ ...prev, [param]: !prev[param] }))
                        }
                        data-testid={`slider-play-btn-${param}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-line bg-white dark:bg-[#1E293B] text-[11px] font-semibold text-ink cursor-pointer"
                      >
                        {isPlaying ? (
                          <>
                            <Pause className="w-3 h-3 text-amber-600" />
                            <span>Pause</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 text-brand" />
                            <span>Animate</span>
                          </>
                        )}
                      </button>
                    </div>
                    <input
                      type="range"
                      min={-5}
                      max={5}
                      step={0.1}
                      value={val}
                      aria-label={`Parameter ${param} slider`}
                      onChange={(e) =>
                        setSliderValues((prev) => ({
                          ...prev,
                          [param]: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                  </div>
                );
              })}
            </div>

            {/* Derivative Tangent & Definite Integral Area Shading Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-line space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-ink">
                  Calculus: Derivative &amp; Definite Integral ∫ₐᵇ f(x) dx
                </h3>
                <input
                  type="checkbox"
                  checked={calculusEnabled}
                  onChange={(e) => setCalculusEnabled(e.target.checked)}
                  aria-label="Enable Calculus Derivative and Integral Shading"
                  className="w-4 h-4 accent-indigo-600 cursor-pointer"
                />
              </div>

              {calculusEnabled && calculusResult && (
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-3 gap-2">
                    <label className="space-y-1">
                      <span className="text-muted block">Tangent x₀</span>
                      <input
                        type="number"
                        step="0.5"
                        value={tangentX}
                        onChange={(e) => setTangentX(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-canvas border border-line font-mono tabular-nums text-ink"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-muted block">Lower a</span>
                      <input
                        type="number"
                        step="0.5"
                        value={integralLower}
                        onChange={(e) => setIntegralLower(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-canvas border border-line font-mono tabular-nums text-ink"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-muted block">Upper b</span>
                      <input
                        type="number"
                        step="0.5"
                        value={integralUpper}
                        onChange={(e) => setIntegralUpper(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-canvas border border-line font-mono tabular-nums text-ink"
                      />
                    </label>
                  </div>

                  <div className="p-3 rounded-xl bg-canvas border border-line space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Slope f&apos;({tangentX}):</span>
                      <strong className="font-mono tabular-nums text-ink">
                        {calculusResult.derivativeSlope ?? 'Undefined'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Tangent Line:</span>
                      <span className="font-mono text-ink">
                        {calculusResult.tangentEquationLatex}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-line">
                      <span className="text-muted">
                        Signed Area ∫ₐᵇ f(x) dx:
                      </span>
                      <strong
                        data-testid="definite-integral-value"
                        className="font-mono tabular-nums text-brand text-sm"
                      >
                        {calculusResult.definiteIntegralArea}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right 8-Col Interactive 2D Pan/Zoom Graph Canvas & Points of Interest */}
          <div className="lg:col-span-8 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-line space-y-3">
              {/* Canvas Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-muted">
                  Drag canvas to pan · Scroll wheel to zoom · Click any dot to inspect root, extremum, or intersection
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleZoom2D(0.8)}
                    aria-label="Zoom In"
                    className="p-2 rounded-xl border border-line bg-canvas hover:bg-soft text-ink cursor-pointer"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleZoom2D(1.25)}
                    aria-label="Zoom Out"
                    className="p-2 rounded-xl border border-line bg-canvas hover:bg-soft text-ink cursor-pointer"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewport({ xMin: -10, xMax: 10, yMin: -8, yMax: 8 })}
                    aria-label="Reset Viewport"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-line bg-canvas hover:bg-soft text-xs font-semibold text-ink cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset View</span>
                  </button>
                </div>
              </div>

              {/* Interactive SVG Coordinate Plane */}
              <div className="rounded-xl border border-line bg-[#F8FAFC] dark:bg-[#0B1120] overflow-hidden select-none">
                <svg
                  ref={graphSvgRef}
                  viewBox={`0 0 ${svgW} ${svgH}`}
                  data-testid="desmos-2d-svg-canvas"
                  onMouseDown={handleGraphMouseDown}
                  onMouseMove={handleGraphMouseMove}
                  onMouseUp={handleGraphMouseUp}
                  onMouseLeave={handleGraphMouseUp}
                  onWheel={handleGraphWheel}
                  className="w-full h-[460px] lg:h-[520px] cursor-grab active:cursor-grabbing"
                >
                  {/* Minor & Major Coordinate Grid Lines */}
                  {Array.from({ length: 11 }, (_, i) => {
                    const frac = i / 10;
                    const xVal = viewport.xMin + frac * (viewport.xMax - viewport.xMin);
                    const yVal = viewport.yMin + frac * (viewport.yMax - viewport.yMin);
                    const px = pad + frac * plotW;
                    const py = pad + (1 - frac) * plotH;
                    return (
                      <g key={i}>
                        <line
                          x1={px}
                          y1={pad}
                          x2={px}
                          y2={svgH - pad}
                          stroke="#CBD5E1"
                          strokeOpacity={0.45}
                          strokeWidth={1}
                        />
                        <line
                          x1={pad}
                          y1={py}
                          x2={svgW - pad}
                          y2={py}
                          stroke="#CBD5E1"
                          strokeOpacity={0.45}
                          strokeWidth={1}
                        />
                        <text
                          x={px}
                          y={zeroY + 14}
                          textAnchor="middle"
                          fontSize="10"
                          fill="#64748B"
                        >
                          {Number(xVal.toFixed(1))}
                        </text>
                        <text
                          x={zeroX - 8}
                          y={py + 3}
                          textAnchor="end"
                          fontSize="10"
                          fill="#64748B"
                        >
                          {Number(yVal.toFixed(1))}
                        </text>
                      </g>
                    );
                  })}

                  {/* Primary X and Y Axes */}
                  <line
                    x1={pad}
                    y1={zeroY}
                    x2={svgW - pad}
                    y2={zeroY}
                    stroke="#334155"
                    strokeWidth={1.75}
                  />
                  <line
                    x1={zeroX}
                    y1={pad}
                    x2={zeroX}
                    y2={svgH - pad}
                    stroke="#334155"
                    strokeWidth={1.75}
                  />

                  {/* Definite Integral Area Shading Polygon */}
                  {calculusEnabled &&
                    calculusResult &&
                    calculusResult.shadedPolygonPoints.length > 2 && (
                      <polygon
                        points={calculusResult.shadedPolygonPoints
                          .map((pt) => `${mapX(pt.x)},${mapY(pt.y)}`)
                          .join(' ')}
                        fill="#4F46E5"
                        fillOpacity={0.18}
                        stroke="#4F46E5"
                        strokeWidth={1}
                        strokeDasharray="3 3"
                      />
                    )}

                  {/* Plotted Curves + Inequality Shading */}
                  {sampledCurves.map(({ curve, sampled }) => {
                    if (!curve.visible) return null;
                    return (
                      <g key={curve.id}>
                        {/* Inequality Shade Region */}
                        {sampled.parsed.mode === 'inequality' &&
                          sampled.segments.map((seg, sIdx) => {
                            if (seg.length < 2) return null;
                            const boundY =
                              sampled.parsed.inequalityOp === '>' ||
                              sampled.parsed.inequalityOp === '>='
                                ? viewport.yMax
                                : viewport.yMin;
                            const polyPts = [
                              { x: seg[0].x, y: boundY },
                              ...seg,
                              { x: seg[seg.length - 1].x, y: boundY },
                            ]
                              .map((p) => `${mapX(p.x)},${mapY(p.y)}`)
                              .join(' ');
                            return (
                              <polygon
                                key={`ineq-${sIdx}`}
                                points={polyPts}
                                fill={curve.color}
                                fillOpacity={0.14}
                              />
                            );
                          })}

                        {/* Curve Polyline Segments */}
                        {sampled.segments.map((seg, sIdx) => (
                          <polyline
                            key={`seg-${sIdx}`}
                            fill="none"
                            stroke={curve.color}
                            strokeWidth={2.6}
                            strokeDasharray={
                              sampled.parsed.inequalityOp === '<' ||
                              sampled.parsed.inequalityOp === '>'
                                ? '6 4'
                                : undefined
                            }
                            points={seg.map((pt) => `${mapX(pt.x)},${mapY(pt.y)}`).join(' ')}
                          />
                        ))}
                      </g>
                    );
                  })}

                  {/* Derivative Tangent Line */}
                  {calculusEnabled &&
                    calculusResult &&
                    calculusResult.derivativeSlope !== null &&
                    calculusResult.tangentY !== null && (
                      <g>
                        <line
                          x1={mapX(viewport.xMin)}
                          y1={mapY(
                            calculusResult.tangentY +
                              calculusResult.derivativeSlope *
                                (viewport.xMin - calculusResult.tangentX)
                          )}
                          x2={mapX(viewport.xMax)}
                          y2={mapY(
                            calculusResult.tangentY +
                              calculusResult.derivativeSlope *
                                (viewport.xMax - calculusResult.tangentX)
                          )}
                          stroke="#E11D48"
                          strokeWidth={1.6}
                          strokeDasharray="5 4"
                        />
                        <circle
                          cx={mapX(calculusResult.tangentX)}
                          cy={mapY(calculusResult.tangentY)}
                          r={5}
                          fill="#E11D48"
                          stroke="#FFFFFF"
                          strokeWidth={1.5}
                        />
                      </g>
                    )}

                  {/* Clickable Points of Interest (Roots, Extrema, Intersections) */}
                  {pointsOfInterest.map((poi) => {
                    const cx = mapX(poi.x);
                    const cy = mapY(poi.y);
                    const isSelected = selectedPoi?.id === poi.id;
                    const dotColor =
                      poi.type === 'intersection'
                        ? '#E11D48'
                        : poi.type === 'max' || poi.type === 'min'
                        ? '#D97706'
                        : '#0D9488';
                    return (
                      <g
                        key={poi.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPoi(poi);
                        }}
                        className="cursor-pointer"
                      >
                        <circle
                          cx={cx}
                          cy={cy}
                          r={isSelected ? 7 : 5}
                          fill={dotColor}
                          stroke="#FFFFFF"
                          strokeWidth={2}
                        />
                        {isSelected && (
                          <g>
                            <rect
                              x={Math.min(svgW - 175, Math.max(10, cx + 8))}
                              y={Math.max(12, cy - 28)}
                              width={165}
                              height={24}
                              rx={6}
                              fill="#0F172A"
                            />
                            <text
                              x={Math.min(svgW - 175, Math.max(10, cx + 8)) + 82}
                              y={Math.max(12, cy - 28) + 15}
                              textAnchor="middle"
                              fontSize="11"
                              fontWeight="bold"
                              fill="#FFFFFF"
                            >
                              {poi.label}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Points of Interest Interactive Strip */}
              <div className="pt-2 border-t border-line space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-ink">
                    Auto-Detected Points of Interest ({pointsOfInterest.length})
                  </span>
                  <span className="text-muted">
                    Roots (f(x)=0) · Local Extrema (f&apos;(x)=0) · Curve Intersections (f₁(x)=f₂(x))
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {pointsOfInterest.slice(0, 14).map((poi) => (
                    <button
                      key={poi.id}
                      type="button"
                      onClick={() => setSelectedPoi(poi)}
                      data-testid={`poi-chip-${poi.type}`}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-mono tabular-nums cursor-pointer transition-colors ${
                        selectedPoi?.id === poi.id
                          ? 'bg-brand text-white border-brand'
                          : 'bg-canvas border-line text-ink hover:bg-soft'
                      }`}
                    >
                      {poi.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TOOL 2: MATRIX & LINEAR ALGEBRA CALCULATOR
         ===================================================================== */}
      {activeTool === 'matrix' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 5-Col Matrix Editors */}
          <div className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-[#111827] border border-line space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-ink">
                Matrix Dimensions &amp; Entries
              </h2>
              <div className="inline-flex rounded-xl border border-line bg-canvas p-1">
                {([2, 3] as const).map((dim) => (
                  <button
                    key={dim}
                    type="button"
                    onClick={() => handleChangeMatrixDim(dim)}
                    data-testid={`matrix-dim-${dim}x${dim}`}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      matrixDim === dim ? 'bg-brand text-white' : 'text-muted hover:text-ink'
                    }`}
                  >
                    {dim} × {dim}
                  </button>
                ))}
              </div>
            </div>

            {/* Matrix A Grid */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-ink">Matrix A ({matrixDim}×{matrixDim})</div>
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(${matrixDim}, minmax(0, 1fr))` }}
              >
                {matrixA.map((row, rIdx) =>
                  row.map((val, cIdx) => (
                    <input
                      key={`A-${rIdx}-${cIdx}`}
                      type="number"
                      step="any"
                      value={val}
                      aria-label={`Matrix A row ${rIdx + 1} col ${cIdx + 1}`}
                      onChange={(e) => {
                        const num = Number(e.target.value);
                        setMatrixA((prev) =>
                          prev.map((r, ri) =>
                            ri === rIdx
                              ? r.map((c, ci) => (ci === cIdx ? (Number.isFinite(num) ? num : 0) : c))
                              : r
                          )
                        );
                      }}
                      className="px-3 py-2 rounded-xl bg-canvas border border-line text-center font-mono tabular-nums text-sm text-ink focus:outline-none focus:border-brand"
                    />
                  ))
                )}
              </div>
            </div>

            {/* Matrix B Grid */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-ink">Matrix B ({matrixDim}×{matrixDim})</div>
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(${matrixDim}, minmax(0, 1fr))` }}
              >
                {matrixB.map((row, rIdx) =>
                  row.map((val, cIdx) => (
                    <input
                      key={`B-${rIdx}-${cIdx}`}
                      type="number"
                      step="any"
                      value={val}
                      aria-label={`Matrix B row ${rIdx + 1} col ${cIdx + 1}`}
                      onChange={(e) => {
                        const num = Number(e.target.value);
                        setMatrixB((prev) =>
                          prev.map((r, ri) =>
                            ri === rIdx
                              ? r.map((c, ci) => (ci === cIdx ? (Number.isFinite(num) ? num : 0) : c))
                              : r
                          )
                        );
                      }}
                      className="px-3 py-2 rounded-xl bg-canvas border border-line text-center font-mono tabular-nums text-sm text-ink focus:outline-none focus:border-brand"
                    />
                  ))
                )}
              </div>
            </div>

            {/* Vector b for Ax = b */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-ink">
                Constant Vector b⃗ (for Linear System Ax = b)
              </div>
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(${matrixDim}, minmax(0, 1fr))` }}
              >
                {vectorB.map((val, idx) => (
                  <input
                    key={`vecB-${idx}`}
                    type="number"
                    step="any"
                    value={val}
                    aria-label={`Vector b entry ${idx + 1}`}
                    onChange={(e) => {
                      const num = Number(e.target.value);
                      setVectorB((prev) =>
                        prev.map((v, i) => (i === idx ? (Number.isFinite(num) ? num : 0) : v))
                      );
                    }}
                    className="px-3 py-2 rounded-xl bg-canvas border border-line text-center font-mono tabular-nums text-sm text-ink focus:outline-none focus:border-brand"
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right 7-Col KaTeX Linear Algebra Results */}
          <div className="lg:col-span-7 p-6 rounded-2xl bg-white dark:bg-[#111827] border border-line space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'det_inv', label: 'Det, Inverse & Transpose' },
                  { id: 'rref', label: 'RREF & Rank' },
                  { id: 'eigen', label: 'Eigenvalues & Char. Poly' },
                  { id: 'solve_axb', label: 'Solve System Ax = b' },
                  { id: 'multiply', label: 'Multiply A × B' },
                  { id: 'add', label: 'Add A + B' },
                ] as const
              ).map((op) => (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => setSelectedMatrixOp(op.id)}
                  data-testid={`matrix-op-${op.id}`}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                    selectedMatrixOp === op.id
                      ? 'bg-brand text-white'
                      : 'bg-canvas border border-line text-ink hover:bg-soft'
                  }`}
                >
                  {op.label}
                </button>
              ))}
            </div>

            {/* Scalar KPI Strip */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-canvas border border-line">
                <div className="text-xs text-muted">Determinant det(A)</div>
                <div
                  data-testid="matrix-det-value"
                  className="text-xl font-bold font-mono tabular-nums text-ink mt-1"
                >
                  {matrixAnalysis.detA ?? 0}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-canvas border border-line">
                <div className="text-xs text-muted">Trace tr(A)</div>
                <div className="text-xl font-bold font-mono tabular-nums text-ink mt-1">
                  {matrixAnalysis.traceA ?? 0}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-canvas border border-line">
                <div className="text-xs text-muted">Rank rank(A)</div>
                <div className="text-xl font-bold font-mono tabular-nums text-ink mt-1">
                  {matrixAnalysis.rrefA.rank}
                </div>
              </div>
            </div>

            {/* Operation Output Panel */}
            <div className="p-5 rounded-xl bg-canvas border border-line space-y-4 overflow-x-auto">
              {selectedMatrixOp === 'det_inv' && (
                <div className="space-y-4">
                  <div>
                    <div className="text-xs font-bold text-muted mb-2">Inverse Matrix A⁻¹:</div>
                    {matrixAnalysis.invA.invertible && matrixAnalysis.invA.inverse ? (
                      <MathText
                        text={`$$A^{-1} = ${formatMatrixAsLatex(matrixAnalysis.invA.inverse)}$$`}
                      />
                    ) : (
                      <div className="text-xs text-danger font-semibold">
                        Matrix A is singular (det(A) = 0) and not invertible.
                      </div>
                    )}
                  </div>
                  <div className="pt-3 border-t border-line">
                    <div className="text-xs font-bold text-muted mb-2">Transpose Matrix Aᵀ:</div>
                    <MathText text={`$$A^T = ${formatMatrixAsLatex(matrixAnalysis.transA)}$$`} />
                  </div>
                </div>
              )}

              {selectedMatrixOp === 'rref' && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-muted">
                    Row-Reduced Echelon Form RREF(A) (Rank = {matrixAnalysis.rrefA.rank}):
                  </div>
                  <MathText
                    text={`$$\\text{RREF}(A) = ${formatMatrixAsLatex(matrixAnalysis.rrefA.rref)}$$`}
                  />
                </div>
              )}

              {selectedMatrixOp === 'eigen' && matrixAnalysis.eigA && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-muted">
                    Characteristic Equation det(A - λI) = 0:
                  </div>
                  <MathText text={`$$${matrixAnalysis.eigA.characteristicPolynomialLatex}$$`} />
                  <div className="text-xs font-bold text-muted pt-2">Eigenvalues (λᵢ):</div>
                  <MathText text={`$$${matrixAnalysis.eigA.eigenvalues.join(', \\quad ')}$$`} />
                </div>
              )}

              {selectedMatrixOp === 'solve_axb' && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-muted">
                    {matrixAnalysis.sysAxB.statusMessage}
                  </div>
                  <MathText text={`$$${matrixAnalysis.sysAxB.latexSummary}$$`} />
                </div>
              )}

              {selectedMatrixOp === 'multiply' && matrixAnalysis.prodAB && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-muted">Matrix Product A × B:</div>
                  <MathText text={`$$A \\times B = ${formatMatrixAsLatex(matrixAnalysis.prodAB)}$$`} />
                </div>
              )}

              {selectedMatrixOp === 'add' && matrixAnalysis.sumAB && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-muted">Matrix Sum A + B:</div>
                  <MathText text={`$$A + B = ${formatMatrixAsLatex(matrixAnalysis.sumAB)}$$`} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TOOL 3: 3D SURFACE & VECTOR SPACE CALCULATOR (THREE.JS VIEWPORT)
         ===================================================================== */}
      {activeTool === 'surface3d' && (
        <div className="space-y-4">
          {/* Unobstructed 3D Viewport with Collapsible Bottom Control Dock */}
          <div className="relative rounded-2xl border border-line bg-[#0B1120] overflow-hidden h-[620px]">
            {/* Top-Left Minimal Spec Header */}
            <div className="absolute top-4 left-4 z-10 px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-slate-100 text-xs space-y-1 max-w-md">
              <div className="font-bold text-white">
                3D Surface &amp; Vector Space: <span className="font-mono text-indigo-300">{surface3dExpr}</span>
              </div>
              <div className="text-slate-300 font-mono tabular-nums">
                a·b = {vector3dOps.dotProduct} · |a×b| = {vector3dOps.areaOfParallelogram} · θ = {vector3dOps.angleDegrees}°
              </div>
            </div>

            {/* Dedicated Empty Ref Container for WebGL Canvas */}
            <div
              ref={canvas3dMountRef}
              data-testid="desmos-3d-webgl-viewport"
              className="w-full h-full"
            />

            {/* Collapsible Bottom Control Dock (Zero Side-Panel Clutter) */}
            <div
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-[min(940px,94vw)] transition-transform duration-200"
            >
              <div className="flex justify-center mb-1">
                <button
                  type="button"
                  onClick={() => setDockCollapsed3D((v) => !v)}
                  data-testid="toggle-3d-bottom-dock-btn"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-t-xl bg-slate-900 border border-b-0 border-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  {dockCollapsed3D ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" />
                      <span>Show 3D Controls</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" />
                      <span>Hide Controls</span>
                    </>
                  )}
                </button>
              </div>

              {!dockCollapsed3D && (
                <div className="p-4 rounded-2xl bg-slate-900/95 border border-slate-700 text-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {/* Surface Equation Input */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-300 block">
                      Surface Equation z = f(x, y)
                    </label>
                    <input
                      type="text"
                      value={surface3dExpr}
                      onChange={(e) => setSurface3dExpr(e.target.value)}
                      data-testid="surface-3d-expression-input"
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 font-mono text-white"
                    />
                    <div className="flex flex-wrap gap-1 pt-1">
                      {[
                        'z = sin(sqrt(x^2 + y^2)) * 2',
                        'z = 0.15 * (x^2 - y^2)',
                        'z = cos(x) * sin(y)',
                      ].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setSurface3dExpr(preset)}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-indigo-300 cursor-pointer"
                        >
                          {preset.replace('z = ', '')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3D Vectors A and B */}
                  <div className="space-y-1.5">
                    <div className="font-bold text-slate-300">
                      3D Vectors a⃗ (Cyan), b⃗ (Green), a⃗ × b⃗ (Rose)
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['x', 'y', 'z'] as const).map((axis, i) => (
                        <input
                          key={`va-${axis}`}
                          type="number"
                          value={vecA[i]}
                          aria-label={`Vector a ${axis}`}
                          onChange={(e) => {
                            const v = Number(e.target.value) || 0;
                            setVecA((prev) => {
                              const next: [number, number, number] = [...prev];
                              next[i] = v;
                              return next;
                            });
                          }}
                          className="px-2 py-1 rounded bg-slate-800 border border-slate-600 font-mono text-center text-cyan-300"
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['x', 'y', 'z'] as const).map((axis, i) => (
                        <input
                          key={`vb-${axis}`}
                          type="number"
                          value={vecB[i]}
                          aria-label={`Vector b ${axis}`}
                          onChange={(e) => {
                            const v = Number(e.target.value) || 0;
                            setVecB((prev) => {
                              const next: [number, number, number] = [...prev];
                              next[i] = v;
                              return next;
                            });
                          }}
                          className="px-2 py-1 rounded bg-slate-800 border border-slate-600 font-mono text-center text-emerald-300"
                        />
                      ))}
                    </div>
                  </div>

                  {/* Cross-Section Slicing Plane */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-300">Cross-Section Slice</span>
                      <span className="font-mono tabular-nums text-amber-300">
                        {sliceAxis === 'none' ? 'Off' : `${sliceAxis.toUpperCase()} = ${sliceValue}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {(['none', 'x', 'y', 'z'] as const).map((ax) => (
                        <button
                          key={ax}
                          type="button"
                          onClick={() => setSliceAxis(ax)}
                          className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                            sliceAxis === ax
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {ax === 'none' ? 'None' : `Slice ${ax.toUpperCase()}`}
                        </button>
                      ))}
                    </div>
                    {sliceAxis !== 'none' && (
                      <input
                        type="range"
                        min={-4}
                        max={4}
                        step={0.2}
                        value={sliceValue}
                        aria-label="3D cross section slice position"
                        onChange={(e) => setSliceValue(Number(e.target.value))}
                        className="w-full accent-amber-400 cursor-pointer"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TOOL 4: INTERACTIVE GEOMETRY, RAY OPTICS & FORCE VECTOR SANDBOX
         ===================================================================== */}
      {activeTool === 'geometry' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 4-Col Controls & Live Measurements */}
          <div className="lg:col-span-4 p-6 rounded-2xl bg-white dark:bg-[#111827] border border-line space-y-5">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-canvas border border-line">
              {(
                [
                  { id: 'geometry', label: 'Polygon Geometry' },
                  { id: 'optics', label: 'Ray Optics Bench' },
                  { id: 'forces', label: 'Force Vectors (FBD)' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSandboxMode(m.id)}
                  data-testid={`sandbox-mode-${m.id}`}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold cursor-pointer ${
                    sandboxMode === m.id ? 'bg-brand text-white' : 'text-muted hover:text-ink'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {sandboxMode === 'geometry' && (
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ink">Polygon Vertices (Drag on Canvas)</span>
                  <button
                    type="button"
                    onClick={() => {
                      const nextLabel = String.fromCharCode(65 + vertices.length);
                      setVertices((prev) => [
                        ...prev,
                        { id: `v-${Date.now()}`, label: nextLabel, x: 0, y: 2 },
                      ]);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-brand text-white font-semibold cursor-pointer"
                  >
                    + Add Vertex
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-canvas border border-line">
                    <div className="text-muted">Perimeter</div>
                    <div
                      data-testid="geometry-perimeter-value"
                      className="text-lg font-bold font-mono tabular-nums text-ink"
                    >
                      {polygonMetrics.perimeter}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-canvas border border-line">
                    <div className="text-muted">Enclosed Area</div>
                    <div
                      data-testid="geometry-area-value"
                      className="text-lg font-bold font-mono tabular-nums text-brand"
                    >
                      {polygonMetrics.area}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="font-bold text-ink">Interior Angles &amp; Side Lengths</div>
                  {polygonMetrics.interiorAngles.map((ang, i) => (
                    <div
                      key={ang.label}
                      className="px-3 py-2 rounded-lg bg-canvas border border-line flex items-center justify-between font-mono tabular-nums"
                    >
                      <span>
                        ∠{ang.label} = <strong>{ang.angleDeg}°</strong>
                      </span>
                      <span className="text-muted">
                        Side {polygonMetrics.sideLengths[i]?.from}
                        {polygonMetrics.sideLengths[i]?.to} = {polygonMetrics.sideLengths[i]?.length}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sandboxMode === 'optics' && (
              <div className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="font-bold text-ink block">Optical Element</label>
                  <select
                    value={opticsElement}
                    onChange={(e) => setOpticsElement(e.target.value as any)}
                    data-testid="optics-element-select"
                    className="w-full px-3 py-2 rounded-xl bg-canvas border border-line text-ink font-semibold"
                  >
                    <option value="convex_lens">Biconvex Converging Lens (f &gt; 0)</option>
                    <option value="concave_lens">Biconcave Diverging Lens (f &lt; 0)</option>
                    <option value="concave_mirror">Concave Spherical Mirror (f &lt; 0)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Object Distance |u|:</span>
                    <strong className="font-mono tabular-nums">{objectDistanceAbs} cm</strong>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={80}
                    value={objectDistanceAbs}
                    aria-label="Object distance u"
                    onChange={(e) => setObjectDistanceAbs(Number(e.target.value))}
                    className="w-full accent-indigo-600"
                  />

                  <div className="flex justify-between">
                    <span>Focal Length |f|:</span>
                    <strong className="font-mono tabular-nums">{focalLengthAbs} cm</strong>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={50}
                    value={focalLengthAbs}
                    aria-label="Focal length f"
                    onChange={(e) => setFocalLengthAbs(Number(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                </div>

                <div className="p-4 rounded-xl bg-canvas border border-line space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted">Image Distance v:</span>
                    <strong
                      data-testid="optics-image-distance"
                      className="font-mono tabular-nums text-ink"
                    >
                      {opticsResult.v !== null ? `${opticsResult.v} cm` : 'Infinity'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Magnification m:</span>
                    <strong className="font-mono tabular-nums text-ink">
                      {opticsResult.magnification ?? '∞'}×
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Optical Power P:</span>
                    <strong className="font-mono tabular-nums text-ink">
                      {opticsResult.powerDiopter} D
                    </strong>
                  </div>
                  <div className="pt-2 border-t border-line font-bold text-brand">
                    {opticsResult.nature}
                  </div>
                </div>
              </div>
            )}

            {sandboxMode === 'forces' && (
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ink">Mass m = {blockMassKg} kg</span>
                  <input
                    type="range"
                    min={1}
                    max={25}
                    value={blockMassKg}
                    aria-label="Block mass kg"
                    onChange={(e) => setBlockMassKg(Number(e.target.value))}
                    className="w-32 accent-indigo-600"
                  />
                </div>

                <div className="space-y-2">
                  {forces.map((f, idx) => (
                    <div
                      key={f.id}
                      className="p-2.5 rounded-xl bg-canvas border border-line space-y-1.5"
                    >
                      <div className="flex justify-between font-semibold text-ink">
                        <span>{f.label}</span>
                        <span className="font-mono tabular-nums">
                          {f.magnitudeN} N @ {f.angleDeg}°
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={f.magnitudeN}
                          aria-label={`${f.label} magnitude`}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setForces((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, magnitudeN: val } : item
                              )
                            );
                          }}
                          className="accent-indigo-600"
                        />
                        <input
                          type="range"
                          min={0}
                          max={360}
                          value={f.angleDeg}
                          aria-label={`${f.label} angle`}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setForces((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, angleDeg: val } : item))
                            );
                          }}
                          className="accent-teal-600"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-xl bg-canvas border border-line space-y-1.5 font-mono tabular-nums">
                  <div>
                    ∑Fx = <strong>{forceResult.sumFx} N</strong> · ∑Fy ={' '}
                    <strong>{forceResult.sumFy} N</strong>
                  </div>
                  <div className="text-brand font-bold">
                    |F_net| = {forceResult.netForceN} N @ {forceResult.netAngleDeg}°
                  </div>
                  <div>
                    Acceleration |a| = <strong>{forceResult.accelerationMs2} m/s²</strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right 8-Col Interactive Construction & Physics Canvas */}
          <div className="lg:col-span-8 p-5 rounded-2xl bg-white dark:bg-[#111827] border border-line">
            <svg
              ref={geoSvgRef}
              viewBox="0 0 800 480"
              data-testid="geometry-optics-svg-canvas"
              onMouseMove={(e) => {
                if (!draggingVertexId || !geoSvgRef.current) return;
                const rect = geoSvgRef.current.getBoundingClientRect();
                const normX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 20 - 10;
                const normY = 6 - ((e.clientY - rect.top) / Math.max(1, rect.height)) * 12;
                setVertices((prev) =>
                  prev.map((v) =>
                    v.id === draggingVertexId
                      ? { ...v, x: Number(normX.toFixed(2)), y: Number(normY.toFixed(2)) }
                      : v
                  )
                );
              }}
              onMouseUp={() => setDraggingVertexId(null)}
              onMouseLeave={() => setDraggingVertexId(null)}
              className="w-full h-[460px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B1120] border border-line select-none"
            >
              {/* Center Axes */}
              <line x1={0} y1={240} x2={800} y2={240} stroke="#CBD5E1" strokeWidth={1.5} />
              <line x1={400} y1={0} x2={400} y2={480} stroke="#CBD5E1" strokeWidth={1.5} />

              {sandboxMode === 'geometry' && (
                <g>
                  <polygon
                    points={vertices
                      .map((v) => `${400 + v.x * 40},${240 - v.y * 40}`)
                      .join(' ')}
                    fill="#4F46E5"
                    fillOpacity={0.14}
                    stroke="#4F46E5"
                    strokeWidth={2.5}
                  />
                  {/* Side Length Labels */}
                  {polygonMetrics.sideLengths.map((s) => (
                    <text
                      key={`${s.from}-${s.to}`}
                      x={400 + s.midX * 40}
                      y={240 - s.midY * 40 - 6}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="bold"
                      fill="#0D9488"
                    >
                      {s.length}
                    </text>
                  ))}
                  {/* Draggable Vertices + Angle Labels */}
                  {vertices.map((v, idx) => {
                    const cx = 400 + v.x * 40;
                    const cy = 240 - v.y * 40;
                    const ang = polygonMetrics.interiorAngles[idx]?.angleDeg;
                    return (
                      <g
                        key={v.id}
                        onMouseDown={() => setDraggingVertexId(v.id)}
                        className="cursor-move"
                      >
                        <circle
                          cx={cx}
                          cy={cy}
                          r={8}
                          fill="#4F46E5"
                          stroke="#FFFFFF"
                          strokeWidth={2}
                        />
                        <text
                          x={cx + 12}
                          y={cy - 10}
                          fontSize="12"
                          fontWeight="bold"
                          fill="#1E293B"
                        >
                          {v.label} ({v.x}, {v.y}) {ang ? `· ${ang}°` : ''}
                        </text>
                      </g>
                    );
                  })}
                </g>
              )}

              {sandboxMode === 'optics' && (
                <g>
                  {/* Lens / Mirror Element at x = 400 */}
                  <ellipse
                    cx={400}
                    cy={240}
                    rx={opticsElement === 'concave_lens' ? 8 : 14}
                    ry={140}
                    fill="#38BDF8"
                    fillOpacity={0.22}
                    stroke="#0284C7"
                    strokeWidth={2.5}
                  />
                  {/* Focal Points F1 and F2 */}
                  <circle cx={400 - focalLengthAbs * 4} cy={240} r={5} fill="#D97706" />
                  <text x={400 - focalLengthAbs * 4} y={260} textAnchor="middle" fontSize="11" fill="#D97706">
                    F₁
                  </text>
                  <circle cx={400 + focalLengthAbs * 4} cy={240} r={5} fill="#D97706" />
                  <text x={400 + focalLengthAbs * 4} y={260} textAnchor="middle" fontSize="11" fill="#D97706">
                    F₂
                  </text>

                  {/* Object Arrow */}
                  {(() => {
                    const objX = 400 + opticsResult.u * 4;
                    const objTopY = 240 - objectHeight * 18;
                    const imgX =
                      opticsResult.v !== null ? 400 + opticsResult.v * 4 : 760;
                    const imgTopY =
                      opticsResult.imageHeight !== null
                        ? 240 - opticsResult.imageHeight * 18
                        : 240;
                    return (
                      <g>
                        <line
                          x1={objX}
                          y1={240}
                          x2={objX}
                          y2={objTopY}
                          stroke="#059669"
                          strokeWidth={3.5}
                        />
                        <circle cx={objX} cy={objTopY} r={5} fill="#059669" />
                        <text x={objX} y={objTopY - 10} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#059669">
                          Object (u = {opticsResult.u} cm)
                        </text>

                        {/* Principal Rays */}
                        <line
                          x1={objX}
                          y1={objTopY}
                          x2={400}
                          y2={objTopY}
                          stroke="#E11D48"
                          strokeWidth={1.8}
                        />
                        <line
                          x1={400}
                          y1={objTopY}
                          x2={imgX}
                          y2={imgTopY}
                          stroke="#E11D48"
                          strokeWidth={1.8}
                        />
                        <line
                          x1={objX}
                          y1={objTopY}
                          x2={imgX}
                          y2={imgTopY}
                          stroke="#7C3AED"
                          strokeWidth={1.8}
                          strokeDasharray="4 3"
                        />

                        {/* Image Arrow */}
                        {opticsResult.v !== null && (
                          <g>
                            <line
                              x1={imgX}
                              y1={240}
                              x2={imgX}
                              y2={imgTopY}
                              stroke="#4F46E5"
                              strokeWidth={3.5}
                            />
                            <circle cx={imgX} cy={imgTopY} r={5} fill="#4F46E5" />
                            <text x={imgX} y={imgTopY + 18} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#4F46E5">
                              Image (v = {opticsResult.v} cm)
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })()}
                </g>
              )}

              {sandboxMode === 'forces' && (
                <g>
                  {/* Central Mass Block */}
                  <rect
                    x={375}
                    y={215}
                    width={50}
                    height={50}
                    rx={8}
                    fill="#1E293B"
                    stroke="#475569"
                    strokeWidth={2}
                  />
                  <text x={400} y={244} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#FFFFFF">
                    {blockMassKg} kg
                  </text>

                  {/* Applied Force Vectors */}
                  {forces.map((f, idx) => {
                    const rad = (f.angleDeg * Math.PI) / 180;
                    const tx = 400 + Math.cos(rad) * f.magnitudeN * 2.5;
                    const ty = 240 - Math.sin(rad) * f.magnitudeN * 2.5;
                    const color = CURVE_PALETTE[idx % CURVE_PALETTE.length];
                    return (
                      <g key={f.id}>
                        <line
                          x1={400}
                          y1={240}
                          x2={tx}
                          y2={ty}
                          stroke={color}
                          strokeWidth={3}
                        />
                        <circle cx={tx} cy={ty} r={5} fill={color} />
                        <text x={tx + 8} y={ty - 6} fontSize="11" fontWeight="bold" fill={color}>
                          {f.label} ({f.magnitudeN}N)
                        </text>
                      </g>
                    );
                  })}

                  {/* Net Resultant Force Vector */}
                  {forceResult.netForceN > 0.1 && (
                    <g>
                      <line
                        x1={400}
                        y1={240}
                        x2={
                          400 +
                          Math.cos((forceResult.netAngleDeg * Math.PI) / 180) *
                            forceResult.netForceN *
                            2.5
                        }
                        y2={
                          240 -
                          Math.sin((forceResult.netAngleDeg * Math.PI) / 180) *
                            forceResult.netForceN *
                            2.5
                        }
                        stroke="#E11D48"
                        strokeWidth={3.5}
                        strokeDasharray="6 4"
                      />
                    </g>
                  )}
                </g>
              )}
            </svg>
          </div>
        </div>
      )}

      {/* =====================================================================
          TOOL 5: SCIENTIFIC CALCULATOR (ANS, EXACT FRACTIONS, UNITS & STATS)
         ===================================================================== */}
      {activeTool === 'scientific' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 6-Col Scientific Expression Evaluator with ans & Exact Fractions */}
          <div className="lg:col-span-6 p-6 rounded-2xl bg-white dark:bg-[#111827] border border-line space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-ink">
                Scientific Calculator (with <code className="font-mono text-brand">ans</code> &amp; Exact Fractions)
              </h2>
              <button
                type="button"
                onClick={() => setShowExactFraction((v) => !v)}
                data-testid="toggle-exact-fraction-btn"
                className="px-3 py-1.5 rounded-xl border border-line bg-canvas hover:bg-soft text-xs font-semibold text-ink cursor-pointer"
              >
                {showExactFraction ? 'Showing: Exact Fraction + Decimal' : 'Showing: Decimal Only'}
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={sciExpr}
                onChange={(e) => setSciExpr(e.target.value)}
                data-testid="scientific-expression-input"
                placeholder="Type math, e.g. ncr(10,3) + sin(pi/6) or 2 * ans"
                className="w-full px-4 py-3 rounded-xl bg-canvas border border-line font-mono text-sm text-ink focus:outline-none focus:border-brand"
              />

              <div className="p-4 rounded-xl bg-canvas border border-line flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-xs text-muted">
                    Result (Current <code className="font-mono">ans = {lastAns}</code>)
                  </div>
                  <div
                    data-testid="scientific-result-display"
                    className="text-lg font-bold font-mono tabular-nums text-ink"
                  >
                    {Number.isFinite(sciEvalValue) ? Number(sciEvalValue.toFixed(8)) : 'Invalid Expression'}
                  </div>
                </div>

                {showExactFraction && Number.isFinite(sciEvalValue) && (
                  <div className="px-4 py-2 rounded-xl bg-white dark:bg-[#1E293B] border border-line text-ink">
                    <MathText text={`$$${sciFraction.latex}$$`} />
                  </div>
                )}
              </div>

              {/* Quick Function & Combinatorics Keypad */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'ans', insert: 'ans' },
                  { label: 'nCr(n,r)', insert: 'ncr(5, 2)' },
                  { label: 'nPr(n,r)', insert: 'npr(5, 2)' },
                  { label: 'n!', insert: 'fact(5)' },
                  { label: '√x', insert: 'sqrt(' },
                  { label: 'sin', insert: 'sin(' },
                  { label: 'cos', insert: 'cos(' },
                  { label: 'ln', insert: 'ln(' },
                  { label: 'log₁₀', insert: 'log(' },
                  { label: 'π', insert: 'pi' },
                ].map((k) => (
                  <button
                    key={k.label}
                    type="button"
                    onClick={() => setSciExpr((prev) => `${prev} ${k.insert}`.trim())}
                    className="px-3 py-1.5 rounded-lg border border-line bg-canvas hover:bg-soft text-xs font-mono font-semibold text-ink cursor-pointer"
                  >
                    {k.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    if (Number.isFinite(sciEvalValue)) {
                      const cleanDec = String(Number(sciEvalValue.toFixed(6)));
                      setLastAns(Number(cleanDec));
                      setSciHistory((prev) => [
                        { expr: sciExpr, decimal: cleanDec, fraction: sciFraction.display },
                        ...prev.slice(0, 7),
                      ]);
                    }
                  }}
                  data-testid="scientific-store-ans-btn"
                  className="ml-auto px-4 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold cursor-pointer"
                >
                  Store in ans &amp; History
                </button>
              </div>
            </div>

            {sciHistory.length > 0 && (
              <div className="space-y-1.5 pt-3 border-t border-line">
                <div className="text-xs font-bold text-muted">Calculation History</div>
                {sciHistory.map((h, i) => (
                  <div
                    key={i}
                    className="px-3 py-2 rounded-lg bg-canvas border border-line flex items-center justify-between text-xs font-mono tabular-nums"
                  >
                    <span className="truncate">{h.expr}</span>
                    <span className="font-bold text-brand">
                      {h.fraction} ({h.decimal})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right 6-Col Engineering Unit Converter & 1D Dataset Statistics */}
          <div className="lg:col-span-6 space-y-6">
            <div className="p-6 rounded-2xl bg-white dark:bg-[#111827] border border-line space-y-4">
              <h3 className="font-display text-base font-bold text-ink">
                Physics &amp; Chemistry Unit Converter
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="number"
                  value={unitVal}
                  onChange={(e) => setUnitVal(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-canvas border border-line font-mono tabular-nums text-sm text-ink"
                />
                <select
                  value={fromUnit}
                  onChange={(e) => setFromUnit(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-canvas border border-line text-xs font-semibold text-ink"
                >
                  {['km/h', 'm/s', 'J', 'eV', 'cal', 'atm', 'Pa', 'bar', 'C', 'K'].map((u) => (
                    <option key={u} value={u}>
                      From: {u}
                    </option>
                  ))}
                </select>
                <select
                  value={toUnit}
                  onChange={(e) => setToUnit(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-canvas border border-line text-xs font-semibold text-ink"
                >
                  {['m/s', 'km/h', 'eV', 'J', 'cal', 'Pa', 'atm', 'bar', 'K', 'C'].map((u) => (
                    <option key={u} value={u}>
                      To: {u}
                    </option>
                  ))}
                </select>
              </div>
              <div className="p-3.5 rounded-xl bg-canvas border border-line text-sm font-mono tabular-nums text-ink">
                {unitResult.ok ? (
                  <span>
                    {unitVal} {fromUnit} = <strong className="text-brand">{unitResult.value}</strong> {toUnit}
                  </span>
                ) : (
                  <span className="text-muted">{unitResult.error || 'Select compatible units'}</span>
                )}
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-[#111827] border border-line space-y-4">
              <h3 className="font-display text-base font-bold text-ink">
                Statistical Dataset Analyzer
              </h3>
              <input
                type="text"
                value={statsInput}
                onChange={(e) => setStatsInput(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-canvas border border-line font-mono text-xs text-ink"
              />
              {statsSummary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
                  <div className="p-3 rounded-xl bg-canvas border border-line">
                    <div className="text-muted">Mean (μ)</div>
                    <div className="text-sm font-bold text-ink mt-0.5">{statsSummary.mean}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-canvas border border-line">
                    <div className="text-muted">Median</div>
                    <div className="text-sm font-bold text-ink mt-0.5">{statsSummary.median}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-canvas border border-line">
                    <div className="text-muted">Std Dev (σ)</div>
                    <div className="text-sm font-bold text-ink mt-0.5">{statsSummary.sampleStdDev}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-canvas border border-line">
                    <div className="text-muted">Count (N)</div>
                    <div className="text-sm font-bold text-ink mt-0.5">{statsSummary.count}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
