
## Rock Paper Scissors on FHEVM

Full-stack reference dApp that shows how to build a confidential Rock Paper Scissors experience using Zama’s Fully Homomorphic Encryption Virtual Machine (FHEVM). Each move is encrypted end-to-end while the smart contract can still determine the winner once both sides commit.

> This repository couples the Hardhat + @fhevm stack on the backend with a production-ready React frontend (Vite, Wagmi, RainbowKit) wired for Sepolia.

## Table of Contents
- [Highlights](#highlights)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [System Requirements](#system-requirements)
- [Backend (Hardhat) Setup](#backend-hardhat-setup)
- [Frontend Setup](#frontend-setup)
- [Dev & Deployment Workflow](#dev--deployment-workflow)
- [Custom Hardhat Tasks](#custom-hardhat-tasks)
- [Sample Gameplay Flow](#sample-gameplay-flow)
- [Documentation & Useful Links](#documentation--useful-links)

## Highlights
- **FHE-Powered Privacy**: Player choices (`Rock/Paper/Scissors`) are stored as `euint8` ciphertexts and only decrypted once both parties have submitted.
- **User-Friendly Frontend**: Wallet connection via RainbowKit, state handled by Wagmi hooks, UX for creating, joining, and reviewing games.
- **@fhevm Hardhat Plugin**: End-to-end encrypted input workflow, deterministic decryption callbacks, and smooth local testing.
- **Developer Experience**: Typechain typings, Solhint + ESLint + Prettier, Solidity coverage, deploy scripts, and bilingual deployment notes.
- **Netlify-ready Frontend**: `netlify.toml` plus shipped WASM assets (`tfhe_bg.wasm`, `kms_lib_bg.wasm`) for Relayer SDK.

## Architecture Overview
- **Smart Contract (`contracts/RockPaperScissors.sol`)**
  - Manages game lifecycle, encrypted choices, and final result.
  - Receives encrypted moves via `makeChoice`, requests public decrypt in `_determineWinner`.
  - Processes oracle output inside `decryptionCallback` and emits `GameRevealed`.
- **FHE Stack**
  - `@fhevm/solidity` + `@fhevm/hardhat-plugin` handle ciphertext types, proofs, signatures, and CLI utilities.
  - Frontend relies on `@zama-fhe/relayer-sdk` to initialize TFHE KMS, load WASM artifacts, and submit encrypted payloads.
- **Frontend (`frontend/`)**
  - React + TypeScript + Vite.
  - RainbowKit for wallet UX, Wagmi for RPC/chains (Sepolia by default).
  - Hooks such as `useZamaInstance` and `useContractInteraction` glue the Relayer SDK to the contract ABI.

## Project Structure
```
.
├── contracts/                 # Solidity sources (RockPaperScissors + FHECounter sample)
├── deploy/                    # hardhat-deploy scripts
├── frontend/                  # React dApp
│   ├── public/                # TFHE WASM files, relayer SDK bundle, icons
│   └── src/                   # components, hooks, styles, configs
├── tasks/                     # Custom Hardhat tasks (rps:*)
├── test/                      # Contract tests & helpers
├── scripts/                   # Deployment helpers (deploy-and-update.js)
├── deployments/               # Saved deployments (localhost, sepolia)
└── hardhat.config.ts          # Hardhat + FHEVM configuration
```

## System Requirements
- Node.js >= 20.x (`node -v`)
- npm >= 7.x
- Testnet-funded wallet (Sepolia ETH) if deploying publicly
- Infura (or equivalent RPC) strongly recommended over public endpoints
- WalletConnect project ID when running RainbowKit in production

## Backend (Hardhat) Setup
```bash
npm install
```

### Environment Variables
Use a root `.env` or `npx hardhat vars set <KEY> <VALUE>` for secrets.

| Variable            | Purpose                                           |
|---------------------|---------------------------------------------------|
| `MNEMONIC`          | Deployer HD wallet (defaults to Hardhat mnemonic) |
| `PRIVATE_KEY`       | Optional single key (override mnemonic)           |
| `INFURA_API_KEY`    | Sepolia RPC endpoint (`https://sepolia.infura.io/v3/<KEY>`) |
| `ETHERSCAN_API_KEY` | Required for contract verification                |
| `REPORT_GAS`        | Any truthy value enables gas reporter             |

Example `.env`:
```
MNEMONIC="word1 word2 ... word12"
INFURA_API_KEY="xxxxxxxxxxxxxxxx"
ETHERSCAN_API_KEY="yyyyyyyyyyyy"
```

### Core Scripts
| Command | Description |
|---------|-------------|
| `npm run compile` | Compile contracts and regenerate typechain bindings |
| `npm run test` | Execute the full Hardhat test suite |
| `npm run coverage` | Collect Solidity coverage via `solidity-coverage` |
| `npm run lint` | Run Solhint, ESLint, and Prettier checks |
| `npm run deploy:sepolia` | Deploy with hardhat-deploy to Sepolia |
| `npm run deploy:sepolia:full` | Execute `scripts/deploy-and-update.js` (deploy + sync frontend ABI/address) |
| `npm run frontend:dev` | Shortcut to start the frontend dev server |

## Frontend Setup
```bash
cd frontend
npm install
```

Create `frontend/.env` (or `.env.local`) with at least:
```
VITE_INFURA_API_KEY=<infura_project_id>     # consumed by useZamaInstance
VITE_CONTRACT_ADDRESS=<RockPaperScissors_address>
VITE_CHAIN_ID=11155111
VITE_WALLETCONNECT_PROJECT_ID=<walletconnect_id>
```

- Update `frontend/src/config/contracts.ts` if you prefer a hard-coded address instead of env vars.
- Replace `projectId: 'YOUR_PROJECT_ID'` in `frontend/src/config/wagmi.ts` with a real value or read from `import.meta.env`.

### Run the dApp
```bash
npm run dev
# or from repo root: npm run frontend:dev
```
- Sepolia is the default chain; to work against localhost simply switch the `chains` entry in `wagmi.ts` and point `CONTRACT_ADDRESS` to the local deployment.

## Dev & Deployment Workflow
1. **Local node**
   ```bash
   npx hardhat node
   npx hardhat --network localhost deploy
   ```
2. **Testing**
   - `npm run test`
   - or `npx hardhat test --network localhost`
3. **Gas & lint checks**
   - `REPORT_GAS=1 npm run test` to inspect gas costs
   - `npm run lint` to enforce style
4. **Sepolia deployment**
   ```bash
   npx hardhat deploy --network sepolia --reset
   # or npm run deploy:sepolia
   ```
   Artifacts end up under `deployments/sepolia`. Sync the new address with the frontend (`frontend/src/config/contracts.ts` or env vars).
5. **Verification (optional)**
   ```bash
   npx hardhat verify --network sepolia <contract_address>
   ```
6. **Frontend build**
   ```bash
   cd frontend && npm run build
   ```
   Generates `dist/`, ready for Netlify/Vercel/static hosting.

## Custom Hardhat Tasks
Defined inside `tasks/RockPaperScissors.ts`. Common commands:

| Task | Example | Notes |
|------|---------|-------|
| `rps:address` | `npx hardhat --network sepolia rps:address` | Prints deployed address from `deployments/` |
| `rps:create-game` | `npx hardhat --network localhost rps:create-game --player2 <address>` | Creates a new game |
| `rps:make-choice` | `npx hardhat --network localhost rps:make-choice --gameid 1 --choice 2 --player <addr>` | Encrypts input via FHE plugin and submits |
| `rps:reveal-game` | `npx hardhat --network sepolia rps:reveal-game --gameid 1` | Triggers public decrypt flow |
| `rps:get-game` | `npx hardhat --network localhost rps:get-game --gameid 1` | Reads on-chain state |
| `rps:get-player-games` | `npx hardhat --network localhost rps:get-player-games --player <addr>` | Lists all games joined by a wallet |
| `rps:get-choices` | `npx hardhat --network localhost rps:get-choices --gameid 1 --player <addr>` | Debugs encrypted handles (only authorized players) |

## Sample Gameplay Flow
1. Player A creates a game (CLI task or UI `Create Game` tab).
2. Player B joins by entering the game ID inside `Join Game`.
3. Both players submit Rock/Paper/Scissors. The frontend encrypts the move with Relayer SDK before calling `makeChoice`.
4. Either player can call `revealGame`. The contract calls `FHE.makePubliclyDecryptable`, waits for oracle decryption, then finalizes inside `decryptionCallback`.
5. The `My Games` tab displays the outcome with decrypted moves and result state (win/lose/draw).

## Documentation & Useful Links
- FHEVM Docs: https://docs.zama.ai/fhevm
- Relayer SDK: https://github.com/zama-ai/fhevm-relayer-sdk
- Hardhat Template: https://github.com/zama-ai/fhevm-hardhat-template
- (Optional) keep a private deployment runbook for detailed steps per environment

---

Ready for further extensions such as wagers, reward tokens, or leaderboard mechanics. Submit issues/PRs in your internal repo if you need more product-specific details.