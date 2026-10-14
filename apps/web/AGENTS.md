# Web Agent Guide

## Responsibility

Browser presentation, user interaction, client projections, and PixiJS rendering.

## Rules

- Treat server snapshots/events as canonical; optimistic state must be reversible and visibly pending.
- Keep domain decisions out of components, stores, and render objects.
- Separate declarative UI state from the Pixi scene graph through typed adapters.
- Never store Pixi objects in serializable application state.
- Dispose textures, containers, listeners, observers, and sockets on teardown.
- Validate decoded HTTP/WebSocket payloads before use.
- Design for reconnect, duplicate events, stale revisions, and permission changes.
- Keep accessibility and keyboard alternatives for canvas-only actions.
- Do not expose GM-only entities through hidden DOM, logs, or client caches.

## Testing

- Unit-test reducers, selectors, coordinate transforms, and reconciliation as pure functions.
- Component-test loading, empty, error, and permission states.
- Integration-test reconnect and snapshot replacement; visually test critical canvas behavior.
