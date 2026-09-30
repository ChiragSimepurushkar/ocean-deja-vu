import React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

export const TooltipProvider = TooltipPrimitive.Provider;

export const Tooltip = ({ children, content, side = 'top' }) => {
  return (
    <TooltipPrimitive.Root delayDuration={200}>
      <TooltipPrimitive.Trigger asChild>
        {children}
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={5}
          style={{
            zIndex: 99999,
            background: 'var(--bg-panel, #1e293b)',
            color: 'var(--text-main, #f8fafc)',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '0.85rem',
            border: '1px solid var(--border, #334155)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            maxWidth: '300px',
            lineHeight: '1.4'
          }}
        >
          {content}
          <TooltipPrimitive.Arrow style={{ fill: 'var(--border, #334155)' }} />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
};
