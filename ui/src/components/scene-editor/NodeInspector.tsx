import { useState, useEffect } from 'react';
import { X, Save, Trash2 } from 'lucide-react';
import type { SceneNode, NodeConfig, SceneStartConfig, DelayConfig, LightingConfig, AudioConfig } from '@/types';
import { NODE_TYPES } from '@/types';
import { useSceneEditorStore, useControllersStore } from '@/state';

/**
 * Node configuration inspector panel
 */
export function NodeInspector() {
  const selectedNodeId = useSceneEditorStore((s) => s.selectedNodeId);
  const scene = useSceneEditorStore((s) => s.scene);
  const mode = useSceneEditorStore((s) => s.mode);
  const updateNodeConfig = useSceneEditorStore((s) => s.updateNodeConfig);
  const deleteNode = useSceneEditorStore((s) => s.deleteNode);
  const selectNode = useSceneEditorStore((s) => s.selectNode);
  const canEditNode = useSceneEditorStore((s) => s.canEditNode);

  const controllers = useControllersStore((s) => s.controllers);

  const selectedNode = scene?.nodes.find((n) => n.id === selectedNodeId);
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

  const nodeInfo = NODE_TYPES[selectedNode.type];

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
        {!canEdit && mode === 'live' && (
          <div className="mb-4 rounded bg-red-900/30 px-3 py-2 text-xs text-red-300">
            This node is active and cannot be edited
          </div>
        )}

        <NodeConfigForm
          node={selectedNode}
          onUpdate={(config) => updateNodeConfig(selectedNode.id, config)}
          disabled={!canEdit || mode === 'readonly'}
          controllers={Array.from(controllers.values())}
        />
      </div>

      {/* Actions */}
      {selectedNode.type !== 'scene_start' && (
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

interface NodeConfigFormProps {
  node: SceneNode;
  onUpdate: (config: NodeConfig) => void;
  disabled: boolean;
  controllers: Array<{ id: string; name: string; devices: Map<string, { logicalId: string; type: string }> }>;
}

function NodeConfigForm({ node, onUpdate, disabled, controllers }: NodeConfigFormProps) {
  // Local form state
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  // Initialize form data from node config
  useEffect(() => {
    if (node.config && node.config.type !== 'empty') {
      setFormData(node.config as unknown as Record<string, unknown>);
    } else {
      // Set defaults based on node type
      setFormData(getDefaultConfig(node.type));
    }
  }, [node.id, node.type]);

  const handleChange = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onUpdate(formData as unknown as NodeConfig);
  };

  // Render appropriate form based on node type
  switch (node.type) {
    case 'scene_start':
      return (
        <SceneStartForm
          data={formData as unknown as SceneStartConfig}
          onChange={handleChange}
          onSave={handleSave}
          disabled={disabled}
        />
      );

    case 'delay':
      return (
        <DelayForm
          data={formData as unknown as DelayConfig}
          onChange={handleChange}
          onSave={handleSave}
          disabled={disabled}
        />
      );

    case 'lighting':
      return (
        <LightingForm
          data={formData as unknown as LightingConfig}
          onChange={handleChange}
          onSave={handleSave}
          disabled={disabled}
          controllers={controllers}
        />
      );

    case 'audio':
      return (
        <AudioForm
          data={formData as unknown as AudioConfig}
          onChange={handleChange}
          onSave={handleSave}
          disabled={disabled}
          controllers={controllers}
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

function getDefaultConfig(type: string): Record<string, unknown> {
  switch (type) {
    case 'scene_start':
      return { type: 'scene_start', trigger: 'manual' };
    case 'delay':
      return { type: 'delay', duration: 1000 };
    case 'lighting':
      return { type: 'lighting', action: 'on', controllerId: '', deviceId: '' };
    case 'audio':
      return { type: 'audio', action: 'play', controllerId: '', deviceId: '' };
    case 'scene_end':
      return { type: 'scene_end', outcome: 'success' };
    default:
      return { type: 'empty' };
  }
}

// Form components for each node type

interface FormProps<T> {
  data: T;
  onChange: (field: string, value: unknown) => void;
  onSave: () => void;
  disabled: boolean;
}

function SceneStartForm({ data, onChange, onSave, disabled }: FormProps<SceneStartConfig>) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-xs text-zinc-400">Trigger Type</label>
        <select
          value={data.trigger || 'manual'}
          onChange={(e) => onChange('trigger', e.target.value)}
          disabled={disabled}
          className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        >
          <option value="manual">Manual</option>
          <option value="time_based">Time Based</option>
          <option value="backend_triggered">Backend Triggered</option>
        </select>
      </div>

      {data.trigger === 'time_based' && (
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Trigger Time</label>
          <input
            type="time"
            value={data.triggerTime || ''}
            onChange={(e) => onChange('triggerTime', e.target.value)}
            disabled={disabled}
            className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
          />
        </div>
      )}

      <SaveButton onClick={onSave} disabled={disabled} />
    </div>
  );
}

function DelayForm({ data, onChange, onSave, disabled }: FormProps<DelayConfig>) {
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

interface DeviceFormProps<T> extends FormProps<T> {
  controllers: Array<{ id: string; name: string; devices: Map<string, { logicalId: string; type: string }> }>;
}

function LightingForm({ data, onChange, onSave, disabled, controllers }: DeviceFormProps<LightingConfig>) {
  const selectedController = controllers.find((c) => c.id === data.controllerId);
  const devices = selectedController ? Array.from(selectedController.devices.values()).filter((d) => d.type === 'light') : [];

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
        <label className="mb-1 block text-xs text-zinc-400">Action</label>
        <select
          value={data.action || 'on'}
          onChange={(e) => onChange('action', e.target.value)}
          disabled={disabled}
          className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        >
          <option value="on">Turn On</option>
          <option value="off">Turn Off</option>
          <option value="set">Set Level</option>
          <option value="fade">Fade</option>
        </select>
      </div>

      {(data.action === 'set' || data.action === 'fade') && (
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Level (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            value={data.value || 100}
            onChange={(e) => onChange('value', parseInt(e.target.value) || 0)}
            disabled={disabled}
            className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
          />
        </div>
      )}

      <SaveButton onClick={onSave} disabled={disabled} />
    </div>
  );
}

function AudioForm({ data, onChange, onSave, disabled, controllers }: DeviceFormProps<AudioConfig>) {
  const selectedController = controllers.find((c) => c.id === data.controllerId);
  const devices = selectedController ? Array.from(selectedController.devices.values()).filter((d) => d.type === 'audio') : [];

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
        <label className="mb-1 block text-xs text-zinc-400">Action</label>
        <select
          value={data.action || 'play'}
          onChange={(e) => onChange('action', e.target.value)}
          disabled={disabled}
          className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        >
          <option value="play">Play</option>
          <option value="stop">Stop</option>
          <option value="pause">Pause</option>
          <option value="volume">Set Volume</option>
        </select>
      </div>

      {data.action === 'play' && (
        <>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Track ID</label>
            <input
              type="text"
              value={data.trackId || ''}
              onChange={(e) => onChange('trackId', e.target.value)}
              disabled={disabled}
              placeholder="Enter track ID..."
              className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="loop"
              checked={data.loop || false}
              onChange={(e) => onChange('loop', e.target.checked)}
              disabled={disabled}
              className="rounded border-zinc-600"
            />
            <label htmlFor="loop" className="text-sm text-zinc-300">
              Loop
            </label>
          </div>
        </>
      )}

      {data.action === 'volume' && (
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Volume (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            value={data.volume || 100}
            onChange={(e) => onChange('volume', parseInt(e.target.value) || 0)}
            disabled={disabled}
            className="w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
          />
        </div>
      )}

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
