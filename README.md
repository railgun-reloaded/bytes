# @railgun-reloaded/bytes

Shared, zero-dependency utilities used across RAILGUN reloaded packages.

This package is the canonical home for primitive conversion helpers (hex strings,
byte arrays, bigints). It exists so that every package in the monorepo gets the
same validated behavior from a single implementation instead of diverging copies.

## Installation

```bash
npm install @railgun-reloaded/bytes
```

## Usage

```ts
import { hexToBytes, bytesToHex, bigIntToBytes, bytesToBigInt } from '@railgun-reloaded/bytes'
```

## Scripts

```bash
npm run build     # tsc --build
npm run lint      # eslint
npm run lint:fix  # eslint --fix
npm test          # build + brittle
```

## License

MIT
