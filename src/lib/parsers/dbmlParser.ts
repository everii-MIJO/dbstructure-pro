import { Schema, Table, Relationship } from '../../types';

export function parseDBML(dbml: string): Schema {
  const tables: Table[] = [];
  const relationships: Relationship[] = [];
  const errors: string[] = [];
  const tableMap: Record<string, Table> = {};

  if (!dbml || typeof dbml !== 'string') {
    return { tables, relationships, errors: ['No DBML provided.'] };
  }

  const cleanDbml = dbml.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

  const tableRegex = /Table\s+(\w+)(?:\s+as\s+\w+)?(?:\s*\[[^\]]*\])?\s*\{([^}]*)\}/gi;
  let match;
  while ((match = tableRegex.exec(cleanDbml)) !== null) {
    const tableName = match[1];
    const body = match[2];
    const table = parseTableBlock(tableName, body);
    if (table && !tableMap[table.name.toLowerCase()]) {
      tables.push(table);
      tableMap[table.name.toLowerCase()] = table;
    }
  }

  const refRegex = /Ref\s*:\s*([^{\n]+)/gi;
  while ((match = refRegex.exec(cleanDbml)) !== null) {
    const rel = parseRefStr(match[1]);
    if (rel) relationships.push(rel);
  }

  const namedRefRegex = /Ref\s+\w+\s*\{\s*([^}]+)\s*\}/gi;
  while ((match = namedRefRegex.exec(cleanDbml)) !== null) {
    const rel = parseRefStr(match[1]);
    if (rel) relationships.push(rel);
  }

  // Mark foreign keys in tables
  relationships.forEach(rel => {
    const table = tableMap[rel.fromTable.toLowerCase()];
    if (table) {
      const col = table.columns.find(c => c.name.toLowerCase() === rel.fromColumn.toLowerCase());
      if (col) {
        col.fk = { table: rel.toTable, column: rel.toColumn };
      }
    }
  });

  return { tables, relationships, errors, _rawDBML: dbml, _format: 'dbml' };
}

function parseTableBlock(name: string, body: string): Table {
  const columns: any[] = [];
  const lines = body.split('\n');
  lines.forEach(line => {
    line = line.trim();
    if (!line || /^(Note|Indexes|indexes):/i.test(line)) return;
    const match = line.match(/^(\w+)\s+(\w+(?:\([^)]*\))?)\s*(\[.*\])?/i);
    if (match) {
      const colName = match[1];
      const colType = match[2];
      const attrs = match[3] || '';
      columns.push({
        name: colName,
        type: colType,
        pk: /pk|primary\s+key|increment/i.test(attrs),
        fk: null,
        notNull: /not\s+null/i.test(attrs),
        unique: /unique/i.test(attrs),
        defaultVal: null
      });
    }
  });
  return { name, columns };
}

function parseRefStr(refStr: string): Relationship | null {
  const clean = refStr.replace(/\[[^\]]*\]/g, '').trim();
  const match = clean.match(/(\w+)\.(\w+)\s*([<>-])\s*(\w+)\.(\w+)/);
  if (!match) return null;

  const t1 = match[1], c1 = match[2], op = match[3], t2 = match[4], c2 = match[5];
  if (op === '>') return { fromTable: t1, fromColumn: c1, toTable: t2, toColumn: c2 };
  if (op === '<') return { fromTable: t2, fromColumn: c2, toTable: t1, toColumn: c1 };
  return { fromTable: t1, fromColumn: c1, toTable: t2, toColumn: c2 };
}
