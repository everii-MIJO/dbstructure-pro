import React, { memo } from 'react';
import { BaseEdge, EdgeProps, getBezierPath } from '@xyflow/react';
import { useStore } from '../../store/useStore';

export const RelationEdge = memo(({
  id,
  source,
  target,
  sourceHandleId,
  targetHandleId,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: EdgeProps) => {
  const activeColumn = useStore(state => state.activeColumn);
  const focusedTable = useStore(state => state.focusedTable);

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isActiveColumn = activeColumn && 
    ((source === activeColumn.table && sourceHandleId === `source-${activeColumn.column}`) ||
     (target === activeColumn.table && targetHandleId === `target-${activeColumn.column}`));

  const isDimmed = activeColumn 
    ? !isActiveColumn 
    : (focusedTable && source !== focusedTable && target !== focusedTable);

  const isHighlighted = activeColumn 
    ? isActiveColumn 
    : (focusedTable && (source === focusedTable || target === focusedTable));

  const edgeStyle = {
    ...style,
    pointerEvents: 'none' as const,
    strokeWidth: isHighlighted ? 3 : style.strokeWidth || 1,
    stroke: isHighlighted ? '#c8d700' : style.stroke,
    opacity: isHighlighted ? 1 : (isDimmed ? 0.1 : (style.opacity || 0.4)),
    zIndex: isHighlighted ? 1000 : 0,
  };

  return (
    <BaseEdge 
      id={id} 
      path={edgePath} 
      markerEnd={markerEnd} 
      interactionWidth={0}
      style={edgeStyle} 
    />
  );
});
