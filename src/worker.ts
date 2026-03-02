import { parseDBML } from './lib/parsers/dbmlParser';
import { calculateLayout } from './lib/layout';

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'PARSE_DBML') {
    try {
      const schema = parseDBML(payload);
      if (schema.tables.length > 0) {
        const { nodes, edges } = calculateLayout(schema);
        self.postMessage({ 
          type: 'PARSE_COMPLETE', 
          payload: { schema, nodes, edges } 
        });
      } else {
        self.postMessage({ 
          type: 'PARSE_ERROR', 
          payload: 'No tables found in schema.' 
        });
      }
    } catch (error: any) {
      self.postMessage({ 
        type: 'PARSE_ERROR', 
        payload: error.message || 'Unknown error during parsing' 
      });
    }
  } else if (type === 'SEARCH') {
    const { schema, searchTerm } = payload;
    if (!searchTerm.trim() || !schema) {
      self.postMessage({ type: 'SEARCH_COMPLETE', payload: [] });
      return;
    }

    const query = searchTerm.toLowerCase();
    const results = [];

    for (const table of schema.tables) {
      if (table.name.toLowerCase().includes(query)) {
        results.push({ type: 'table', table: table.name });
      }
      for (const col of table.columns) {
        if (col.name.toLowerCase().includes(query)) {
          results.push({ type: 'column', table: table.name, column: col.name });
        }
      }
    }

    self.postMessage({ type: 'SEARCH_COMPLETE', payload: results.slice(0, 10) });
  }
};