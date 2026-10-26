# Story Memory evaluation

An 8-chapter story with 7 planted continuity errors and 4 changes the story explains, read chapter by chapter by the real pipeline. Source: [`apps/api/eval`](../../apps/api/eval). Run it with `npm run eval:memory -w @ebook/api`.

Model: `gemini-3.5-flash-lite` · 2026-10-26 · 3 runs · about 51 s and 15,502 tokens per run

**Caught 76% of planted contradictions (16 of 21 across 3 runs), with 0 false alarms in total.**

| Planted contradiction | Caught | Example warning |
|---|---|---|
| Isla's eyes: green (ch. 1) vs brown (ch. 5) | 3/3 | Isla Ross, eye colour: "green" vs "brown" |
| Finn's age in the same summer: twelve (ch. 1) vs fifteen (ch. 3) | 1/3 | Finn Ross, age: "12" vs "fifteen" |
| Agnes dies (ch. 3) but is cooking and talking (ch. 6) | 3/3 | Agnes Ross, status: "alive" vs "dead" |
| The family boat: the Kittiwake (ch. 2) vs the Guillemot (ch. 7) | 0/3 |  |
| Dr Munro: a woman (ch. 2) vs a man (ch. 6) | 3/3 | Dr Eilidh Munro, gender: "female" vs "male" |
| The injured hand: left (ch. 4) vs right (ch. 5) | 3/3 | Isla Ross, injury: "sprained left hand" vs "bandaged right hand" |
| Portnahaven: west coast (ch. 1) vs east coast (ch. 8) | 3/3 | Portnahaven, location: "west coast of Islay" vs "east coast of Islay" |

## Changes the story explains (should not be flagged)

- Isla is sixteen (ch. 1) and twenty-four eight years later (ch. 8)
- Agnes is alive (ch. 1) and dies (ch. 3)
- Finn's sandy hair is cut short eight years later (ch. 8)
- Ruaridh is a fisherman (ch. 1) who used to be a schoolteacher (ch. 7)

## False alarms

None.
