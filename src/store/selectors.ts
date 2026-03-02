import { createSelector } from 'reselect';
import { Node } from '@xyflow/react';

const getNodes = (state: { nodes: Node[] }) => state.nodes;

export const getColumnPositions = createSelector(
  [getNodes],
  (nodes) => {
    const positions = new Map<string, { x: number, y: number, side: 'left' | 'right' }>();

    nodes.forEach(node => {
      if (node.type === 'table' && node.data?.columns) {
        node.data.columns.forEach((col: any, index: number) => {
          const handleId = `${node.id}-${col.name}`;
          const y = (node.position?.y || 0) + 104 + (index * 28);
          
          positions.set(`${handleId}-left`, { x: node.position?.x || 0, y, side: 'left' });
          positions.set(`${handleId}-right`, { x: (node.position?.x || 0) + (node.width || 0), y, side: 'right' });
        });
      }
    });

    return positions;
  }
);
