import { Schema, Position, Relationship } from '../types';
import { 
  CARD_WIDTH, 
  GAP_X, 
  GAP_Y, 
  AREA_PADDING, 
  LABEL_HEIGHT, 
  ESTIMATED_CARD_HEIGHT 
} from '../constants';

export function calculateLayout(schema: Schema) {
  const tables = schema.tables;
  if (!tables || tables.length === 0) return { nodes: [], edges: [] };

  const getPrefix = (name: string) => {
    const match = name.match(/^([a-zA-Z]{2,3})_/);
    return match ? match[1].toLowerCase() : 'other';
  };

  // Group tables by prefix
  const groups: Record<string, typeof tables> = {};
  tables.forEach(t => {
    const prefix = getPrefix(t.name);
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(t);
  });

  const prefixes = Object.keys(groups);
  const relationships = schema.relationships || [];

  // Calculate relationship scores for each group
  const groupScores: Record<string, number> = {};
  prefixes.forEach(prefix => {
    groupScores[prefix] = 0;
    relationships.forEach(rel => {
      const fromPrefix = getPrefix(rel.fromTable);
      const toPrefix = getPrefix(rel.toTable);
      if (fromPrefix === prefix || toPrefix === prefix) {
        groupScores[prefix]++;
      }
    });
  });

  // Sort prefixes by score (most connected first)
  const sortedPrefixes = [...prefixes].sort((a, b) => groupScores[b] - groupScores[a]);

  const nodes: any[] = [];
  const centerX = 0;
  const centerY = 0;

  // Layout center group
  const centerPrefix = sortedPrefixes[0];
  
  const placeGroup = (prefix: string, gx: number, gy: number) => {
    const groupTables = groups[prefix];
    
    // Sort tables by height descending to pack them better
    const tablesWithHeight = groupTables.map(t => ({
      table: t,
      height: 40 + t.columns.length * 28 + 20 // Header + columns + padding
    })).sort((a, b) => b.height - a.height);

    // Calculate ideal number of columns, biasing towards vertical layout for tall tables
    const totalHeight = tablesWithHeight.reduce((sum, t) => sum + t.height + GAP_Y, 0);
    const avgHeight = totalHeight / tablesWithHeight.length;
    
    // If tables are very tall on average, use fewer columns to encourage vertical stacking.
    const avgAspectRatio = avgHeight / CARD_WIDTH;
    const aspectRatioFactor = Math.max(1, avgAspectRatio / 1.5);

    let cols = Math.round(Math.sqrt(tablesWithHeight.length));
    if (tablesWithHeight.length > 10) {
      cols = Math.ceil(Math.sqrt(tablesWithHeight.length * 1.8));
    }
    cols = Math.max(1, Math.min(cols, groupTables.length, 8)); // Cap max columns to 8

    const columnHeights = new Array(cols).fill(0);
    const tablePositions: { table: any, cx: number, cy: number, yOffset: number }[] = [];

    // Initial greedy assignment
    tablesWithHeight.forEach(({ table, height }) => {
      let minCol = 0;
      let minHeight = columnHeights[0];
      for (let i = 1; i < cols; i++) {
        if (columnHeights[i] < minHeight) {
          minHeight = columnHeights[i];
          minCol = i;
        }
      }

      tablePositions.push({
        table,
        cx: minCol,
        cy: 0,
        yOffset: minHeight
      });

      columnHeights[minCol] += height + GAP_Y;
    });

    // Local search to balance columns
    let improved = true;
    let iterations = 0;
    while (improved && iterations < 50) {
      improved = false;
      iterations++;
      
      let maxCol = 0, minCol = 0;
      for (let i = 1; i < cols; i++) {
        if (columnHeights[i] > columnHeights[maxCol]) maxCol = i;
        if (columnHeights[i] < columnHeights[minCol]) minCol = i;
      }
      
      const diff = columnHeights[maxCol] - columnHeights[minCol];
      if (diff < 50) break; // Good enough
      
      const maxColTables = tablePositions.filter(t => t.cx === maxCol);
      
      // Try moving a single table
      for (const t of maxColTables) {
        const h = tablesWithHeight.find(th => th.table.name === t.table.name)!.height + GAP_Y;
        if (Math.abs(diff - 2 * h) < diff) {
          t.cx = minCol;
          columnHeights[maxCol] -= h;
          columnHeights[minCol] += h;
          improved = true;
          break;
        }
      }
      
      if (!improved) {
        // Try swapping two tables
        const minColTables = tablePositions.filter(t => t.cx === minCol);
        for (const tMax of maxColTables) {
          const hMax = tablesWithHeight.find(th => th.table.name === tMax.table.name)!.height + GAP_Y;
          for (const tMin of minColTables) {
            const hMin = tablesWithHeight.find(th => th.table.name === tMin.table.name)!.height + GAP_Y;
            const hDiff = hMax - hMin;
            if (hDiff > 0 && Math.abs(diff - 2 * hDiff) < diff) {
              tMax.cx = minCol;
              tMin.cx = maxCol;
              columnHeights[maxCol] -= hDiff;
              columnHeights[minCol] += hDiff;
              improved = true;
              break;
            }
          }
          if (improved) break;
        }
      }
    }

    // Recalculate yOffsets after balancing
    columnHeights.fill(0);
    // Sort tables in each column by height descending to keep larger tables at top
    for (let c = 0; c < cols; c++) {
      const colTables = tablePositions.filter(t => t.cx === c);
      colTables.sort((a, b) => {
        const ha = tablesWithHeight.find(th => th.table.name === a.table.name)!.height;
        const hb = tablesWithHeight.find(th => th.table.name === b.table.name)!.height;
        return hb - ha;
      });
      for (const t of colTables) {
        t.yOffset = columnHeights[c];
        const h = tablesWithHeight.find(th => th.table.name === t.table.name)!.height;
        columnHeights[c] += h + GAP_Y;
      }
    }

    const HORIZONTAL_SPACING = CARD_WIDTH + GAP_X;
    const groupW = cols * HORIZONTAL_SPACING - GAP_X + AREA_PADDING * 2;
    
    const maxColumnHeight = Math.max(...columnHeights);
    const groupH = maxColumnHeight - GAP_Y + AREA_PADDING * 2 + LABEL_HEIGHT;

    const areaX = gx - groupW / 2;
    const areaY = gy - groupH / 2;

    tablePositions.forEach(({ table, cx, yOffset }) => {
      nodes.push({
        id: table.name,
        type: 'table',
        zIndex: 1,
        position: {
          x: areaX + AREA_PADDING + cx * HORIZONTAL_SPACING,
          y: areaY + AREA_PADDING + LABEL_HEIGHT + yOffset
        },
        data: { table }
      });
    });

    return { width: groupW, height: groupH };
  };

  // Place center group
  const centerSize = placeGroup(centerPrefix, centerX, centerY);

  // Place remaining groups in a circle with more distance
  const remainingPrefixes = sortedPrefixes.slice(1);
  if (remainingPrefixes.length > 0) {
    let maxGroupDim = 0;
    remainingPrefixes.forEach(p => {
      const groupTables = groups[p];
      const cols = Math.ceil(Math.sqrt(groupTables.length));
      const rows = Math.ceil(groupTables.length / cols);
      const w = cols * (CARD_WIDTH + GAP_X);
      const h = rows * (ESTIMATED_CARD_HEIGHT + GAP_Y);
      maxGroupDim = Math.max(maxGroupDim, w, h);
    });

    // Increased base radius to prevent area overlaps
    const baseRadius = Math.max(centerSize.width, centerSize.height) + maxGroupDim + 1200;
    // Interleave large and small groups for a more balanced layout
    const interleavedPrefixes = [];
    let left = 0;
    let right = remainingPrefixes.length - 1;
    while (left <= right) {
      if (left === right) {
        interleavedPrefixes.push(remainingPrefixes[left]);
      } else {
        interleavedPrefixes.push(remainingPrefixes[left]);
        interleavedPrefixes.push(remainingPrefixes[right]);
      }
      left++;
      right--;
    }

    const angleStep = (2 * Math.PI) / remainingPrefixes.length;

    interleavedPrefixes.forEach((prefix, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const gx = centerX + Math.cos(angle) * baseRadius;
      const gy = centerY + Math.sin(angle) * baseRadius;
      placeGroup(prefix, gx, gy);
    });
  }

  // Create Edges
  const edges = relationships.map((rel, i) => ({
    id: `edge-${i}`,
    source: rel.fromTable,
    target: rel.toTable,
    sourceHandle: `source-${rel.fromColumn}`,
    targetHandle: `target-${rel.toColumn}`,
    type: 'relation',
    style: { stroke: 'var(--accent)', strokeWidth: 1, opacity: 0.4 },
    data: { relationship: rel }
  }));

  return { nodes, edges };
}
