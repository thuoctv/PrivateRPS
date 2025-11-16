import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * Tutorial: Deploy and Interact Locally (--network localhost)
 * ===========================================================
 *
 * 1. From a separate terminal window:
 *
 *   npx hardhat node
 *
 * 2. Deploy the RockPaperScissors contract
 *
 *   npx hardhat --network localhost deploy
 *
 * 3. Interact with the RockPaperScissors contract
 *
 *   npx hardhat --network localhost rps:create-game --player2 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
 *   npx hardhat --network localhost rps:make-choice --gameid 1 --choice 1
 *   npx hardhat --network localhost rps:make-choice --gameid 1 --choice 2 --player 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
 *   npx hardhat --network localhost rps:reveal-game --gameid 1
 *   npx hardhat --network localhost rps:get-game --gameid 1
 *
 */

/**
 * Example:
 *   - npx hardhat --network localhost rps:address
 *   - npx hardhat --network sepolia rps:address
 */
task("rps:address", "Prints the RockPaperScissors contract address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;

  const rps = await deployments.get("RockPaperScissors");

  console.log("RockPaperScissors address is " + rps.address);
});

/**
 * Example:
 *   - npx hardhat --network localhost rps:create-game --player2 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
 *   - npx hardhat --network sepolia rps:create-game --player2 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
 */
task("rps:create-game", "Creates a new Rock Paper Scissors game")
  .addOptionalParam("address", "Optionally specify the RockPaperScissors contract address")
  .addParam("player2", "Address of the second player")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const rpsDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("RockPaperScissors");
    console.log(`RockPaperScissors: ${rpsDeployment.address}`);

    const signers = await ethers.getSigners();
    const rpsContract = await ethers.getContractAt("RockPaperScissors", rpsDeployment.address);

    const tx = await rpsContract.connect(signers[0]).createGame(taskArguments.player2);
    console.log(`Wait for tx:${tx.hash}...`);

    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);

    // Get the game ID from the event
    const gameCreatedEvent = receipt?.logs.find(log => {
      try {
        const parsed = rpsContract.interface.parseLog(log);
        return parsed?.name === "GameCreated";
      } catch {
        return false;
      }
    });

    if (gameCreatedEvent) {
      const parsed = rpsContract.interface.parseLog(gameCreatedEvent);
      const gameId = parsed?.args[0];
      console.log(`Game created with ID: ${gameId}`);
    }

    console.log(`Game creation succeeded!`);
  });

/**
 * Example:
 *   - npx hardhat --network localhost rps:make-choice --gameid 1 --choice 1
 *   - npx hardhat --network localhost rps:make-choice --gameid 1 --choice 2 --player 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
 */
task("rps:make-choice", "Makes a choice in a Rock Paper Scissors game")
  .addOptionalParam("address", "Optionally specify the RockPaperScissors contract address")
  .addParam("gameid", "The game ID")
  .addParam("choice", "The choice (1=Rock, 2=Paper, 3=Scissors)")
  .addOptionalParam("player", "Player address (defaults to first signer)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    const gameId = parseInt(taskArguments.gameid);
    const choice = parseInt(taskArguments.choice);

    if (!Number.isInteger(gameId) || gameId <= 0) {
      throw new Error(`Argument --gameid must be a positive integer`);
    }

    if (!Number.isInteger(choice) || choice < 1 || choice > 3) {
      throw new Error(`Argument --choice must be 1 (Rock), 2 (Paper), or 3 (Scissors)`);
    }

    await fhevm.initializeCLIApi();

    const rpsDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("RockPaperScissors");
    console.log(`RockPaperScissors: ${rpsDeployment.address}`);

    const signers = await ethers.getSigners();

    // Determine which signer to use
    let signer = signers[0];
    if (taskArguments.player) {
      const signerIndex = signers.findIndex(s => s.address.toLowerCase() === taskArguments.player.toLowerCase());
      if (signerIndex === -1) {
        console.log(`Player ${taskArguments.player} not found in signers, using first signer`);
      } else {
        signer = signers[signerIndex];
      }
    }

    console.log(`Making choice as player: ${signer.address}`);

    const rpsContract = await ethers.getContractAt("RockPaperScissors", rpsDeployment.address);

    // Encrypt the choice
    const encryptedChoice = await fhevm
      .createEncryptedInput(rpsDeployment.address, signer.address)
      .add8(choice)
      .encrypt();

    const tx = await rpsContract
      .connect(signer)
      .makeChoice(gameId, encryptedChoice.handles[0], encryptedChoice.inputProof);
    console.log(`Wait for tx:${tx.hash}...`);

    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);

    const choiceNames = ["", "Rock", "Paper", "Scissors"];
    console.log(`Choice ${choiceNames[choice]} made successfully for game ${gameId}!`);
  });

/**
 * Example:
 *   - npx hardhat --network localhost rps:reveal-game --gameid 1
 *   - npx hardhat --network sepolia rps:reveal-game --gameid 1
 */
task("rps:reveal-game", "Reveals the result of a Rock Paper Scissors game")
  .addOptionalParam("address", "Optionally specify the RockPaperScissors contract address")
  .addParam("gameid", "The game ID")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const gameId = parseInt(taskArguments.gameid);
    if (!Number.isInteger(gameId) || gameId <= 0) {
      throw new Error(`Argument --gameid must be a positive integer`);
    }

    const rpsDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("RockPaperScissors");
    console.log(`RockPaperScissors: ${rpsDeployment.address}`);

    const signers = await ethers.getSigners();
    const rpsContract = await ethers.getContractAt("RockPaperScissors", rpsDeployment.address);

    const tx = await rpsContract.connect(signers[0]).revealGame(gameId);
    console.log(`Wait for tx:${tx.hash}...`);

    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);

    console.log(`Game ${gameId} revelation request sent! Check the GameRevealed event for results.`);
  });

/**
 * Example:
 *   - npx hardhat --network localhost rps:get-game --gameid 1
 *   - npx hardhat --network sepolia rps:get-game --gameid 1
 */
task("rps:get-game", "Gets information about a Rock Paper Scissors game")
  .addOptionalParam("address", "Optionally specify the RockPaperScissors contract address")
  .addParam("gameid", "The game ID")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const gameId = parseInt(taskArguments.gameid);
    if (!Number.isInteger(gameId) || gameId <= 0) {
      throw new Error(`Argument --gameid must be a positive integer`);
    }

    const rpsDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("RockPaperScissors");
    console.log(`RockPaperScissors: ${rpsDeployment.address}`);

    const rpsContract = await ethers.getContractAt("RockPaperScissors", rpsDeployment.address);

    const gameInfo = await rpsContract.getGame(gameId);

    const resultNames = ["Pending", "Draw", "Player1Wins", "Player2Wins"];

    console.log(`Game ${gameId} Information:`);
    console.log(`  Player 1: ${gameInfo[0]}`);
    console.log(`  Player 2: ${gameInfo[1]}`);
    console.log(`  Player 1 Made Choice: ${gameInfo[2]}`);
    console.log(`  Player 2 Made Choice: ${gameInfo[3]}`);
    console.log(`  Revealed: ${gameInfo[4]}`);
    console.log(`  Result: ${resultNames[Number(gameInfo[5])]}`);
    console.log(`  Created At: ${new Date(Number(gameInfo[6]) * 1000).toISOString()}`);
  });

/**
 * Example:
 *   - npx hardhat --network localhost rps:get-player-games --player 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
 *   - npx hardhat --network sepolia rps:get-player-games --player 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
 */
task("rps:get-player-games", "Gets all games for a specific player")
  .addOptionalParam("address", "Optionally specify the RockPaperScissors contract address")
  .addOptionalParam("player", "Player address (defaults to first signer)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const rpsDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("RockPaperScissors");
    console.log(`RockPaperScissors: ${rpsDeployment.address}`);

    const signers = await ethers.getSigners();
    const playerAddress = taskArguments.player || signers[0].address;

    const rpsContract = await ethers.getContractAt("RockPaperScissors", rpsDeployment.address);

    const gameIds = await rpsContract.getPlayerGames(playerAddress);

    console.log(`Games for player ${playerAddress}:`);
    if (gameIds.length === 0) {
      console.log("  No games found");
    } else {
      console.log(`  Game IDs: [${gameIds.join(", ")}]`);
    }
  });

/**
 * Example:
 *   - npx hardhat --network localhost rps:get-choices --gameid 1
 *   - npx hardhat --network sepolia rps:get-choices --gameid 1
 */
task("rps:get-choices", "Gets encrypted choices for a game (only for game participants)")
  .addOptionalParam("address", "Optionally specify the RockPaperScissors contract address")
  .addParam("gameid", "The game ID")
  .addOptionalParam("player", "Player address (defaults to first signer)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    const gameId = parseInt(taskArguments.gameid);
    if (!Number.isInteger(gameId) || gameId <= 0) {
      throw new Error(`Argument --gameid must be a positive integer`);
    }

    await fhevm.initializeCLIApi();

    const rpsDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("RockPaperScissors");
    console.log(`RockPaperScissors: ${rpsDeployment.address}`);

    const signers = await ethers.getSigners();
    const signer = taskArguments.player
      ? signers.find(s => s.address.toLowerCase() === taskArguments.player.toLowerCase()) || signers[0]
      : signers[0];

    const rpsContract = await ethers.getContractAt("RockPaperScissors", rpsDeployment.address);

    try {
      const choices = await rpsContract.connect(signer).getGameChoices(gameId);

      console.log(`Encrypted choices for game ${gameId}:`);
      console.log(`  Player 1 choice: ${choices[0]}`);
      console.log(`  Player 2 choice: ${choices[1]}`);

      // Try to decrypt if possible (for testing purposes)
      if (choices[0] !== ethers.ZeroHash) {
        try {
          const decryptedChoice1 = await fhevm.userDecryptEuint(
            FhevmType.euint8,
            choices[0],
            rpsDeployment.address,
            signer,
          );
          console.log(`  Player 1 decrypted choice: ${decryptedChoice1} (${["", "Rock", "Paper", "Scissors"][Number(decryptedChoice1)]})`);
        } catch (error) {
          console.log(`  Could not decrypt Player 1 choice: ${error}`);
        }
      }

      if (choices[1] !== ethers.ZeroHash) {
        try {
          const decryptedChoice2 = await fhevm.userDecryptEuint(
            FhevmType.euint8,
            choices[1],
            rpsDeployment.address,
            signer,
          );
          console.log(`  Player 2 decrypted choice: ${decryptedChoice2} (${["", "Rock", "Paper", "Scissors"][Number(decryptedChoice2)]})`);
        } catch (error) {
          console.log(`  Could not decrypt Player 2 choice: ${error}`);
        }
      }

    } catch (error) {
      console.error(`Error getting choices: ${error}`);
    }
  });