import React, { useCallback, useMemo, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';

import { 
  ReactFlow, 
  Background, 
  Controls, 
  Panel,
  ReactFlowProvider,
  useReactFlow,
  Node,
  Edge,
  MiniMap,
  useViewport,
  SelectionMode
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Schema } from '../../types';
import { TableNode } from './TableNode';
import { RelationEdge } from './RelationEdge';
import { useStore } from '../../store/useStore';
import { VirtualizedList } from './VirtualizedList';

interface DiagramProps {
  schema: Schema;
  onNodePositionChange: (nodeId: string, position: { x: number, y: number }) => void;
  isDarkMode: boolean;
}

const nodeTypes = {
  table: TableNode,
};

const edgeTypes = {
  relation: RelationEdge,
};

export interface DiagramRef {
  jumpToTable: (name: string) => void;
  fitView: () => void;
}

const Popovers = () => {
  const { zoom, x, y } = useViewport();
  const pkPopover = useStore(state => state.pkPopover);
  const fkPopover = useStore(state => state.fkPopover);
  const setPkPopover = useStore(state => state.setPkPopover);
  const setFkPopover = useStore(state => state.setFkPopover);
  const { fitView } = useReactFlow();
  const jumpToTableStore = useStore(state => state.jumpToTable);

  const jumpToTable = useCallback((tableName: string) => {
    jumpToTableStore(tableName, fitView);
  }, [jumpToTableStore, fitView]);

  const schema = useStore(state => state.schema);
  const fkRelationships = useStore(state => state.fkRelationships);
  const pkReferences = useStore(state => state.pkReferences);



  if (!schema) return null;

  return (
    <>
      {/* PK Popover */}
      {pkPopover && (
        <div 
          className="fixed z-[100] bg-[var(--bg-panel)] border border-[var(--border-muted)] rounded-lg shadow-2xl p-4 min-w-[200px]"
          style={{ 
            left: pkPopover.x * zoom + x + 10, 
            top: pkPopover.y * zoom + y - 20 
          }}
        >
          <h4 className="text-[#eab308] font-bold text-sm mb-2 flex items-center gap-2">
            🔑 {pkPopover.table}.{pkPopover.column}
          </h4>
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-2">Referenced by:</p>
          <VirtualizedList
            items={pkReferences.get(`${pkPopover.table}.${pkPopover.column}`) || []}
            itemHeight={30}
            height={Math.min(200, (pkReferences.get(`${pkPopover.table}.${pkPopover.column}`) || []).length * 30)}
            renderItem={(r, style) => (
              <div
                style={style}
                onClick={() => {
                  jumpToTable(r.fromTable);
                  setPkPopover(null);
                }}
                className="text-xs text-[var(--text)] hover:text-[var(--accent)] cursor-pointer py-1 border-b border-[var(--border)] last:border-0 flex items-center justify-between group"
              >
                <span>{r.fromTable}</span>
                <span className="text-[8px] bg-[var(--bg-card)] px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">JUMP</span>
              </div>
            )}
          />
        </div>
      )}
      {/* FK Popover */}
      {fkPopover && (
        <div 
          className="fixed z-[100] bg-[var(--bg-panel)] border border-[var(--border-muted)] rounded-lg shadow-2xl p-4 min-w-[200px]"
          style={{ 
            left: fkPopover.x * zoom + x + 10, 
            top: fkPopover.y * zoom + y - 20 
          }}
        >
          <h4 className="text-[var(--accent)] font-bold text-sm mb-2 flex items-center gap-2">
            🔗 {fkPopover.table}.{fkPopover.column}
          </h4>
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-2">References:</p>
          <VirtualizedList
            items={fkRelationships.get(`${fkPopover.table}.${fkPopover.column}`) || []}
            itemHeight={30}
            height={Math.min(200, (fkRelationships.get(`${fkPopover.table}.${fkPopover.column}`) || []).length * 30)}
            renderItem={(r, style) => (
              <div
                style={style}
                onClick={() => {
                  jumpToTable(r.toTable);
                  setFkPopover(null);
                }}
                className="text-xs text-[var(--text)] hover:text-[var(--accent)] cursor-pointer py-1 border-b border-[var(--border)] last:border-0 flex items-center justify-between group"
              >
                <span>{r.toTable}</span>
                <span className="text-[8px] bg-[var(--bg-card)] px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">JUMP</span>
              </div>
            )}
          />
        </div>
      )}
    </>
  );
};

const DiagramInner = forwardRef<DiagramRef, DiagramProps>(({ schema, isDarkMode }, ref) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { fitView, screenToFlowPosition, getViewport } = useReactFlow();

  const nodes = useStore(state => state.nodes);
  const edges = useStore(state => state.edges);
  const onNodesChange = useStore(state => state.onNodesChange);
  const onEdgesChange = useStore(state => state.onEdgesChange);
  const onNodeDragStart = useStore(state => state.onNodeDragStart);
  const onNodeDragStop = useStore(state => state.onNodeDragStop);
  
  const setNodes = useStore(state => state.setNodes);
  const setEdges = useStore(state => state.setEdges);
  
  const setPkPopover = useStore(state => state.setPkPopover);
  const setFkPopover = useStore(state => state.setFkPopover);
  const setActiveColumn = useStore(state => state.setActiveColumn);
  const setFocusedTable = useStore(state => state.setFocusedTable);
  const isSelectionMode = useStore(state => state.isSelectionMode);
  const jumpToTable = useStore(state => state.jumpToTable);

  useImperativeHandle(ref, () => ({
    jumpToTable: (tableName) => jumpToTable(tableName, fitView),
    fitView: () => fitView({ padding: 0.2, duration: 800 })
  }));



  // Separate effect for initial fitView
  useEffect(() => {
    if (nodes.length > 0) {
      setTimeout(() => fitView({ padding: 0.2 }), 100);
    }
  }, [schema]); // Only when schema object changes

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (node.type === 'table') {
      setFocusedTable(node.id);
    }
  }, [setFocusedTable]);

  const onPaneClick = useCallback(() => {
    setPkPopover(null);
    setFkPopover(null);
    setActiveColumn(null);
    setFocusedTable(null);
  }, []);

  return (
    <div className="w-full h-full bg-[var(--bg)] relative" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.01}
        maxZoom={4}
        onPaneClick={onPaneClick}
        onNodeClick={onNodeClick}
        nodeDragThreshold={5}
        colorMode={isDarkMode ? 'dark' : 'light'}
        elementsSelectable={true}
        edgesFocusable={false}
        elevateNodesOnSelect={false}
        panOnDrag={!isSelectionMode}
        selectionOnDrag={isSelectionMode}
        selectionMode={SelectionMode.Partial}
      >
        <Background color="var(--border)" gap={20} />
        <Controls showFitView={false} />
        <MiniMap 
          style={{ backgroundColor: 'var(--bg-panel)' }} 
          nodeColor={(n) => {
            return 'var(--bg-card)';
          }}
          maskColor={isDarkMode ? "rgba(9, 9, 11, 0.3)" : "rgba(255, 255, 255, 0.3)"}
          maskStrokeColor="var(--accent)"
          maskStrokeWidth={1}
          className="!bg-[var(--bg-panel)] border border-[var(--border-muted)] rounded-lg"
        />
        <Popovers />
      </ReactFlow>
    </div>
  );
});

export const Diagram = forwardRef<DiagramRef, DiagramProps>((props, ref) => (
  <ReactFlowProvider>
    <DiagramInner {...props} ref={ref} />
  </ReactFlowProvider>
));
