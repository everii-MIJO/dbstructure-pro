import { create } from 'zustand';
import { getColumnPositions } from './selectors';
import { 
  Node, 
  Edge, 
  OnNodesChange, 
  OnEdgesChange, 
  applyNodeChanges, 
  applyEdgeChanges,
} from '@xyflow/react';
import { Schema, Note } from '../types';

interface AppState {
  // Data
  schema: Schema | null;
  nodes: Node[];
  edges: Edge[];
  notes: Note[];
  
  // UI State
  isDarkMode: boolean;
  searchTerm: string;
  isLoaded: boolean;
  isSidebarOpen: boolean;
  isNotesOpen: boolean;
  isSelectionMode: boolean;
  
  // Interaction State
  activeColumn: { table: string; column: string } | null;
  focusedTable: string | null;
  relatedNodes: Set<string> | null;
  pkPopover: { table: string, column: string, x: number, y: number } | null;
  fkPopover: { table: string, column: string, x: number, y: number } | null;
  fkRelationships: Map<string, any[]>;
  pkReferences: Map<string, any[]>;
  columnPositions: Map<string, { x: number, y: number, side: 'left' | 'right' }>;
  
  // Actions
  setSchema: (schema: Schema | null) => void;
  setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
  setNotes: (notes: Note[] | ((notes: Note[]) => Note[])) => void;
  addNote: (note: Note) => void;
  updateNote: (id: number, updates: Partial<Note>) => void;
  deleteNote: (id: number) => void;
  
  setTheme: (isDark: boolean) => void;
  setSearchTerm: (term: string) => void;
  setIsLoaded: (isLoaded: boolean) => void;
  toggleSidebar: () => void;
  toggleNotes: (isOpen?: boolean) => void;
  toggleSelectionMode: () => void;
  
  setActiveColumn: (col: { table: string; column: string } | null) => void;
  setFocusedTable: (tableId: string | null) => void;
  setPkPopover: (popover: { table: string, column: string, x: number, y: number } | null) => void;
  setFkPopover: (popover: { table: string, column: string, x: number, y: number } | null) => void;
  
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onNodeDragStart: (event: any, node: Node) => void;
  onNodeDragStop: (event: any, node: Node) => void;
  
  onNodePositionChange: (nodeId: string, position: { x: number, y: number }) => void;
  jumpToTable: (tableName: string, fitView?: (options: any) => void) => void;
  buildRelationshipMaps: () => void;
  updateColumnPositions: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  // Initial State
  schema: null,
  nodes: [],
  edges: [],
  notes: [],
  
  isDarkMode: true,
  searchTerm: '',
  isLoaded: false,
  isSidebarOpen: true,
  isNotesOpen: false,
  isSelectionMode: false,
  
  activeColumn: null,
  focusedTable: null,
  relatedNodes: null,
  pkPopover: null,
  fkPopover: null,
  fkRelationships: new Map(),
  pkReferences: new Map(),
  columnPositions: new Map(),
  
  // Actions
  setSchema: (schema) => {
    set({ schema });
    if (schema) {
      get().buildRelationshipMaps();
      get().updateColumnPositions();
    }
  },
  setNodes: (nodes) => set((state) => ({ 
    nodes: typeof nodes === 'function' ? nodes(state.nodes) : nodes 
  })),
  setEdges: (edges) => set((state) => ({ 
    edges: typeof edges === 'function' ? edges(state.edges) : edges 
  })),
  setNotes: (notes) => set((state) => ({ 
    notes: typeof notes === 'function' ? notes(state.notes) : notes 
  })),
  
  addNote: (note) => set((state) => ({ notes: [note, ...state.notes] })),
  updateNote: (id, updates) => set((state) => ({
    notes: state.notes.map((n) => (n.id === id ? { ...n, ...updates } : n))
  })),
  deleteNote: (id) => set((state) => ({
    notes: state.notes.filter((n) => n.id !== id)
  })),
  
  setTheme: (isDarkMode) => set({ isDarkMode }),
  setSearchTerm: (searchTerm) => set({ searchTerm }),
  setIsLoaded: (isLoaded) => set({ isLoaded }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  toggleNotes: (isOpen) => set((state) => ({ isNotesOpen: isOpen ?? !state.isNotesOpen })),
  toggleSelectionMode: () => set((state) => ({ isSelectionMode: !state.isSelectionMode })),
  
  setActiveColumn: (activeColumn) => set({ activeColumn }),
  setPkPopover: (pkPopover) => {
    set({ pkPopover: null });
    requestAnimationFrame(() => {
      set({ pkPopover });
    });
  },
  setFkPopover: (fkPopover) => {
    set({ fkPopover: null });
    requestAnimationFrame(() => {
      set({ fkPopover });
    });
  },
  
  setFocusedTable: (focusedTable) => {
    if (!focusedTable) {
      set({ focusedTable: null, relatedNodes: null });
      return;
    }
    
    const { edges } = get();
    const related = new Set<string>();
    related.add(focusedTable);
    
    edges.forEach(edge => {
      if (edge.source === focusedTable) related.add(edge.target);
      if (edge.target === focusedTable) related.add(edge.source);
    });
    
    set({ focusedTable, relatedNodes: related });
  },
  
  onNodesChange: (changes) => {
    const newNodes = applyNodeChanges(changes, get().nodes);
    set({ nodes: newNodes });
    get().updateColumnPositions();
  },
  
  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },

  onNodeDragStart: (event, node) => {
    set({ pkPopover: null, fkPopover: null });
  },

  onNodeDragStop: (event, node) => {
       const positions = JSON.parse(localStorage.getItem('dbstructure_positions') || '{}');
       positions[node.id] = node.position;
       localStorage.setItem('dbstructure_positions', JSON.stringify(positions));
       
       get().onNodePositionChange(node.id, node.position);
  },

  onNodePositionChange: (nodeId, position) => {
    set((state) => ({
      nodes: state.nodes.map(n => n.id === nodeId ? { ...n, position } : n)
    }));
    get().updateColumnPositions();
  },

  updateColumnPositions: () => {
    const { nodes } = get();
    const newPositions = getColumnPositions({ nodes });
    set({ columnPositions: newPositions });
  },

  buildRelationshipMaps: () => {
    const { schema } = get();
    if (!schema) return;

    const fkRelationships = new Map<string, any[]>();
    const pkReferences = new Map<string, any[]>();

    schema.relationships.forEach(rel => {
      const fromKey = `${rel.fromTable}.${rel.fromColumn}`;
      if (!fkRelationships.has(fromKey)) {
        fkRelationships.set(fromKey, []);
      }
      fkRelationships.get(fromKey)!.push(rel);

      const toKey = `${rel.toTable}.${rel.toColumn}`;
      if (!pkReferences.has(toKey)) {
        pkReferences.set(toKey, []);
      }
      pkReferences.get(toKey)!.push(rel);
    });

    set({ fkRelationships, pkReferences });
  },

  jumpToTable: (tableName, fitView) => {
    const { nodes } = get();
    const node = nodes.find(n => n.id === tableName);
    if (node) {
      if (fitView) {
        fitView({ nodes: [node], duration: 800, padding: 0.5 });
      }
      get().setFocusedTable(tableName);
      set(state => ({
        nodes: state.nodes.map(n => ({
          ...n,
          selected: n.id === tableName
        }))
      }));
    }
  }
}));