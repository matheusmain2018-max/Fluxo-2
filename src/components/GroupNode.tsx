import React, { memo } from 'react';
import { NodeProps, Handle, Position } from 'reactflow';
import { Maximize2, Minimize2, Users } from 'lucide-react';

const GroupNode = ({ data, selected }: NodeProps) => {
  const isCollapsed = data.isCollapsed || false;
  const label = data.label || 'Nova Etapa';

  return (
    <div 
      className={`relative h-full w-full rounded-3xl border-2 transition-all duration-300 ${
        isCollapsed 
          ? 'bg-neutral-900 border-emerald-500/50 shadow-lg scale-90' 
          : 'bg-white/5 border-dashed border-white/20'
      } ${selected ? 'ring-2 ring-emerald-500 ring-offset-4 ring-offset-neutral-950' : ''}`}
      style={{
        minWidth: isCollapsed ? '160px' : '200px',
        minHeight: isCollapsed ? '60px' : '200px',
      }}
    >
      <div className={`p-4 flex items-center justify-between gap-3 ${isCollapsed ? 'h-full' : 'border-b border-white/10'}`}>
        <div className="flex items-center gap-2 overflow-hidden">
          <div className={`p-1.5 rounded-lg ${isCollapsed ? 'bg-emerald-500 text-black' : 'bg-white/10 text-white/50'}`}>
            <Users className="w-3.5 h-3.5" />
          </div>
          <span className={`font-bold text-sm truncate ${isCollapsed ? 'text-white' : 'text-white/40'}`}>
            {label}
          </span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (data.onToggleCollapse) {
              data.onToggleCollapse();
            }
          }}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          title={isCollapsed ? "Expandir Etapa" : "Minimizar Etapa"}
        >
          {isCollapsed ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="absolute inset-0 -z-10 pointer-events-none border-2 border-white/5 rounded-3xl m-2" />
      )}

      {/* Handles only active when collapsed to allow connections to the group itself */}
      <Handle type="target" position={Position.Left} className={`w-3 h-3 bg-emerald-500 !opacity-100 ${isCollapsed ? '' : 'invisible'}`} />
      <Handle type="source" position={Position.Right} className={`w-3 h-3 bg-emerald-500 !opacity-100 ${isCollapsed ? '' : 'invisible'}`} />
    </div>
  );
};

export default memo(GroupNode);
