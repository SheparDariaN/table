# UI plugins

Plugins are trusted modules compiled into the web application. `@arcane-table/plugin-sdk` is the only public manifest contract.

## Rules

- A plugin exports a versioned manifest and slot renderers. It does not import another feature's internals.
- The registry rejects duplicate plugin, navigation, and route identifiers before the application starts.
- Slots are `dashboard.widgets`, `table.toolbar`, `table.sidebar`, `table.dock`, `admin.sections`, and `settings.sections`.
- Server authorization remains authoritative. A navigation entry is not permission to receive data.
- GM-only scene, journal, or actor data is not supplied to a plugin unless a future capability explicitly allows it.
- Remote code, evaluated strings, and untrusted packages are outside contract `1.0.0`.

## Current core plugins

- `core-shell`: reserved play navigation and dashboard/settings slots.
- `core-table`: reserved table slots and an empty scene host.
- `core-converter`: active Roll20 to Foundry converter for GM and Admin.
- `core-admin`: active administration pages for Admin.
