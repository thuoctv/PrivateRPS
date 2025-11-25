
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
- **Developer Experience**: Typechain typings, Solhint + ESLint + Prettier, Solidity coverage, deploy scripts.
- **Netlify-ready Frontend**: `netlify.toml` plus shipped WASM assets (`tfhe_bg.wasm`, `kms_lib_bg.wasm`) for Relayer SDK.

## Architecture Overview
- **Smart Contract (`contracts/RockPaperScissors.sol`)**
  - Manages game lifecycle, encrypted choices, and final result.
  - **Core Functions:**
    - `createGame(address _player2)`: Creates a new game between two players, returns game ID
    - `makeChoice(uint256 _gameId, externalEuint8 _encryptedChoice, bytes _inputProof)`: Submits encrypted choice (1=Rock, 2=Paper, 3=Scissors)
    - `revealGame(uint256 _gameId)`: Marks choices as publicly decryptable and sets decryption pending state
    - `decryptionCallback(bytes32[] handlesList, bytes cleartexts, bytes decryptionProof)`: Receives decrypted values from frontend, verifies proof, and determines winner
    - `getGame(uint256 _gameId)`: Retrieves game state and results (player addresses, choices made, result, etc.)
    - `getPlayerGames(address _player)`: Lists all game IDs for a player
    - `getGameChoices(uint256 _gameId)`: Returns encrypted choices (only accessible by game participants)
  - **Public State Variables:**
    - `gameCounter`: Total number of games created
    - `decryptionPending`: Boolean flag indicating if a decryption is in progress
    - `pendingGameId`: Game ID currently awaiting decryption
  - **Game States:**
    - `Pending`: Game created, waiting for choices
    - `Draw`: Both players chose the same option
    - `Player1Wins`: Player 1 won the game
    - `Player2Wins`: Player 2 won the game
  - **Events:** `GameCreated`, `ChoiceMade`, `GameRevealed`
  - Receives encrypted moves via `makeChoice`, marks choices as publicly decryptable in `revealGame`.
  - Receives decrypted values from frontend via `decryptionCallback`, verifies decryption proof, determines winner, and emits `GameRevealed`.
- **FHE Stack**
  - `@fhevm/solidity` + `@fhevm/hardhat-plugin` handle ciphertext types, proofs, signatures, and CLI utilities.
  - Frontend relies on `@zama-fhe/relayer-sdk` to initialize TFHE KMS, load WASM artifacts, encrypt user inputs, and decrypt publicly decryptable values off-chain.
- **Frontend (`frontend/`)**
  - React + TypeScript + Vite.
  - RainbowKit for wallet UX, Wagmi for RPC/chains (Sepolia by default).
  - **Hooks:**
    - `useZamaInstance`: Initializes and manages Zama Relayer SDK instance for encryption/decryption
    - `useContractInteraction`: Provides contract interaction methods (createGame, makeChoice, revealGame, etc.)
    - `useEthersSigner`: Converts Wagmi wallet client to Ethers signer for contract interactions
  - **Decryption Flow**: When revealing a game, the frontend performs off-chain decryption using `instance.publicDecrypt()` from the Relayer SDK, then submits the decrypted values and proof to the contract's `decryptionCallback` function.
  - **Components:**
    - `RockPaperScissorsApp`: Main app component with tab navigation
    - `CreateGame`: Form to create new games
    - `JoinGame`: Interface to join existing games and make choices
    - `GamesList`: Displays player's games with status and results
    - `Header`: App header with wallet connection
  - **Utils:**
    - `choices.ts`: Choice definitions and helper functions (Rock=1, Paper=2, Scissors=3)

## Project Structure
```
.
├── contracts/                 # Solidity sources (RockPaperScissors)
├── deploy/                    # hardhat-deploy scripts (deploy-rps.ts)
├── frontend/                  # React dApp
│   ├── public/                # TFHE WASM files, relayer SDK bundle, icons
│   └── src/                   # Source code
│       ├── components/        # React components (CreateGame, JoinGame, GamesList, etc.)
│       ├── hooks/             # Custom React hooks (useZamaInstance, useContractInteraction, etc.)
│       ├── config/            # Contract addresses, ABI, Wagmi config
│       ├── utils/             # Helper functions (choices.ts)
│       └── styles/            # Component CSS files
├── tasks/                     # Custom Hardhat tasks (rps:*)
├── test/                      # Contract tests & helpers
│   ├── RockPaperScissors.ts  # Local test suite (10 test cases)
│   ├── RockPaperScissorsSepolia.ts  # Sepolia testnet tests
│   ├── checkPrivateKey.ts    # Helper: verify private key setup
│   └── checkSepoliaBalance.ts # Helper: check Sepolia account balances
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
| `npm run test` | Execute the full Hardhat test suite (includes 10 test cases for RockPaperScissors) |
| `npm run test:sepolia` | Run tests against Sepolia testnet |
| `npm run coverage` | Collect Solidity coverage via `solidity-coverage` |
| `npm run lint` | Run Solhint, ESLint, and Prettier checks |
| `npm run deploy:sepolia` | Deploy with hardhat-deploy to Sepolia (uses `deploy/deploy-rps.ts`) |
| `npm run deploy:sepolia:full` | Execute `scripts/deploy-and-update.js` (deploy + sync frontend ABI/address) |
| `npm run prettier:write` | Auto-format code with Prettier |
| `npm run frontend:dev` | Shortcut to start the frontend dev server |
| `npm run clean` | Remove artifacts, cache, types, and coverage files |

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
   - `npm run test` - Runs all tests (10 test cases for RockPaperScissors contract)
   - `npx hardhat test test/RockPaperScissors.ts` - Run specific test file
   - `npm run test:sepolia` - Test against Sepolia testnet (requires deployed contract)
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
| `rps:make-choice` | `npx hardhat --network localhost rps:make-choice --gameid 1 --choice 2 --player <addr>` | Encrypts input via FHE plugin and submits (1=Rock, 2=Paper, 3=Scissors) |
| `rps:reveal-game` | `npx hardhat --network sepolia rps:reveal-game --gameid 1` | Triggers public decrypt flow |
| `rps:get-game` | `npx hardhat --network localhost rps:get-game --gameid 1` | Reads on-chain state |
| `rps:get-player-games` | `npx hardhat --network localhost rps:get-player-games --player <addr>` | Lists all games joined by a wallet |
| `rps:get-choices` | `npx hardhat --network localhost rps:get-choices --gameid 1 --player <addr>` | Debugs encrypted handles (only authorized players) |

## Sample Gameplay Flow
1. **Create Game**: Player 1 creates a game via CLI task (`rps:create-game`) or UI `Create Game` tab, specifying Player 2's address.
2. **Join Game**: Player 2 can view and join the game by entering the game ID in the `Join Game` tab.
3. **Make Choices**: Both players submit their encrypted choices:
   - Choice values: `1` = Rock, `2` = Paper, `3` = Scissors
   - The frontend encrypts the move with Relayer SDK before calling `makeChoice`
   - Choices are stored as `euint8` ciphertexts on-chain
4. **Reveal Game**: Once both players have made choices, either player can trigger the reveal process:
   - The frontend calls `revealGame` on the contract, which:
     - Marks both encrypted choices as publicly decryptable via `FHE.makePubliclyDecryptable`
     - Sets `decryptionPending = true` and `pendingGameId = gameId` to prevent concurrent decryptions
   - The frontend then uses the Relayer SDK (`instance.publicDecrypt()`) to decrypt the values off-chain
   - The frontend calls `decryptionCallback` on the contract with:
     - `handlesList`: Array of encrypted value handles
     - `cleartexts`: ABI-encoded decrypted values `(uint8, uint8)`
     - `decryptionProof`: Cryptographic proof of decryption
   - The contract verifies the proof using `FHE.checkSignatures`, determines the winner using the game rules:
     - Rock (1) beats Scissors (3)
     - Paper (2) beats Rock (1)
     - Scissors (3) beats Paper (2)
   - Updates game state, sets `decryptionPending = false`, and emits `GameRevealed` event with the result
5. **View Results**: The `My Games` tab displays the outcome with decrypted moves and result state (Player1Wins/Player2Wins/Draw).

## Documentation & Useful Links
- FHEVM Docs: https://docs.zama.ai/fhevm
- Relayer SDK: https://github.com/zama-ai/fhevm-relayer-sdk
- Hardhat Template: https://github.com/zama-ai/fhevm-hardhat-template
- (Optional) keep a private deployment runbook for detailed steps per environment

---

Ready for further extensions such as wagers, reward tokens, or leaderboard mechanics. Submit issues/PRs in your internal repo if you need more product-specific details.