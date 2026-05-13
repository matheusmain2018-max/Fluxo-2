import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { CheckSquare, Square, User } from 'lucide-react';
import { UserProfile } from '../types';

interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

const CustomNode = ({ data, selected }: NodeProps) => {
  // Try all possible color sources from data
  const bgColor = data.color || data.background || '#171717';
  const checklist: ChecklistItem[] = data.checklist || [];
  const assignedTo: string | null = data.assignedTo || null;
  const profiles: Record<string, UserProfile> = data.profiles || {};
  const assignedProfile = assignedTo ? profiles[assignedTo] : null;
  const shape = data.shape || 'rounded';
  const notes = data.notes || '';
  
  const getShapeClasses = () => {
    switch (shape) {
      case 'rect': return 'rounded-none';
      case 'circle': return 'rounded-full aspect-square flex flex-col items-center justify-center text-center';
      case 'diamond': return 'rotate-45';
      default: return 'rounded-2xl';
    }
  };

  return (
    <div 
      className={`relative px-4 py-3 border-2 transition-all duration-200 shadow-lg ${getShapeClasses()} ${selected ? 'border-emerald-500 scale-105' : 'border-white/10'}`}
      style={{ 
        backgroundColor: bgColor,
        color: '#fff',
        minWidth: shape === 'circle' ? '140px' : '180px',
        boxShadow: selected ? `0 0 20px ${bgColor}66` : 'none',
        display: shape === 'circle' ? 'flex' : 'block'
      }}
    >
      {/* Assignment Badge */}
      {assignedProfile && (
        <div 
          className="absolute -top-3 -right-3 z-20 flex items-center justify-center scale-110"
          title={`Atribuído a: ${assignedProfile.displayName || 'Usuário'}`}
        >
          {assignedProfile.photoURL ? (
            <img 
              src={assignedProfile.photoURL} 
              className="w-10 h-10 rounded-full border-2 border-neutral-900 shadow-xl" 
              alt="" 
              referrerPolicy="no-referrer" 
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center border-2 border-neutral-900 shadow-xl">
              <span className="text-black font-bold text-xs">
                {(assignedProfile.displayName || 'U').charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
      )}

      <div className={shape === 'diamond' ? '-rotate-45' : ''}>
        {/* Top Handle (Combined) */}
        <Handle type="target" position={Position.Top} id="t-top" className="w-2.5 h-2.5 bg-emerald-500 border-2 border-neutral-900" style={{ left: '50%' }} />
        <Handle type="source" position={Position.Top} id="s-top" className="w-2.5 h-2.5 bg-emerald-500 border-2 border-neutral-900" style={{ left: '50%' }} />
        
        {/* Left Handle (Combined) */}
        <Handle type="target" position={Position.Left} id="t-left" className="w-2.5 h-2.5 bg-emerald-500 border-2 border-neutral-900" style={{ top: '50%' }} />
        <Handle type="source" position={Position.Left} id="s-left" className="w-2.5 h-2.5 bg-emerald-500 border-2 border-neutral-900" style={{ top: '50%' }} />
        
        <div className={`font-bold text-sm break-words mb-2 border-b border-white/10 pb-2 flex items-center justify-between gap-2`}>
          <span>{data.label}</span>
        </div>

        {notes && (
          <div className="text-[10px] text-white/60 mb-2 leading-tight italic line-clamp-3">
            {notes}
          </div>
        )}

        {checklist.length > 0 && (
          <div className="space-y-1.5 py-1">
            {checklist.map((item) => (
              <div 
                key={item.id} 
                className="flex items-start gap-2 text-left group"
                onClick={(e) => {
                  e.stopPropagation();
                  if (data.onToggleChecklistItem) {
                    data.onToggleChecklistItem(item.id);
                  }
                }}
              >
                <div className="mt-0.5 cursor-pointer">
                  {item.completed ? (
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-white/40 flex-shrink-0 group-hover:text-white/60" />
                  )}
                </div>
                <span className={`text-xs leading-tight ${item.completed ? 'text-white/40 line-through' : 'text-white/90'}`}>
                  {item.text}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Bottom Handle (Combined) */}
        <Handle type="target" position={Position.Bottom} id="t-bottom" className="w-2.5 h-2.5 bg-emerald-500 border-2 border-neutral-900" style={{ left: '50%' }} />
        <Handle type="source" position={Position.Bottom} id="s-bottom" className="w-2.5 h-2.5 bg-emerald-500 border-2 border-neutral-900" style={{ left: '50%' }} />
        
        {/* Right Handle (Combined) */}
        <Handle type="target" position={Position.Right} id="t-right" className="w-2.5 h-2.5 bg-emerald-500 border-2 border-neutral-900" style={{ top: '50%' }} />
        <Handle type="source" position={Position.Right} id="s-right" className="w-2.5 h-2.5 bg-emerald-500 border-2 border-neutral-900" style={{ top: '50%' }} />
      </div>
    </div>
  );
};

export default memo(CustomNode);
