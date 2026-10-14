# Licensed Foundry smoke adapter

`pnpm test:foundry-smoke` is opt-in and requires a local, licensed Foundry VTT
14.369 installation with `dnd5e` 6.0.6.

Set `FOUNDRY_SMOKE_RUNNER` to an executable controlled by the operator. The
harness passes one argument: the absolute path to a generated Actor JSON file.
The executable must import and prepare the actor inside the target runtime,
open its sheet, create its prototype token, and print only this JSON shape:

```json
{
  "imported": true,
  "migrationWarnings": [],
  "sheetOpened": true,
  "tokenCreated": true
}
```

The repository intentionally does not contain Foundry binaries, credentials,
world data, or proprietary system assets. A failing or missing adapter returns
a non-zero exit code and cannot be mistaken for a passed smoke test.
