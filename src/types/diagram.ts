export type DiagramCategory =
  | 'free_body_diagram'
  | 'circuit'
  | 'circuit_diagram'
  | 'ray_optics'
  | 'conic'
  | 'conic_section'
  | 'molecular_shape'
  | 'flowchart'
  | 'comparison_chart'
  | 'scientific_diagram'
  | 'educational_diagram';

export interface DiagramArrow {
  id: string;
  kind: 'arrow';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  label?: string;
  color?: string;
  strokeWidth?: number;
  dashed?: boolean;
}

export interface DiagramLine {
  id: string;
  kind: 'line';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  label?: string;
  color?: string;
  strokeWidth?: number;
  dashed?: boolean;
}

export interface DiagramRect {
  id: string;
  kind: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  rx?: number;
  label?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface DiagramCircle {
  id: string;
  kind: 'circle';
  cx: number;
  cy: number;
  r: number;
  label?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface DiagramPolygon {
  id: string;
  kind: 'polygon';
  points: string; // e.g. "100,200 300,200 300,100"
  label?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface DiagramPath {
  id: string;
  kind: 'path';
  d: string;
  label?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dashed?: boolean;
}

export interface DiagramText {
  id: string;
  kind: 'text';
  x: number;
  y: number;
  text: string;
  fontSize?: number;
  fontWeight?: string;
  color?: string;
  textAnchor?: 'start' | 'middle' | 'end';
}

export interface DiagramArc {
  id: string;
  kind: 'arc';
  cx: number;
  cy: number;
  r: number;
  startAngleDeg: number;
  endAngleDeg: number;
  label?: string;
  color?: string;
}

export type DiagramElement =
  | DiagramArrow
  | DiagramLine
  | DiagramRect
  | DiagramCircle
  | DiagramPolygon
  | DiagramPath
  | DiagramText
  | DiagramArc;

export interface StructuredDiagramSpec {
  title: string;
  category: DiagramCategory;
  subject: 'Physics' | 'Chemistry' | 'Mathematics' | 'General';
  description: string;
  viewBox: { x?: number; y?: number; width: number; height: number };
  elements: DiagramElement[];
  assumptions: string[];
  schematicAssumptions: string[];
  needsClarification?: string;
  citedPages: number[];
  isAiGenerated?: boolean;
  modelUsed?: string;
  provider?: string;
  fallbackNotice?: string;
}
