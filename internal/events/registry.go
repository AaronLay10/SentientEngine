package events

import "fmt"

var allowedEvents = map[string]struct{}{
	// node
	"node.started":    {},
	"node.completed":  {},
	"node.failed":     {},
	"node.reset":      {},
	"node.overridden": {},

	// puzzle
	"puzzle.activated": {},
	"puzzle.solved":    {},
	"puzzle.failed":    {},
	"puzzle.reset":     {},
	"puzzle.overridden": {},

	// scene
	"scene.started":   {},
	"scene.completed": {},
	"scene.failed":    {},
	"scene.reset":     {},

	// loop
	"loop.started": {},
	"loop.tick":    {},
	"loop.stopped": {},

	// timer
	"timer.started":   {},
	"timer.expired":  {},
	"timer.cancelled": {},

	// operator
	"operator.override": {},
	"operator.reset":    {},
	"operator.jump":     {},
	"operator.pause":    {},
	"operator.resume":   {},

	// device
	"device.connected":    {},
	"device.disconnected": {},
	"device.input":        {},
	"device.error":        {},

	// system
	"system.startup":  {},
	"system.shutdown": {},
	"system.error":    {},
}

func Validate(event string) error {
	if _, ok := allowedEvents[event]; !ok {
		return fmt.Errorf("unknown event: %s", event)
	}
	return nil
}
