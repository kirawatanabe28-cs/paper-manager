import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  Handle,
  Position,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { getGraph, getSubgraph } from '../api/client';
import { getLayoutedElements } from '../utils/graphLayout';
import type { GraphNodeData } from '../types';

interface PaperNodeProps {
  data: GraphNodeData & { selected: boolean };
}

function PaperNode({ data }: PaperNodeProps) {
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (nodeRef.current) {
      const rect = nodeRef.current.getBoundingClientRect();
      setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
    }
  };

  return (
    <div
      ref={nodeRef}
      className={`rounded-lg border-2 px-3 py-2 shadow-sm bg-white cursor-pointer select-none
        ${data.selected ? 'border-orange-500 bg-orange-50' : 'border-blue-400 hover:border-blue-600'}`}
      style={{ width: 200, minHeight: 56, position: 'relative' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setTooltipPos(null)}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#94a3b8' }} />

      {/* ホバー時ツールチップ (Portal でbody直下にレンダリングしz-index問題を回避) */}
      {tooltipPos && data.description && createPortal(
        <div
          style={{
            position: 'fixed',
            bottom: `${window.innerHeight - tooltipPos.y + 8}px`,
            left: `${tooltipPos.x}px`,
            transform: 'translateX(-50%)',
            zIndex: 99999,
            width: 260,
            pointerEvents: 'none',
          }}
          className="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-2xl leading-relaxed whitespace-pre-wrap"
        >
          <p>{data.description}</p>
          {/* 吹き出しの三角 */}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid #111827',
            }}
          />
        </div>,
        document.body
      )}

      <div className="text-xs font-semibold text-gray-800 leading-tight line-clamp-2">{data.label}</div>
      <div className="text-xs text-gray-400 mt-1">{data.year}年</div>

      <Handle type="source" position={Position.Bottom} style={{ background: '#94a3b8' }} />
    </div>
  );
}

const nodeTypes = { paper: PaperNode };

interface GraphViewProps {
  projectId: number;
  selectedPaperId: number | null;
  onNodeClick: (paperId: number) => void;
  refreshTrigger: number;
}

export default function GraphView({ projectId, selectedPaperId, onNodeClick, refreshTrigger }: GraphViewProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    try {
      const data = selectedPaperId
        ? await getSubgraph(projectId, selectedPaperId)
        : await getGraph(projectId);

      const rawNodes: Node[] = data.nodes.map(n => ({
        id: n.id,
        type: 'paper',
        position: n.position,
        data: {
          ...n.data,
          selected: n.data.paperId === selectedPaperId,
        },
      }));

      const rawEdges: Edge[] = data.edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#6b7280' },
        style: { stroke: '#6b7280', strokeWidth: 1.5 },
        animated: false,
      }));

      const { nodes: ln, edges: le } = getLayoutedElements(rawNodes, rawEdges);
      setNodes(ln);
      setEdges(le);
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedPaperId, refreshTrigger]);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeClick(node.data.paperId);
    },
    [onNodeClick],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        読み込み中...
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        論文をアップロードするとグラフが表示されます
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.3 }}
    >
      <Background color="#e5e7eb" gap={16} />
      <Controls />
      <MiniMap nodeColor={n => n.data?.selected ? '#f97316' : '#60a5fa'} />
    </ReactFlow>
  );
}
