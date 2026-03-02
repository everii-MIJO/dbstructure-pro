import React, { memo } from 'react';
import { Handle, Position, NodeProps, Node, useReactFlow } from '@xyflow/react';
import { Table } from '../../types';
import { useStore } from '../../store/useStore';

import { CARD_WIDTH, HEADER_HEIGHT, COL_HEIGHT } from '../../constants';

type TableNodeData = { 
  table: Table; 
  showColumns?: boolean; 
};

export const TableNode = memo(({ data, selected }: NodeProps<Node<TableNodeData>>) => {
  const { table, showColumns = true } = data;
  const { screenToFlowPosition } = useReactFlow();
  
  const activeColumn = useStore(state => state.activeColumn);
  const setActiveColumn = useStore(state => state.setActiveColumn);
  const setFocusedTable = useStore(state => state.setFocusedTable);
  const setNodes = useStore(state => state.setNodes);
  const setPkPopover = useStore(state => state.setPkPopover);
  const setFkPopover = useStore(state => state.setFkPopover);
  const isDimmed = useStore(state => 
    !!(state.focusedTable && state.relatedNodes && !state.relatedNodes.has(table.name))
  );

  const height = showColumns 
    ? HEADER_HEIGHT + table.columns.length * COL_HEIGHT 
    : HEADER_HEIGHT;

  return (
    <div 
      className={`bg-[var(--bg-card)] rounded-xl border-2 shadow-2xl overflow-hidden select-none ${isDimmed ? 'opacity-30' : ''}`}
      style={{ 
        width: CARD_WIDTH,
        height: height,
        borderColor: selected ? "var(--accent)" : "var(--border)",
        boxShadow: selected ? "0 0 15px rgba(200, 215, 1, 0.15)" : "0 0 0px rgba(200, 215, 1, 0)"
      }}
    >
      {/* Header */}
      <div className="h-10 bg-[var(--bg-panel)] px-3 flex items-center justify-between border-b border-[var(--border)] relative">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-[var(--text)] font-bold text-sm truncate">{table.name}</span>
        </div>
        
        {/* Render hidden handles when columns are collapsed to prevent React Flow warnings */}
        {!showColumns && table.columns.map(col => (
          <React.Fragment key={`hidden-handles-${col.name}`}>
            <Handle
              type="target"
              position={Position.Left}
              id={`target-${col.name}`}
              className="!opacity-0 !pointer-events-none !bg-transparent !border-none !invisible"
              style={{ left: -4, top: '50%' }}
            />
            <Handle
              type="source"
              position={Position.Right}
              id={`source-${col.name}`}
              className="!opacity-0 !pointer-events-none !bg-transparent !border-none !invisible"
              style={{ right: -4, top: '50%' }}
            />
          </React.Fragment>
        ))}
      </div>

      {/* Columns */}
      {showColumns && (
        <div className="flex flex-col">
          {table.columns.map((col, idx) => {
            const isActive = activeColumn?.table === table.name && activeColumn?.column === col.name;
            
            return (
              <div 
                key={col.name} 
                className={`h-7 px-3 flex items-center justify-between relative group hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer outline-none ${col.pk ? 'bg-yellow-500/5' : ''} ${isActive ? 'bg-black/10 dark:bg-white/10' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  
                  // Select this node and deselect others, if not already selected
                  if (!selected) {
                    setNodes(nodes => nodes.map(n => ({
                      ...n,
                      selected: n.id === table.name
                    })));
                  }

                  if (activeColumn?.table === table.name && activeColumn?.column === col.name) {
                    setActiveColumn(null);
                    setFocusedTable(null);
                    setPkPopover(null);
                    setFkPopover(null);
                    return;
                  }

                  const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
                  setActiveColumn({ table: table.name, column: col.name });
                  setFocusedTable(table.name);

                  if (col.pk) {
                      setPkPopover({ table: table.name, column: col.name, x: position.x, y: position.y });
                      setFkPopover(null);
                  } else if (col.fk) {
                      setFkPopover({ table: table.name, column: col.name, x: position.x, y: position.y });
                      setPkPopover(null);
                  } else {
                      setPkPopover(null);
                      setFkPopover(null);
                  }
                }}
              >
              {/* Handles for connections */}
              <Handle
                type="target"
                position={Position.Left}
                id={`target-${col.name}`}
                className="!opacity-0 !bg-transparent !border-none"
                style={{ left: -4, top: '50%' }}
              />
              <Handle
                type="source"
                position={Position.Right}
                id={`source-${col.name}`}
                className="!opacity-0 !bg-transparent !border-none"
                style={{ right: -4, top: '50%' }}
              />

              <div className="flex items-center gap-2 overflow-hidden">
                <span className={`text-[10px] ${col.pk ? 'text-yellow-500' : col.fk ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>
                  {col.pk ? '🔑' : col.fk ? '🔗' : '•'}
                </span>
                <span className={`text-xs truncate ${col.pk ? 'text-yellow-500 font-medium' : col.fk ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}>
                  {col.name}
                </span>
                {col.pk && (
                  <span className="px-1.5 py-0.5 rounded-md bg-yellow-500 text-[#0f1117] text-[8px] font-black leading-none shadow-[0_0_10px_rgba(234,179,8,0.4)] uppercase tracking-wider shrink-0 flex items-center justify-center">
                    PK
                  </span>
                )}
                {col.fk && (
                  <span className="px-1.5 py-0.5 rounded-md bg-accent text-accent-text text-[8px] font-black leading-none uppercase tracking-wider shrink-0 flex items-center justify-center">
                    FK
                  </span>
                )}
              </div>
              <span className="text-[10px] text-[var(--text-muted)] font-mono ml-2">
                {col.type.split('(')[0].toLowerCase()}
              </span>
            </div>
          );})}
        </div>
      )}
    </div>
  );
});
