export interface Column {
  name: string;
  type: string;
  pk: boolean;
  fk: { table: string; column: string } | null;
  notNull: boolean;
  unique: boolean;
  defaultVal: string | null;
}

export interface Table {
  name: string;
  columns: Column[];
}

export interface Relationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
}

export interface Schema {
  tables: Table[];
  relationships: Relationship[];
  errors: string[];
  _rawSQL?: string;
  _rawDBML?: string;
  _format?: 'sql' | 'dbml';
}

export interface Note {
  id: number;
  text: string;
  checked: boolean;
  timestamp: string;
  isOwn?: boolean;
  table?: string; // Optional: name of the table this note is attached to
  attachment?: {
    name: string;
    type: string;
    content: string; // Base64 encoded file content
  };
}

export interface Position {
  x: number;
  y: number;
}

export interface Area {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
