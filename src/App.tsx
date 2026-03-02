import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Database, 
  Trash2, 
  X,
  StickyNote,
  ChevronRight,
  Search,
  Check,
  Sun,
  Moon,
  Loader2,
  Plus,
  Maximize,
  Lock,
  Unlock
} from 'lucide-react';
import { Node as RFNode, Edge, ReactFlowInstance } from '@xyflow/react';
import { Schema, Note } from './types';
import { Diagram, DiagramRef } from './components/Diagram/Diagram';
import { Logo } from './components/Logo';
import { Controls } from './components/Controls';
import clsx from 'clsx';
import schemaPart1 from './initial_schema_part1.dbml?raw';
import schemaPart2 from './initial_schema_part2.dbml?raw';
import schemaPart3 from './initial_schema_part3.dbml?raw';
import schemaPart4 from './initial_schema_part4.dbml?raw';
import { useStore } from './store/useStore';
import { db, auth } from './lib/firebase';
import { ref, onValue, set as firebaseSet, get } from 'firebase/database';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

const processNodes = (nodes: any[]) => {
  if (!nodes) return [];
  const areaNodes = nodes.filter(n => n.type !== 'table');
  const areaMap = new Map(areaNodes.map(n => [n.id, n]));
  
  return nodes
    .filter(n => n.type === 'table')
    .map(n => {
      if (n.parentId) {
        const parent = areaMap.get(n.parentId);
        return {
          ...n,
          parentId: undefined,
          position: parent ? {
            x: n.position.x + parent.position.x,
            y: n.position.y + parent.position.y
          } : n.position
        };
      }
      return n;
    });
};

export default function App() {
  const {
    schema, notes, isNotesOpen, isDarkMode, searchTerm, isLoaded,
    setSchema, setNodes, setEdges, setNotes, toggleNotes, setTheme, setSearchTerm, setIsLoaded,
    addNote: addNoteStore, updateNote, deleteNote: deleteNoteStore,
    onNodePositionChange
  } = useStore();

  const [noteInput, setNoteInput] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const diagramRef = React.useRef<DiagramRef>(null);
  const searchRef = React.useRef<HTMLDivElement>(null);
  const workerRef = useRef<Worker | null>(null);

  const handleAdminToggle = () => {
    if (isAdmin) {
      if (auth) signOut(auth);
      setIsAdmin(false);
    } else {
      setShowLoginModal(true);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!auth) {
      setLoginError('Firebase Auth is not initialized.');
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      setShowLoginModal(false);
      setLoginEmail('');
      setLoginPassword('');
    } catch (error: any) {
      setLoginError('Invalid email or password.');
    }
  };

  // Listen to Auth State
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAdmin(!!user);
    });
    return () => unsubscribe();
  }, []);

  // Initialize Worker
  useEffect(() => {
    workerRef.current = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    
    workerRef.current.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === 'PARSE_COMPLETE') {
        const { schema, nodes, edges } = payload;
        setSchema(schema);
        setNodes(nodes);
        setEdges(edges);
        setIsLoaded(true);
      } else if (type === 'PARSE_ERROR') {
        console.error('Worker parsing error:', payload);
        setIsLoaded(true); // Stop loading even on error
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, [setSchema, setNodes, setEdges, setIsLoaded]);

  // Apply theme
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as any)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load theme and initial schema
  useEffect(() => {
    const savedTheme = localStorage.getItem('dbstructure_theme');
    if (savedTheme) setTheme(savedTheme === 'dark');

    const loadData = async () => {
      let serverData = null;
      try {
        if (db) {
          const snapshot = await get(ref(db, 'dbstructure'));
          if (snapshot.exists()) {
            serverData = snapshot.val();
          }
        }
      } catch (e) {
        console.error("Failed to fetch data from Firebase:", e);
      }

      const savedData = localStorage.getItem('dbstructure_data');
      let localData = null;
      if (savedData) {
        try {
          localData = JSON.parse(savedData);
        } catch (e) {
          console.error("Failed to load saved data:", e);
        }
      }

      if (serverData && localData && localData.schema) {
        // Merge: use server schema, but keep local node positions
        const localPositions = new Map(localData.nodes.map((n: any) => [n.id, n.position]));
        const mergedNodes = serverData.nodes.map((n: any) => ({
          ...n,
          position: localPositions.get(n.id) || n.position
        }));
        setSchema(serverData.schema);
        setNodes(processNodes(mergedNodes));
        setEdges(serverData.edges || []);
        setNotes(serverData.notes || localData.notes || []);
        setIsLoaded(true);
      } else if (serverData) {
        setSchema(serverData.schema);
        setNodes(processNodes(serverData.nodes));
        setEdges(serverData.edges || []);
        setNotes(serverData.notes || []);
        setIsLoaded(true);
      } else if (localData && localData.schema) {
        setSchema(localData.schema);
        setNodes(processNodes(localData.nodes));
        setEdges(localData.edges || []);
        setNotes(localData.notes || []);
        setIsLoaded(true);
      } else {
        // Fallback: Combine and parse the initial schema using Worker
        const fullSchema = [
          schemaPart1,
          schemaPart2,
          schemaPart3,
          schemaPart4
        ].join('\n\n');
        
        if (workerRef.current) {
          workerRef.current.postMessage({ type: 'PARSE_DBML', payload: fullSchema });
        } else {
          console.error("Worker not initialized");
        }
      }

      // Set up real-time listener
      let unsubscribe = () => {};
      if (db) {
        unsubscribe = onValue(ref(db, 'dbstructure'), (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            // Only update notes from remote to avoid layout jumping while dragging
            if (data.notes) {
              useStore.getState().setNotes(data.notes);
            }
          }
        });
      }

      return () => unsubscribe();
    };

    const cleanup = loadData();
    return () => {
      cleanup.then(unsub => {
        if (unsub) unsub();
      });
    };
  }, []);

  // Save changes to localStorage and Firebase (debounced)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let isInitialLoad = true;
    
    const unsub = useStore.subscribe((state) => {
      if (!state.isLoaded) return;
      if (isInitialLoad) {
        isInitialLoad = false;
        return;
      }
      
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const data = {
          schema: state.schema,
          nodes: state.nodes,
          edges: state.edges,
          notes: state.notes
        };

        // Save to localStorage
        localStorage.setItem('dbstructure_data', JSON.stringify(data));
        localStorage.setItem('dbstructure_theme', state.isDarkMode ? 'dark' : 'light');

        // Save to Firebase
        if (db) {
          try {
            firebaseSet(ref(db, 'dbstructure'), data);
          } catch (e) {
            console.error("Failed to save to Firebase:", e);
          }
        }
      }, 1000); // 1s debounce for Firebase
    });

    return () => {
      unsub();
      clearTimeout(timeoutId);
    };
  }, []);

  const addNote = () => {
    if (!noteInput.trim()) return;
    const newNote: Note = {
      id: Date.now(),
      text: noteInput,
      checked: false,
      timestamp: new Date().toISOString(),
      isOwn: true, // Mark as own note
    };
    addNoteStore(newNote);
    setNoteInput('');
  };

  const toggleNote = (id: number) => {
    const note = notes.find(n => n.id === id);
    if (note) updateNote(id, { checked: !note.checked });
  };

  const deleteNote = (id: number) => {
    deleteNoteStore(id);
  };

  return (
    <div 
      className="flex flex-col h-screen bg-[var(--bg)] text-[var(--text)] overflow-hidden font-sans relative"
    >
      <main className="flex-1 relative overflow-hidden">
        {!isLoaded ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-10">
            <Loader2 className="animate-spin text-accent mb-4" size={48} />
            <h2 className="text-xl font-bold text-[var(--text-muted)]">Loading database...</h2>
          </div>
        ) : schema ? (
          <>
            <Diagram 
              ref={diagramRef}
              schema={schema}
              isDarkMode={isDarkMode}
              onNodePositionChange={onNodePositionChange}
            />
            <Controls diagramRef={diagramRef} />
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-10">
            <Database className="text-[var(--text-muted)] opacity-20 mb-6" size={80} />
            <h2 className="text-2xl font-bold text-[var(--text-muted)] mb-2">No schema loaded</h2>
            <p className="text-[var(--text-muted)] max-w-md mb-8">
              The database schema is loaded from the code.
            </p>
          </div>
        )}

        {/* Notes Toggle */}
        <button 
          onClick={() => toggleNotes(!isNotesOpen)}
          style={{ transitionDuration: '300ms', transitionTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)' }}
          className={clsx(
            "fixed right-0 top-1/2 -translate-y-1/2 bg-[var(--bg-card)] border border-[var(--border-muted)] border-r-0 rounded-l-lg p-3 text-[var(--text-muted)] hover:text-[var(--text)] transition-all z-40 shadow-xl",
            isNotesOpen && "right-[400px]"
          )}
        >
          {isNotesOpen ? <ChevronRight size={20} /> : <StickyNote size={20} />}
        </button>

        {/* Notes Panel */}
        <AnimatePresence>
          {isNotesOpen && (
            <motion.div 
              initial={{ x: 400 }}
              animate={{ x: 0 }}
              exit={{ x: 400 }}
              transition={{ type: "tween", ease: "easeOut", duration: 0.3 }}
              className="fixed right-0 top-0 w-[400px] h-full bg-[var(--bg-panel)] border-l border-[var(--border-muted)] z-50 flex flex-col shadow-2xl"
            >
              <div className="p-6 bg-transparent flex items-center justify-between border-b border-[var(--border-muted)]/30">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-medium tracking-tight flex items-center gap-2 text-[var(--text)]">
                    <StickyNote size={18} className="text-accent" />
                    Notizen
                  </h3>
                  <button
                    onClick={handleAdminToggle}
                    className={clsx(
                      "p-1.5 rounded-md transition-all flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider",
                      isAdmin 
                        ? "bg-accent/10 text-accent hover:bg-accent/20" 
                        : "bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border-muted)]"
                    )}
                    title={isAdmin ? "Admin-Modus beenden" : "Admin-Modus aktivieren"}
                  >
                    {isAdmin ? <Unlock size={12} /> : <Lock size={12} />}
                    {isAdmin && "Admin"}
                  </button>
                </div>
                <button 
                  onClick={() => toggleNotes(false)} 
                  className="p-2 rounded-full hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text)] transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 pb-4">
                <div className="relative group">
                  <textarea 
                    className="w-full h-28 bg-[var(--bg-card)] border border-[var(--border-muted)] rounded-xl p-4 text-sm outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-all resize-none shadow-sm"
                    placeholder="Neue Notiz hinzufügen..."
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        addNote();
                      }
                    }}
                  />
                  <div className="absolute bottom-3 right-3 flex items-center gap-2">
                    <span className="text-[10px] text-[var(--text-muted)] opacity-0 group-focus-within:opacity-100 transition-opacity">
                      ⌘ + Enter
                    </span>
                    <button 
                      onClick={addNote}
                      disabled={!noteInput.trim()}
                      className="p-1.5 bg-[var(--text)] hover:bg-[var(--text)]/90 text-[var(--bg)] rounded-lg transition-all active:scale-95 disabled:opacity-30 disabled:scale-100"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-auto px-6 space-y-3 pb-10 custom-scrollbar">
                <AnimatePresence initial={false}>
                  {notes.length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center py-16"
                    >
                      <div className="w-12 h-12 bg-[var(--bg-card)] rounded-full flex items-center justify-center mx-auto mb-4 border border-[var(--border-muted)]">
                        <StickyNote size={20} className="text-accent" />
                      </div>
                      <p className="text-sm text-[var(--text-muted)] font-medium">Keine Notizen</p>
                    </motion.div>
                  ) : (
                    notes.map((note, index) => (
                      <motion.div 
                        key={note.id} 
                        initial={{ opacity: 0, x: 20, y: 10 }}
                        animate={{ opacity: 1, x: 0, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ delay: index * 0.05 }}
                        className={clsx(
                          "group relative p-4 rounded-xl border transition-all duration-200",
                          note.checked 
                            ? "bg-transparent border-transparent opacity-50" 
                            : "bg-[var(--bg-card)] border-[var(--border-muted)] shadow-sm hover:shadow-md"
                        )}
                      >
                        <div className="flex gap-3">
                          <button 
                            onClick={() => isAdmin && toggleNote(note.id)}
                            disabled={!isAdmin}
                            className={clsx(
                              "mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center transition-all shrink-0",
                              note.checked 
                                ? "bg-[var(--text)] border-[var(--text)]" 
                                : "border-[var(--text-muted)]",
                              isAdmin 
                                ? "hover:border-[var(--text)] cursor-pointer" 
                                : "cursor-default opacity-60"
                            )}
                          >
                            {note.checked && <Check size={10} className="text-[var(--bg)]" />}
                          </button>
                          
                          <div className="flex-1 min-w-0">
                            <p className={clsx(
                              "text-sm leading-relaxed break-words transition-all",
                              note.checked ? "line-through text-[var(--text-muted)]" : "text-[var(--text)]"
                            )}>
                              {note.text}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-[10px] text-[var(--text-muted)]">
                                {new Date(note.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </span>
                              
                              {isAdmin && (
                                <button 
                                  onClick={() => deleteNote(note.id)}
                                  className="p-1 rounded-md text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[var(--bg)] p-6 rounded-xl shadow-2xl w-full max-w-sm border border-[var(--border)]"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-[var(--text)]">Admin Login</h2>
                <button onClick={() => setShowLoginModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Email</label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg-secondary)] text-[var(--text)] focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Password</label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg-secondary)] text-[var(--text)] focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />
                </div>
                {loginError && <p className="text-red-500 text-sm">{loginError}</p>}
                <button
                  type="submit"
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                >
                  Login
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
