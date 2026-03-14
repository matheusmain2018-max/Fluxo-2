import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

const CustomNode = ({ data, selected }: NodeProps) => {
  // Try all possible color sources from data
  const bgColor = data.color || data.background || '#171717';
  
  return (
    <div 
      className={`px-4 py-3 rounded-xl border-2 transition-all duration-200 shadow-lg ${selected ? 'border-emerald-500 scale-105' : 'border-white/10'}`}
      style={{ 
        backgroundColor: bgColor,
        color: '#fff',
        minWidth: '120px',
        textAlign: 'center',
        boxShadow: selected ? `0 0 20px ${bgColor}66` : 'none'
      }}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-emerald-500 border-2 border-neutral-900" />
      
      <div className="font-bold text-sm break-words">
        {data.label}
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-emerald-500 border-2 border-neutral-900" />
    </div>
  );
};

export default memo(CustomNode);
