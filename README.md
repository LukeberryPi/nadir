# Nadir

A browser game about antipodes. A city is named; you name the city that sits most opposite, through the Earth. Everyone gets the same eight cities each UTC day. After the last round you can copy your results or share them on X.

The game is TypeScript, served by [Bun](https://bun.sh). `bun dev` transpiles `src/` on the fly. `bun run build` emits a static `dist/` folder for Vercel.

```bash
bun install
bun dev
```

Then visit `http://localhost:4173`.

```bash
bun test
bun run typecheck
```
