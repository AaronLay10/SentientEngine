package api

import (
	"net/http"
)

const operatorUIHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sentient Engine - Operator UI</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: monospace;
            background: #1a1a2e;
            color: #eee;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        header {
            background: #16213e;
            padding: 12px 20px;
            border-bottom: 1px solid #0f3460;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        header h1 { font-size: 16px; font-weight: normal; }
        #status {
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 12px;
        }
        #status.connected { background: #1b4332; color: #95d5b2; }
        #status.disconnected { background: #7f1d1d; color: #fca5a5; }
        #status.connecting { background: #78350f; color: #fcd34d; }
        main {
            flex: 1;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        #events {
            flex: 1;
            overflow-y: auto;
            padding: 10px;
        }
        .event {
            padding: 8px 12px;
            margin-bottom: 4px;
            background: #16213e;
            border-radius: 4px;
            border-left: 3px solid #0f3460;
            font-size: 13px;
            display: flex;
            gap: 12px;
            align-items: baseline;
        }
        .event.level-error { border-left-color: #dc2626; background: #1f1515; }
        .event.level-info { border-left-color: #2563eb; }
        .event.scope-puzzle { border-left-color: #7c3aed; }
        .event.scope-scene { border-left-color: #059669; }
        .event.scope-device { border-left-color: #d97706; }
        .event.scope-operator { border-left-color: #db2777; }
        .event.scope-node { border-left-color: #0891b2; }
        .ts { color: #6b7280; font-size: 11px; min-width: 90px; }
        .name { color: #60a5fa; font-weight: bold; min-width: 140px; }
        .id { color: #a78bfa; }
        .msg { color: #9ca3af; }
        footer {
            background: #16213e;
            padding: 8px 20px;
            border-top: 1px solid #0f3460;
            font-size: 11px;
            color: #6b7280;
        }
        .controls {
            background: #16213e;
            padding: 10px 20px;
            border-bottom: 1px solid #0f3460;
            display: flex;
            gap: 10px;
            align-items: center;
            flex-wrap: wrap;
        }
        .control-group {
            display: flex;
            gap: 6px;
            align-items: center;
        }
        .control-group label {
            font-size: 12px;
            color: #9ca3af;
        }
        .control-group input {
            background: #1a1a2e;
            border: 1px solid #0f3460;
            border-radius: 4px;
            padding: 6px 10px;
            color: #eee;
            font-family: monospace;
            font-size: 12px;
            width: 160px;
        }
        .control-group input:focus {
            outline: none;
            border-color: #2563eb;
        }
        .control-group button {
            background: #2563eb;
            border: none;
            border-radius: 4px;
            padding: 6px 12px;
            color: #fff;
            font-family: monospace;
            font-size: 12px;
            cursor: pointer;
        }
        .control-group button:hover {
            background: #1d4ed8;
        }
        .control-group button:disabled {
            background: #374151;
            cursor: not-allowed;
        }
        .control-group button.start {
            background: #059669;
        }
        .control-group button.start:hover {
            background: #047857;
        }
        .control-group button.stop {
            background: #dc2626;
        }
        .control-group button.stop:hover {
            background: #b91c1c;
        }
        .control-group input.small {
            width: 100px;
        }
        .divider {
            width: 1px;
            height: 24px;
            background: #0f3460;
            margin: 0 6px;
        }
        #result {
            font-size: 12px;
            padding: 4px 10px;
            border-radius: 4px;
            display: none;
        }
        #result.success {
            display: inline;
            background: #1b4332;
            color: #95d5b2;
        }
        #result.error {
            display: inline;
            background: #7f1d1d;
            color: #fca5a5;
        }
    </style>
</head>
<body>
    <header>
        <h1>Sentient Engine - Event Stream</h1>
        <span id="status" class="disconnected">Disconnected</span>
    </header>
    <div class="controls">
        <div class="control-group">
            <label>Game:</label>
            <input type="text" id="sceneId" class="small" placeholder="scene_id">
            <button id="startBtn" class="start" onclick="startGame()">Start</button>
            <button id="stopBtn" class="stop" onclick="stopGame()">Stop</button>
        </div>
        <div class="divider"></div>
        <div class="control-group">
            <label>Reset to Node:</label>
            <input type="text" id="nodeId" placeholder="e.g. puzzle_scarab">
            <button id="resetBtn" onclick="resetToNode()">Reset</button>
        </div>
        <span id="result"></span>
    </div>
    <main>
        <div id="events"></div>
    </main>
    <footer>
        <span id="count">0</span> events | WebSocket: /ws/events
    </footer>

    <script>
        const eventsDiv = document.getElementById('events');
        const statusEl = document.getElementById('status');
        const countEl = document.getElementById('count');
        let eventCount = 0;
        let ws = null;
        let reconnectTimer = null;

        function formatTime(ts) {
            try {
                const d = new Date(ts);
                return d.toLocaleTimeString('en-US', { hour12: false });
            } catch {
                return ts;
            }
        }

        function getScope(name) {
            const parts = name.split('.');
            return parts[0] || '';
        }

        function renderEvent(e) {
            const div = document.createElement('div');
            div.className = 'event level-' + e.level + ' scope-' + getScope(e.event);

            let idText = '';
            if (e.fields) {
                if (e.fields.node_id) idText = e.fields.node_id;
                else if (e.fields.device_id) idText = e.fields.device_id;
                else if (e.fields.scene_id) idText = e.fields.scene_id;
                else if (e.fields.puzzle_id) idText = e.fields.puzzle_id;
            }

            div.innerHTML =
                '<span class="ts">' + formatTime(e.ts) + '</span>' +
                '<span class="name">' + e.event + '</span>' +
                (idText ? '<span class="id">' + idText + '</span>' : '') +
                (e.msg ? '<span class="msg">' + e.msg + '</span>' : '');

            eventsDiv.appendChild(div);
            eventCount++;
            countEl.textContent = eventCount;

            // Auto-scroll to bottom
            eventsDiv.scrollTop = eventsDiv.scrollHeight;

            // Limit displayed events to prevent memory issues
            while (eventsDiv.children.length > 500) {
                eventsDiv.removeChild(eventsDiv.firstChild);
            }
        }

        function setStatus(status) {
            statusEl.className = status;
            statusEl.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        }

        function connect() {
            if (ws && ws.readyState === WebSocket.OPEN) return;

            setStatus('connecting');

            const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
            ws = new WebSocket(protocol + '//' + location.host + '/ws/events');

            ws.onopen = function() {
                setStatus('connected');
                if (reconnectTimer) {
                    clearTimeout(reconnectTimer);
                    reconnectTimer = null;
                }
            };

            ws.onmessage = function(msg) {
                try {
                    const e = JSON.parse(msg.data);
                    renderEvent(e);
                } catch (err) {
                    console.error('Failed to parse event:', err);
                }
            };

            ws.onclose = function() {
                setStatus('disconnected');
                scheduleReconnect();
            };

            ws.onerror = function(err) {
                console.error('WebSocket error:', err);
                ws.close();
            };
        }

        function scheduleReconnect() {
            if (reconnectTimer) return;
            reconnectTimer = setTimeout(function() {
                reconnectTimer = null;
                connect();
            }, 3000);
        }

        // Initial connection
        connect();

        // Reset to node functionality
        const nodeIdInput = document.getElementById('nodeId');
        const resetBtn = document.getElementById('resetBtn');
        const resultEl = document.getElementById('result');

        function showResult(success, message) {
            resultEl.className = success ? 'success' : 'error';
            resultEl.textContent = message;
            setTimeout(function() {
                resultEl.className = '';
                resultEl.textContent = '';
            }, 5000);
        }

        function resetToNode() {
            const nodeId = nodeIdInput.value.trim();
            if (!nodeId) {
                showResult(false, 'Enter a node_id');
                return;
            }

            resetBtn.disabled = true;
            resultEl.className = '';
            resultEl.textContent = '';

            fetch('/operator/reset-node', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ node_id: nodeId })
            })
            .then(function(res) { return res.json(); })
            .then(function(data) {
                resetBtn.disabled = false;
                if (data.ok) {
                    showResult(true, 'Reset to ' + nodeId);
                    nodeIdInput.value = '';
                } else {
                    showResult(false, data.error || 'Reset failed');
                }
            })
            .catch(function(err) {
                resetBtn.disabled = false;
                showResult(false, 'Network error');
            });
        }

        // Allow Enter key to trigger reset
        nodeIdInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') resetToNode();
        });

        // Game controls
        const sceneIdInput = document.getElementById('sceneId');
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');

        function startGame() {
            const sceneId = sceneIdInput.value.trim();
            startBtn.disabled = true;

            const body = sceneId ? { scene_id: sceneId } : {};

            fetch('/game/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })
            .then(function(res) { return res.json(); })
            .then(function(data) {
                startBtn.disabled = false;
                if (data.ok) {
                    showResult(true, 'Game started');
                    sceneIdInput.value = '';
                } else {
                    showResult(false, data.error || 'Start failed');
                }
            })
            .catch(function(err) {
                startBtn.disabled = false;
                showResult(false, 'Network error');
            });
        }

        function stopGame() {
            stopBtn.disabled = true;

            fetch('/game/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })
            .then(function(res) { return res.json(); })
            .then(function(data) {
                stopBtn.disabled = false;
                if (data.ok) {
                    showResult(true, 'Game stopped');
                } else {
                    showResult(false, data.error || 'Stop failed');
                }
            })
            .catch(function(err) {
                stopBtn.disabled = false;
                showResult(false, 'Network error');
            });
        }

        // Allow Enter key to trigger start
        sceneIdInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') startGame();
        });
    </script>
</body>
</html>`

// uiHandler serves the operator UI HTML page.
func uiHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(operatorUIHTML))
}
