import { useState, useRef, useEffect, type ReactNode } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      setPosition({
        top: triggerRect.bottom + 8,
        left: triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2,
      });
    }
  }, [visible]);

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      >
        {children}
      </span>
      {visible && (
        <div
          ref={tooltipRef}
          className="fixed z-50 rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-100 shadow-lg"
          style={{ top: position.top, left: position.left }}
        >
          {content}
        </div>
      )}
    </>
  );
}
