import { useState, useEffect } from 'react';
import { X, Save, Trash2 } from 'lucide-react';
import type {
  PuzzleNode,
  PuzzleNodeConfig,
  SensorConditionConfig,
  CounterConfig,
  TimerConfig,
  StateCheckConfig,
  PuzzleLogicGateConfig,
  PuzzleDelayConfig,
  OutcomeSuccessConfig,
  OutcomeFailureConfig,
  OutcomeTimeoutConfig,
  OutcomeCustomConfig,
} from '@/types';
import { PUZZLE_NODE_TYPES } from '@/types';
import { usePuzzleEditorStore, useControllersStore } from '@/state';

/**
 * Puzzle node configuration inspector panel
 */
export function PuzzleNodeInspector() {
  const selectedNodeId = usePuzzleEditorStore((s) => s.selectedNodeId);
  const puzzle = usePuzzleEditorStore((s) => s.puzzle);
  const mode = usePuzzleEditorStore((s) => s.mode);
  const updateNodeConfig = usePuzzleEditorStore((s) => s.updateNodeConfig);
  const deleteNode = usePuzzleEditorStore((s) => s.deleteNode);
  const selectNode = usePuzzleEditorStore((s) => s.selectNode);
  const canEditNode = usePuzzleEditorStore((s) => s.canEditNode);

  const controllers = useControllersStore((s) => s.controllers);

  const selectedNode = puzzle?.nodes.find((n) => n.id === selectedNodeId);
  const canEdit = selectedNodeId ? canEditNode(selectedNodeId) : false;

  if (!selectedNode) {
    return (
      <div className="flex h-full w-64 flex-col border-l border-zinc-700 bg-zinc-800">
        <div className="border-b border-zinc-700 px-4 py-3">
          <h3 className="font-medium text-zinc-300">Inspector</h3>
        </div>
        <div className="flex flex-1 items-center justify-center p-4 text-sm text-zinc-500">
          Select a node to configure
        </div>
      </div>
    );
  }

  const nodeInfo = PUZZLE_NODE_TYPES[selectedNode.type];

  return (
    <div className="flex h-full w-64 flex-col border-l border-zinc-700 bg-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-3">
        <div>
          <h3 className="font-medium text-zinc-300">{nodeInfo.label}</h3>
          <p className="text-xs text-zinc-500">{selectedNode.name}</p>
        </div>
        <button
          onClick={() => selectNode(null)}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Configuration form */}
      <div className="flex-1 overflow-y-auto p-4">
        {!canEdit && (mode === 'live' || mode === 'stepping') && (
          <div className="mb-4 rounded bg-red-900/30 px-3 py-2 text-xs text-red-300">
            This node is active and cannot be edited
          </div>
        )}

        <PuzzleNodeConfigForm
          node={selectedNode}
          onUpdate={(config) => updateNodeConfig(selectedNode.id, config)}
          disabled={!canEdit || mode === 'readonly'}
          controllers={Array.from(controllers.values())}
        />
      </div>

      {/* Actions */}
      {selectedNode.type !== 'puzzle_start' && (
        <div className="border-t border-zinc-700 p-4">
          <button
            onClick={() => deleteNode(selectedNode.id)}
            disabled={!canEdit || mode === 'readonly'}
            className="flex w-full items-center justify-center gap-2 rounded bg-red-900/30 px-3 py-2 text-sm text-red-300 hover:bg-red-900/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete Node
          </button>
        </div>
      )}
    </div>
  );
}

interface PuzzleNodeConfigFormProps {
  node: PuzzleNode;
  onUpdate: (config: PuzzleNodeConfig) => void;
  disabled: boolean;
  controllers: Array<{ id: string; name: string; devices: Map<string, { logicalId: string; type: string }> }>;
}

function PuzzleNodeConfigForm({ node, onUpdate, disabled, controllers }: PuzzleNodeConfigFormProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (node.config && node.config.type !== 'empty') {
      setFormData(node.config as unknown as Record<string, unknown>);
    } else {
      setFormData(getDefaultPuzzleConfig(node.type));
    }
  }, [node.id, node.type]);

  const handleChange = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onUpdate(formData as unknown as PuzzleNodeConfig);
  };

  switch (node.type) {
    case 'puzzle_start':
      return (
        <div className="text-sm text-zinc-500">
          Puzzle Start is auto-triggered when the Scene activates this puzzle.
          <SaveButton onClick={handleSave} disabled={true} />
        </div>
      );

    case 'sensor_condition':
      return (
        <SensorConditionForm
          data={formData as unknown as SensorConditionConfig}
          onChange={handleChange}
          onSave={handleSave}
          disabled={disabled}
          controllers={controllers}
        />
      );

    case 'counter':
      return (
        <CounterForm
          data={formData as unknown as CounterConfig}
          onChange={handleChange}
          onSave={handleSave}
          disabled={disabled}
        />
      );

    case 'timer':
      return (
        <TimerForm
          data={formData as unknown as TimerConfig}
          onChange={handleChange}
          onSave={handleSave}
          disabled={disabled}
        />
      );

    case 'state_check':
      return (
        <StateCheckForm
          data={formData as unknown as StateCheckConfig}
          onChange={handleChange}
          onSave={handleSave}
          disabled={disabled}
          controllers={controllers}
        />
      );

    case 'logic_gate':
      return (
        <LogicGateForm
          data={formData as unknown as PuzzleLogicGateConfig}
          onChange={handleChange}
          onSave={handleSave}
          disabled={disabled}
        />
      );

    case 'delay':
      return (
        <DelayForm
          data={formData as unknown as PuzzleDelayConfig}
          onChange={handleChange}
          onSave={handleSave}
          disabled={disabled}
        />
      );

    case 'outcome_success':
      return (
        <OutcomeForm
          data={formData as unknown as OutcomeSuccessConfig}
          onChange={handleChange}
          onSave={handleSave}
          disabled={disabled}
          outcomeType="success"
        />
      );

    case 'outcome_failure':
      return (
        <OutcomeForm
          data={formData as unknown as OutcomeFailureConfig}
          onChange={handleChange}
          onSave={handleSave}
          disabled={disabled}
          outcomeType="failure"
        />
      );

    case 'outcome_timeout':
      return (
        <OutcomeForm
          data={formData as unknown as OutcomeTimeoutConfig}
          onChange={handleChange}
          onSave={handleSave}
          disabled={disabled}
          outcomeType="timeout"
        />
      );

    case 'outcome_custom':
      return (
        <OutcomeCustomForm
          data={formData as unknown as OutcomeCustomConfig}
          onChange={handleChange}
          onSave={handleSave}
          disabled={disabled}
        />
      );

    default:
      return (
        <div className="text-sm text-zinc-500">
          Configuration for {node.type} nodes coming soon
        </div>
      );
  }
}

function getDefaultPuzzleConfig(type: string): Record<string, unknown> {
  switch (type) {
    case 'puzzle_start':
      return { type: 'puzzle_start' };
    case 'sensor_condition':
      return { type: 'sensor_condition', sensorType: 'switch', condition: 'triggered', controllerId: '', deviceId: '' };
    case 'counter':
      return { type: 'counter', counterId: '', action: 'increment', initialValue: 0 };
    case 'timer':
      return { type: 'timer', timerId: '', action: 'start', mode: 'countdown', duration: 60000 };
    case 'state_check':
      return { type: 'state_check', controllerId: '', deviceId: '', property: '', condition: 'equals', expectedValue: '' };
    case 'logic_gate':
      return { type: 'logic_gate', gate: 'and', inputCount: 2 };
    case 'delay':
      return { type: 'delay', duration: 1000 };
    case 'outcome_success':
      return { type: 'outcome_success', label: 'Success', outputHandle: 'success' };
    case 'outcome_failure':
      return { type: 'outcome_failure', label: 'Failure', outputHandle: 'failure' };
    case 'outcome_timeout':
      return { type: 'outcome_timeout', label: 'Timeout', outputHandle: 'timeout' };
    case 'outcome_custom':
      return { type: 'outcome_custom', label: '', outputHandle: '', customType: '' };
    default:
      return { type: 'empty' };
  }
}

interface FormProps<T> {
  data: T;
  onChange: (field: string, value: unknown) => void;
  onSave: () => void;
  disabled: boolean;
}

interface DeviceFormProps<T> extends FormProps<T> {
  controllers: Array<{ id: string; name: string; devices: Map<string, { logicalId: string; type: string }> }>;
}

function SensorConditionForm({ data, onChange, onSave, disabled, controllers }: DeviceFormProps<SensorConditionConfig>) {
  const selectedController = controllers.find((c) => c.id === data.controllerId);
  const devices = selectedController ? Array.from(selectedController.devices.values()) : [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-xs text-zinc-400">Sensor Type</label>
        <select
          value={data.sensorType || 'switch'}
          onChange={(e) => onChange('sensorType', e.target.value)}
          disabled={disabled}
          className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        >
          <option value="switch">Switch</option>
          <option value="proximity">Proximity</option>
          <option value="pressure">Pressure</option>
          <option value="light">Light</option>
          <option value="rfid">RFID</option>
          <option value="magnetic">Magnetic</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-zinc-400">Controller</label>
        <select
          value={data.controllerId || ''}
          onChange={(e) => onChange('controllerId', e.target.value)}
          disabled={disabled}
          className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        >
          <option value="">Select controller...</option>
          {controllers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-zinc-400">Device</label>
        <select
          value={data.deviceId || ''}
          onChange={(e) => onChange('deviceId', e.target.value)}
          disabled={disabled || !data.controllerId}
          className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        >
          <option value="">Select device...</option>
          {devices.map((d) => (
            <option key={d.logicalId} value={d.logicalId}>{d.logicalId}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-zinc-400">Condition</label>
        <select
          value={data.condition || 'triggered'}
          onChange={(e) => onChange('condition', e.target.value)}
          disabled={disabled}
          className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        >
          <option value="triggered">Triggered</option>
          <option value="equals">Equals</option>
          <option value="not_equals">Not Equals</option>
          <option value="greater">Greater Than</option>
          <option value="less">Less Than</option>
          <option value="in_range">In Range</option>
        </select>
      </div>

      {(data.condition === 'equals' || data.condition === 'not_equals' || data.condition === 'greater' || data.condition === 'less') && (
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Target Value</label>
          <input
            type="text"
            value={String(data.targetValue ?? '')}
            onChange={(e) => onChange('targetValue', e.target.value)}
            disabled={disabled}
            className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
          />
        </div>
      )}

      <SaveButton onClick={onSave} disabled={disabled} />
    </div>
  );
}

function CounterForm({ data, onChange, onSave, disabled }: FormProps<CounterConfig>) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-xs text-zinc-400">Counter ID</label>
        <input
          type="text"
          value={data.counterId || ''}
          onChange={(e) => onChange('counterId', e.target.value)}
          disabled={disabled}
          placeholder="e.g., correct_answers"
          className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-zinc-400">Action</label>
        <select
          value={data.action || 'increment'}
          onChange={(e) => onChange('action', e.target.value)}
          disabled={disabled}
          className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        >
          <option value="increment">Increment</option>
          <option value="decrement">Decrement</option>
          <option value="reset">Reset</option>
          <option value="set">Set Value</option>
          <option value="check">Check Value</option>
        </select>
      </div>

      {data.action === 'set' && (
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Set Value</label>
          <input
            type="number"
            value={data.setValue ?? 0}
            onChange={(e) => onChange('setValue', parseInt(e.target.value) || 0)}
            disabled={disabled}
            className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
          />
        </div>
      )}

      {data.action === 'check' && (
        <>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Check Condition</label>
            <select
              value={data.checkCondition || 'equals'}
              onChange={(e) => onChange('checkCondition', e.target.value)}
              disabled={disabled}
              className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
            >
              <option value="equals">Equals</option>
              <option value="greater">Greater Than</option>
              <option value="less">Less Than</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Check Value</label>
            <input
              type="number"
              value={data.checkValue ?? 0}
              onChange={(e) => onChange('checkValue', parseInt(e.target.value) || 0)}
              disabled={disabled}
              className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
            />
          </div>
        </>
      )}

      <SaveButton onClick={onSave} disabled={disabled} />
    </div>
  );
}

function TimerForm({ data, onChange, onSave, disabled }: FormProps<TimerConfig>) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-xs text-zinc-400">Timer ID</label>
        <input
          type="text"
          value={data.timerId || ''}
          onChange={(e) => onChange('timerId', e.target.value)}
          disabled={disabled}
          placeholder="e.g., puzzle_timer"
          className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-zinc-400">Mode</label>
        <select
          value={data.mode || 'countdown'}
          onChange={(e) => onChange('mode', e.target.value)}
          disabled={disabled}
          className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        >
          <option value="countdown">Countdown</option>
          <option value="elapsed">Elapsed</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-zinc-400">Action</label>
        <select
          value={data.action || 'start'}
          onChange={(e) => onChange('action', e.target.value)}
          disabled={disabled}
          className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        >
          <option value="start">Start</option>
          <option value="stop">Stop</option>
          <option value="reset">Reset</option>
          <option value="check">Check</option>
        </select>
      </div>

      {data.mode === 'countdown' && data.action === 'start' && (
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Duration (seconds)</label>
          <input
            type="number"
            min="1"
            value={(data.duration || 60000) / 1000}
            onChange={(e) => onChange('duration', (parseInt(e.target.value) || 60) * 1000)}
            disabled={disabled}
            className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
          />
        </div>
      )}

      {data.action === 'check' && (
        <>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Check Condition</label>
            <select
              value={data.checkCondition || 'expired'}
              onChange={(e) => onChange('checkCondition', e.target.value)}
              disabled={disabled}
              className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
            >
              <option value="expired">Expired</option>
              <option value="remaining_less">Remaining Less Than</option>
              <option value="elapsed_greater">Elapsed Greater Than</option>
            </select>
          </div>
          {data.checkCondition !== 'expired' && (
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Check Value (seconds)</label>
              <input
                type="number"
                min="0"
                value={(data.checkValue || 0) / 1000}
                onChange={(e) => onChange('checkValue', (parseInt(e.target.value) || 0) * 1000)}
                disabled={disabled}
                className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
              />
            </div>
          )}
        </>
      )}

      <SaveButton onClick={onSave} disabled={disabled} />
    </div>
  );
}

function StateCheckForm({ data, onChange, onSave, disabled, controllers }: DeviceFormProps<StateCheckConfig>) {
  const selectedController = controllers.find((c) => c.id === data.controllerId);
  const devices = selectedController ? Array.from(selectedController.devices.values()) : [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-xs text-zinc-400">Controller</label>
        <select
          value={data.controllerId || ''}
          onChange={(e) => onChange('controllerId', e.target.value)}
          disabled={disabled}
          className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        >
          <option value="">Select controller...</option>
          {controllers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-zinc-400">Device</label>
        <select
          value={data.deviceId || ''}
          onChange={(e) => onChange('deviceId', e.target.value)}
          disabled={disabled || !data.controllerId}
          className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        >
          <option value="">Select device...</option>
          {devices.map((d) => (
            <option key={d.logicalId} value={d.logicalId}>{d.logicalId}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-zinc-400">Property</label>
        <input
          type="text"
          value={data.property || ''}
          onChange={(e) => onChange('property', e.target.value)}
          disabled={disabled}
          placeholder="e.g., state, position"
          className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-zinc-400">Condition</label>
        <select
          value={data.condition || 'equals'}
          onChange={(e) => onChange('condition', e.target.value)}
          disabled={disabled}
          className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        >
          <option value="equals">Equals</option>
          <option value="not_equals">Not Equals</option>
          <option value="contains">Contains</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-zinc-400">Expected Value</label>
        <input
          type="text"
          value={String(data.expectedValue ?? '')}
          onChange={(e) => onChange('expectedValue', e.target.value)}
          disabled={disabled}
          className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        />
      </div>

      <SaveButton onClick={onSave} disabled={disabled} />
    </div>
  );
}

function LogicGateForm({ data, onChange, onSave, disabled }: FormProps<PuzzleLogicGateConfig>) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-xs text-zinc-400">Gate Type</label>
        <select
          value={data.gate || 'and'}
          onChange={(e) => onChange('gate', e.target.value)}
          disabled={disabled}
          className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        >
          <option value="and">AND</option>
          <option value="or">OR</option>
          <option value="not">NOT</option>
          <option value="xor">XOR</option>
          <option value="nand">NAND</option>
        </select>
      </div>

      {data.gate !== 'not' && (
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Input Count</label>
          <input
            type="number"
            min="2"
            max="8"
            value={data.inputCount || 2}
            onChange={(e) => onChange('inputCount', parseInt(e.target.value) || 2)}
            disabled={disabled}
            className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
          />
        </div>
      )}

      <SaveButton onClick={onSave} disabled={disabled} />
    </div>
  );
}

function DelayForm({ data, onChange, onSave, disabled }: FormProps<PuzzleDelayConfig>) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-xs text-zinc-400">Duration (ms)</label>
        <input
          type="number"
          min="0"
          step="100"
          value={data.duration || 1000}
          onChange={(e) => onChange('duration', parseInt(e.target.value) || 0)}
          disabled={disabled}
          className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        />
      </div>

      <SaveButton onClick={onSave} disabled={disabled} />
    </div>
  );
}

interface OutcomeFormProps<T> extends FormProps<T> {
  outcomeType: 'success' | 'failure' | 'timeout';
}

function OutcomeForm({ data, onChange, onSave, disabled, outcomeType }: OutcomeFormProps<OutcomeSuccessConfig | OutcomeFailureConfig | OutcomeTimeoutConfig>) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-xs text-zinc-400">Label</label>
        <input
          type="text"
          value={data.label || ''}
          onChange={(e) => onChange('label', e.target.value)}
          disabled={disabled}
          placeholder={outcomeType.charAt(0).toUpperCase() + outcomeType.slice(1)}
          className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-zinc-400">Output Handle</label>
        <input
          type="text"
          value={data.outputHandle || ''}
          onChange={(e) => onChange('outputHandle', e.target.value)}
          disabled={disabled}
          placeholder={`e.g., ${outcomeType}`}
          className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        />
        <p className="mt-1 text-xs text-zinc-500">
          Maps to Scene puzzle node output
        </p>
      </div>

      <SaveButton onClick={onSave} disabled={disabled} />
    </div>
  );
}

function OutcomeCustomForm({ data, onChange, onSave, disabled }: FormProps<OutcomeCustomConfig>) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-xs text-zinc-400">Label</label>
        <input
          type="text"
          value={data.label || ''}
          onChange={(e) => onChange('label', e.target.value)}
          disabled={disabled}
          placeholder="Custom outcome label"
          className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-zinc-400">Custom Type</label>
        <input
          type="text"
          value={data.customType || ''}
          onChange={(e) => onChange('customType', e.target.value)}
          disabled={disabled}
          placeholder="e.g., partial_success"
          className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-zinc-400">Output Handle</label>
        <input
          type="text"
          value={data.outputHandle || ''}
          onChange={(e) => onChange('outputHandle', e.target.value)}
          disabled={disabled}
          placeholder="e.g., custom_outcome"
          className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        />
        <p className="mt-1 text-xs text-zinc-500">
          Maps to Scene puzzle node output
        </p>
      </div>

      <SaveButton onClick={onSave} disabled={disabled} />
    </div>
  );
}

function SaveButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Save className="h-4 w-4" />
      Save Configuration
    </button>
  );
}
