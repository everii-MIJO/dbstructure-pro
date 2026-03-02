import React, { useState, useRef, useEffect } from 'react';

interface VirtualizedListProps {
  items: any[];
  itemHeight: number;
  height: number;
  renderItem: (item: any, style: React.CSSProperties) => React.ReactNode;
}

export const VirtualizedList: React.FC<VirtualizedListProps> = ({ items, itemHeight, height, renderItem }) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(
    startIndex + Math.ceil(height / itemHeight),
    items.length - 1
  );

  const visibleItems = items.slice(startIndex, endIndex + 1);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  return (
    <div
      ref={containerRef}
      style={{ height, overflowY: 'auto' }}
      onScroll={handleScroll}
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        {visibleItems.map((item, index) => {
          const actualIndex = startIndex + index;
          const element = renderItem(item, {
            position: 'absolute',
            top: `${actualIndex * itemHeight}px`,
            width: '100%',
            height: itemHeight,
          });

          if (React.isValidElement(element)) {
            return React.cloneElement(element, { key: actualIndex });
          }
          
          return element;
        })}
      </div>
    </div>
  );
};
