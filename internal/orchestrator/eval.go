package orchestrator

import (
	"strings"
)

// EvalContext provides context for condition evaluation.
type EvalContext struct {
	PuzzleStates map[string]*PuzzleStatus
	Event        *Event
}

// Event is an internal event representation for condition evaluation.
type Event struct {
	Name   string
	Fields map[string]interface{}
}

// EvalCondition evaluates a condition expression.
// MVP: supports ONLY these patterns from the example:
//   - "" (empty = always true)
//   - "<nodeID>.resolved" (single puzzle resolved check)
//   - "<nodeID>.resolved && <nodeID>.resolved" (AND of two puzzle resolved checks)
//   - "event == '<eventName>'" (event name check)
//   - "event == '<eventName>' && <field> == '<value>'" (event name + field check)
func EvalCondition(expr string, ctx *EvalContext) bool {
	expr = strings.TrimSpace(expr)

	// Empty condition is always true
	if expr == "" {
		return true
	}

	// Handle AND conditions (split and evaluate both sides)
	if strings.Contains(expr, "&&") {
		parts := strings.SplitN(expr, "&&", 2)
		left := strings.TrimSpace(parts[0])
		right := strings.TrimSpace(parts[1])
		return EvalCondition(left, ctx) && EvalCondition(right, ctx)
	}

	// Pattern: <nodeID>.resolved
	if strings.HasSuffix(expr, ".resolved") {
		nodeID := strings.TrimSuffix(expr, ".resolved")
		if ctx.PuzzleStates == nil {
			return false
		}
		if status, ok := ctx.PuzzleStates[nodeID]; ok {
			return status.IsResolved()
		}
		return false
	}

	// Pattern: event == '<eventName>'
	if strings.HasPrefix(expr, "event ==") {
		expected := extractSingleQuotedValue(expr, "event ==")
		if ctx.Event == nil {
			return false
		}
		return ctx.Event.Name == expected
	}

	// Pattern: <field> == '<value>' (for event field checks like puzzle_id == 'scarab')
	if strings.Contains(expr, "==") {
		field, value := parseFieldEquality(expr)
		if field == "" || ctx.Event == nil || ctx.Event.Fields == nil {
			return false
		}
		if v, ok := ctx.Event.Fields[field]; ok {
			if strVal, ok := v.(string); ok {
				return strVal == value
			}
		}
		return false
	}

	// Unknown pattern - return false
	return false
}

// extractSingleQuotedValue extracts a single-quoted value after a prefix.
// Example: "event == 'puzzle.solved'" with prefix "event ==" returns "puzzle.solved"
func extractSingleQuotedValue(expr, prefix string) string {
	idx := strings.Index(expr, prefix)
	if idx == -1 {
		return ""
	}
	rest := strings.TrimSpace(expr[idx+len(prefix):])
	if len(rest) < 2 || rest[0] != '\'' {
		return ""
	}
	end := strings.Index(rest[1:], "'")
	if end == -1 {
		return ""
	}
	return rest[1 : end+1]
}

// parseFieldEquality parses "<field> == '<value>'" and returns field, value.
func parseFieldEquality(expr string) (string, string) {
	parts := strings.SplitN(expr, "==", 2)
	if len(parts) != 2 {
		return "", ""
	}
	field := strings.TrimSpace(parts[0])
	valueRaw := strings.TrimSpace(parts[1])
	// Remove single quotes from value
	if len(valueRaw) >= 2 && valueRaw[0] == '\'' && valueRaw[len(valueRaw)-1] == '\'' {
		return field, valueRaw[1 : len(valueRaw)-1]
	}
	return field, valueRaw
}
