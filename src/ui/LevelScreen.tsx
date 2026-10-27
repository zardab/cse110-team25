// src/ui/LevelScreen.tsx
import React, { useState } from 'react';
import { Menu, RotateCcw, HelpCircle, Info } from 'lucide-react';
import { GameBoardView } from './components/GameBoardView';
import { LevelConfig, AssignedGates, GateType, SignalState } from '../types/circuit';

const LEVEL_1_CONFIG: LevelConfig = {
  id: 'level_01_intro',
  title: 'Level 1: The OR Gate',
  difficulty: 'EASY',
  availableGatePalette: { OR: 1, AND: 1, NOT: 1, XOR: 0, NAND: 0, NOR: 0, XNOR: 0 },
  primaryInputs: ['in_A', 'in_B'],
  primaryOutputs: ['out_Y'],
  executionOrder: ['slot_1'],
  slots: {
    slot_1: {
      id: 'slot_1',
      allowedGates: ['OR', 'AND', 'NOT'],
      inputs: [
        { sourceType: 'PRIMARY_INPUT', sourceId: 'in_A' },
        { sourceType: 'PRIMARY_INPUT', sourceId: 'in_B' },
      ],
      outputWireId: 'out_Y',
    },
  },
  truthTableTarget: [],
  hints: [],
};

export const LevelScreen: React.FC = () => {
  const [assignedGates, setAssignedGates] = useState<AssignedGates>({
    slot_1: null,
  });

  const evaluateWireStates = (): Record<string, SignalState> => {
    const in_A = 1;
    const in_B = 0;
    const gate = assignedGates['slot_1'];

    let out_Y: SignalState = 'FLOATING';
    if (gate === 'OR') out_Y = (in_A || in_B) as SignalState;
    if (gate === 'AND') out_Y = (in_A && in_B) as SignalState;
    if (gate === 'NOT') out_Y = in_A ? 0 : 1;

    return { in_A, in_B, out_Y };
  };

  const handlePlaceGate = (slotId: string, gate: GateType) => {
    setAssignedGates((prev) => ({ ...prev, [slotId]: gate }));
  };

  const handleRemoveGate = (slotId: string) => {
    setAssignedGates((prev) => ({ ...prev, [slotId]: null }));
  };

  const handleReset = () => {
    setAssignedGates({ slot_1: null });
  };

  const wireStates = evaluateWireStates();

  return (
    <div className="app-container">
      {/* 1. Top Navbar */}
      <header className="level-header">
        <Menu size={22} color="#374151" style={{ cursor: 'pointer' }} />
        <div className="level-progress-dots">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((lvl) => (
            <div
              key={lvl}
              className={`dot ${lvl === 1 ? 'current active' : ''}`}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <RotateCcw size={20} color="#374151" style={{ cursor: 'pointer' }} onClick={handleReset} />
          <HelpCircle size={20} color="#374151" style={{ cursor: 'pointer' }} />
        </div>
      </header>

      {/* 2. Workspace Card */}
      <div className="workspace-card">
        <div className="level-badge-container">
          <div className="level-badge">Level 1 / 12</div>
        </div>

        <GameBoardView
          levelConfig={LEVEL_1_CONFIG}
          assignedGates={assignedGates}
          wireStates={wireStates}
          onPlaceGate={handlePlaceGate}
          onRemoveGate={handleRemoveGate}
        />

        {/* Static Check Answer Button */}
        {/* <button className="check-answer-btn">Check Answer</button> */}
      </div>

      {/* 3. Bottom Gate Tray */}
      <footer className="palette-container">
        <div className="palette-header">
          <span>CLICK OR DRAG A GATE TO PLACE IN SLOT</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            CLICK <Info size={14} /> TO LEARN MORE
          </span>
        </div>

        <div className="palette-grid">
          {(['OR', 'AND', 'NOT'] as GateType[]).map((gate) => {
            const isSelected = assignedGates['slot_1'] === gate;
            return (
              <div
                key={gate}
                className="gate-card"
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.setData('gateType', gate);
                }}
                onClick={() => handlePlaceGate('slot_1', gate)}
                style={{
                  borderColor: isSelected ? '#3B82F6' : '#E5E7EB',
                  backgroundColor: isSelected ? '#EFF6FF' : '#F9FAFB',
                  borderWidth: isSelected ? '2px' : '1px',
                  cursor: 'grab',
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '14px' }}>{gate}</span>
              </div>
            );
          })}
        </div>
      </footer>
    </div>
  );
};