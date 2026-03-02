import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  ChevronRight, 
  Sun, 
  Moon, 
  Plus, 
  Maximize,
  BoxSelect
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { DiagramRef } from './Diagram/Diagram';
import { Logo } from './Logo';

interface ControlsProps {
  diagramRef: React.RefObject<DiagramRef>;
}

export const Controls: React.FC<ControlsProps> = ({ diagramRef }) => {
  const {
    schema, isDarkMode, searchTerm, isSelectionMode,
    setTheme, setSearchTerm, toggleSelectionMode
  } = useStore();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as any)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [searchResults, setSearchResults] = useState<{ type: 'table' | 'column', table: string, column?: string }[]>([]);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../worker.ts', import.meta.url), { type: 'module' });

    workerRef.current.onmessage = (e) => {
      if (e.data.type === 'SEARCH_COMPLETE') {
        setSearchResults(e.data.payload);
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  useEffect(() => {
    if (debouncedSearchTerm.trim() && schema && workerRef.current) {
      workerRef.current.postMessage({ 
        type: 'SEARCH', 
        payload: { schema, searchTerm: debouncedSearchTerm } 
      });
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearchTerm, schema]);

  return (
    <header className="fixed top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div className="bg-[var(--bg-panel)]/80 backdrop-blur-xl border border-[var(--border)] rounded-full shadow-2xl shadow-black/5 p-2 flex items-center gap-2 pointer-events-auto transition-all hover:shadow-3xl hover:border-accent/20">
        
        <div className="flex items-center gap-2 pl-3 pr-2">
          <Logo />
        </div>

        <div className="h-6 w-px bg-[var(--border)]/50"></div>

        {/* Center: Search */}
        <div className="relative" ref={searchRef}>
          <div className="relative group">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-accent transition-colors" />
            <input 
              type="text" 
              placeholder="Search..."
              className="w-48 focus:w-72 bg-transparent text-sm text-[var(--text)] placeholder-[var(--text-muted)]/70 rounded-full py-2.5 pl-10 pr-4 transition-all outline-none"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setIsSearchOpen(false);
              }}
            />
          </div>

          <AnimatePresence>
            {isSearchOpen && searchTerm.trim() && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-80 bg-[var(--bg-panel)]/95 backdrop-blur-xl border border-[var(--border)] rounded-2xl shadow-2xl z-[100] overflow-hidden"
              >
                {searchResults.length > 0 ? (
                  <div className="max-h-64 overflow-y-auto custom-scrollbar py-2">
                    {searchResults.map((res, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          diagramRef.current?.jumpToTable(res.table);
                          setIsSearchOpen(false);
                          setSearchTerm('');
                        }}
                        className="w-full px-4 py-2.5 text-left hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-between group transition-colors"
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-[var(--text)] group-hover:text-accent transition-colors">
                            {res.type === 'column' ? res.column : res.table}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)]">
                            {res.type === 'column' ? `in ${res.table}` : 'Table'}
                          </span>
                        </div>
                        <ChevronRight size={14} className="text-[var(--text-muted)] group-hover:text-accent group-hover:translate-x-1 transition-all" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                    No results for "<span className="text-[var(--text)]">{searchTerm}</span>"
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {schema && (
          <div className="hidden md:flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] border-l border-[var(--border)]/50 pl-4 ml-2">
            <span className="hover:text-[var(--text)] transition-colors cursor-default">
              {schema.tables.length} Tabellen
            </span>
            <span className="hover:text-[var(--text)] transition-colors cursor-default">
              {schema.relationships.length} Referenzen
            </span>
          </div>
        )}

        <div className="h-6 w-px bg-[var(--border)]/50 mx-2"></div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 pr-2">
          <button 
            onClick={toggleSelectionMode}
            className={`p-2.5 rounded-full transition-all ${isSelectionMode ? 'bg-[var(--accent)] text-[var(--accent-text)] shadow-lg shadow-accent/20' : 'hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text)]'}`}
            title={isSelectionMode ? "Selection Mode Active" : "Enable Selection Mode"}
          >
            <BoxSelect size={18} />
          </button>

          <button 
            onClick={() => diagramRef.current?.fitView()}
            className="p-2.5 hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text)] rounded-full transition-all"
            title="Fit View"
          >
            <Maximize size={18} />
          </button>

          <button 
            onClick={() => setTheme(!isDarkMode)}
            className="p-2.5 hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text)] rounded-full transition-all"
            title={isDarkMode ? "Light Mode" : "Dark Mode"}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>
    </header>
  );
};
