// src/ui/components/GameBoardView.tsx
import React from 'react';
import { Stage, Layer, Rect, Circle, Text, Group, Line } from 'react-konva';
import { LevelConfig, SignalState, AssignedGates, GateType } from '../../types/circuit';

interface GameBoardViewProps {
  levelConfig: LevelConfig;
  assignedGates: AssignedGates;
  wireStates?: Record<string, SignalState>;
  onPlaceGate: (slotId: string, gate: GateType) => void;
  onRemoveGate: (slotId: string) => void;
}

const CANVAS_WIDTH = 850;
const CANVAS_HEIGHT = 420;

export const GameBoardView: React.FC<GameBoardViewProps> = ({
  assignedGates,
  wireStates = {},
  onPlaceGate,
  onRemoveGate,
}) => {
  const inA_Pos = { x: 200, y: 150 };
  const inB_Pos = { x: 200, y: 270 };

  const slotPos = { x: 380, y: 160, width: 120, height: 80 };
  const slotPin0 = { x: slotPos.x, y: slotPos.y + 25 };
  const slotPin1 = { x: slotPos.x, y: slotPos.y + 55 };
  const slotOutPin = { x: slotPos.x + slotPos.width, y: slotPos.y + 40 };

  const outputPos = { x: 700, y: 200 };

  const currentGate = assignedGates['slot_1'];
  const isHighA = wireStates['in_A'] === 1;
  const isHighB = wireStates['in_B'] === 1;
  const outputSignal = wireStates['out_Y'] === 1;

  // Miro-style Orthogonal Wire Helper
  const renderOrthogonalWire = (
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    isHigh: boolean
  ) => {
    const midX = startX + (endX - startX) / 2;
    return (
      <Line
        points={[startX, startY, midX, startY, midX, endY, endX, endY]}
        stroke={isHigh ? '#EAB308' : '#D1D5DB'}
        strokeWidth={isHigh ? 4 : 3}
        cornerRadius={12}
        lineCap="round"
        lineJoin="round"
      />
    );
  };

  // Drag over drop target handling for HTML-to-Canvas drop
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const gate = e.dataTransfer.getData('gateType') as GateType;
    if (gate) {
      onPlaceGate('slot_1', gate);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ position: 'relative', width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
    >
      <Stage width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
        <Layer>
          {/* Board Background */}
          <Rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="#FFFFFF" cornerRadius={20} />

          {/* --- WIRES --- */}
          {renderOrthogonalWire(inA_Pos.x + 15, inA_Pos.y, slotPin0.x, slotPin0.y, isHighA)}
          {renderOrthogonalWire(inB_Pos.x + 15, inB_Pos.y, slotPin1.x, slotPin1.y, isHighB)}
          {renderOrthogonalWire(slotOutPin.x, slotOutPin.y, outputPos.x - 24, outputPos.y, outputSignal)}

          {/* --- INPUT ANCHORS --- */}
          <Group x={inA_Pos.x} y={inA_Pos.y}>
            <Text text="⚡" fontSize={26} fill={isHighA ? '#EAB308' : '#9CA3AF'} offsetX={13} offsetY={13} />
            <Text text="1 (HIGH)" x={-80} y={-6} fontSize={12} fontStyle="bold" fill={isHighA ? '#CA8A04' : '#6B7280'} />
          </Group>

          <Group x={inB_Pos.x} y={inB_Pos.y}>
            <Text text="⚡" fontSize={26} fill={isHighB ? '#EAB308' : '#9CA3AF'} offsetX={13} offsetY={13} />
            <Text text="0 (LOW)" x={-80} y={-6} fontSize={12} fontStyle="bold" fill={isHighB ? '#CA8A04' : '#6B7280'} />
          </Group>

          {/* --- SLOT SOCKET --- */}
          <Group
            x={slotPos.x}
            y={slotPos.y}
            onClick={() => currentGate && onRemoveGate('slot_1')}
          >
            <Rect
              width={slotPos.width}
              height={slotPos.height}
              fill={currentGate ? '#F9FAFB' : '#FAFAFA'}
              stroke={currentGate ? '#3B82F6' : '#9CA3AF'}
              strokeWidth={2}
              dash={currentGate ? [] : [6, 6]}
              cornerRadius={14}
            />
            <Text
              text={currentGate ? currentGate : 'DROP GATE'}
              x={0}
              y={32}
              width={slotPos.width}
              align="center"
              fontSize={15}
              fontStyle="bold"
              fill={currentGate ? '#1D4ED8' : '#9CA3AF'}
            />
          </Group>

          {/* --- OUTPUT BULB --- */}
          <Group x={outputPos.x} y={outputPos.y}>
            {outputSignal && <Circle radius={28} fill="#FEF08A" opacity={0.6} />}
            <Circle
              radius={22}
              fill={outputSignal ? '#FACC15' : '#E5E7EB'}
              stroke={outputSignal ? '#EAB308' : '#9CA3AF'}
              strokeWidth={2}
            />
            <Text text="💡" fontSize={24} offsetX={12} offsetY={12} />
          </Group>
        </Layer>
      </Stage>
    </div>
  );
};