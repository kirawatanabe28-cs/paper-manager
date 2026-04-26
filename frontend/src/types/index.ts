export interface Project {
  id: number;
  name: string;
  description: string;
  created_at: string;
  paper_count: number;
}

export interface Paper {
  id: number;
  project_id: number;
  title: string;
  year: number;
  filename: string;
  filepath: string;
  created_at: string;
}

export interface PaperDetail extends Paper {
  citing: Paper[];    // この論文が引用している論文
  cited_by: Paper[];  // この論文を引用している論文
}

export interface GraphNodeData {
  label: string;
  year: number;
  paperId: number;
}

export interface GraphNode {
  id: string;
  data: GraphNodeData;
  position: { x: number; y: number };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  markerEnd?: { type: string };
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
