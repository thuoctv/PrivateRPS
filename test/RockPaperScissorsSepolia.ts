import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { RockPaperScissors, RockPaperScissors__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

describe("RockPaperScissorsSepolia", function () {
  let signers: Signers;
  let rpsContract: RockPaperScissors;
  let rpsContractAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    // Only run on Sepolia, skip on mock
    if (fhevm.isMock) {
      console.warn(`This test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const RockPaperScissorsDeployment = await deployments.get("RockPaperScissors");
      rpsContractAddress = RockPaperScissorsDeployment.address;
      rpsContract = await ethers.getContractAt("RockPaperScissors", RockPaperScissorsDeployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    
    // Check balances and use accounts with funds
    console.log("Checking account balances...");
    for (let i = 0; i < Math.min(ethSigners.length, 5); i++) {
      const balance = await ethers.provider.getBalance(ethSigners[i].address);
      const balanceInEth = ethers.formatEther(balance);
      console.log(`Account ${i} (${ethSigners[i].address}): ${balanceInEth} ETH`);
    }
    
    // Find accounts with sufficient balance for gas
    // Need at least 2 different accounts with funds
    const minBalance = ethers.parseEther("0.0001"); // Minimum 0.0001 ETH for gas
    const accountsWithFunds: HardhatEthersSigner[] = [];
    
    for (let i = 0; i < ethSigners.length; i++) {
      const balance = await ethers.provider.getBalance(ethSigners[i].address);
      if (balance >= minBalance) {
        accountsWithFunds.push(ethSigners[i]);
      }
    }
    
    if (accountsWithFunds.length < 2) {
      console.warn(`⚠️  Only ${accountsWithFunds.length} account(s) with sufficient funds. Need at least 2 for testing.`);
      console.warn(`   Accounts with funds: ${accountsWithFunds.map(a => a.address).join(', ')}`);
      console.warn(`   Please fund more accounts or tests that require 2 players will be skipped.`);
    }
    
    // Use account 0 as deployer and alice (has most funds)
    // Use account 1 as bob if it has funds, otherwise use account 0 (but tests will fail for createGame)
    signers = { 
      deployer: ethSigners[0], 
      alice: ethSigners[0], // Always use account 0 for alice (has funds)
      bob: accountsWithFunds.length >= 2 ? accountsWithFunds[1] : ethSigners[1] // Use second account with funds, or account 1
    };
    
    console.log(`Using accounts:`);
    console.log(`  Deployer: ${await signers.deployer.getAddress()}`);
    console.log(`  Alice: ${await signers.alice.getAddress()}`);
    console.log(`  Bob: ${await signers.bob.getAddress()}`);
    
    // Check if bob has enough funds
    const bobBalance = await ethers.provider.getBalance(await signers.bob.getAddress());
    if (bobBalance < minBalance && accountsWithFunds.length < 2) {
      console.warn(`⚠️  Bob account has insufficient funds (${ethers.formatEther(bobBalance)} ETH). Some tests may fail.`);
    }
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("should get game counter", async function () {
    steps = 1;
    this.timeout(30000);

    progress(`Getting game counter from contract ${rpsContractAddress}...`);
    const counter = await rpsContract.gameCounter();
    console.log(`Game counter: ${counter}`);
    expect(counter).to.be.gte(0);
  });

  it("should get existing game info (read-only)", async function () {
    steps = 2;
    this.timeout(30000);

    progress(`Getting game counter...`);
    const gameCounter = await rpsContract.gameCounter();
    
    if (gameCounter > 0) {
      progress(`Getting game info for gameId=1...`);
      const game = await rpsContract.getGame(1);
      console.log(`Game 1 info:`, {
        player1: game.player1,
        player2: game.player2,
        player1Made: game.player1Made,
        player2Made: game.player2Made,
        revealed: game.revealed,
        result: game.result,
      });
      expect(game.player1).to.not.eq(ethers.ZeroAddress);
      expect(game.player2).to.not.eq(ethers.ZeroAddress);
    } else {
      console.log("No games exist yet, skipping game info test");
      this.skip();
    }
  });

  it("should check decryptionPending status (read-only)", async function () {
    steps = 1;
    this.timeout(30000);

    progress(`Checking decryptionPending status...`);
    const decryptionPending = await rpsContract.decryptionPending();
    console.log(`Decryption pending: ${decryptionPending}`);
    expect(typeof decryptionPending).to.eq('boolean');
  });

  it("should create a new game on Sepolia", async function () {
    steps = 3;
    this.timeout(60000);

    // Check if alice and bob are different addresses
    const aliceAddress = await signers.alice.getAddress();
    const bobAddress = await signers.bob.getAddress();
    
    if (aliceAddress.toLowerCase() === bobAddress.toLowerCase()) {
      console.log("⚠️  Alice and Bob are the same address. Skipping test (contract doesn't allow playing against yourself).");
      this.skip();
      return;
    }

    progress(`Creating game: Player1=${aliceAddress}, Player2=${bobAddress}...`);
    const tx = await rpsContract.connect(signers.alice).createGame(bobAddress);
    const receipt = await tx.wait();
    console.log(`Transaction hash: ${receipt?.hash}`);

    progress(`Getting game counter...`);
    const gameCounter = await rpsContract.gameCounter();
    console.log(`Game counter after creation: ${gameCounter}`);

    progress(`Getting game info for gameId=${gameCounter}...`);
    const game = await rpsContract.getGame(gameCounter);
    expect(game.player1.toLowerCase()).to.eq(aliceAddress.toLowerCase());
    expect(game.player2.toLowerCase()).to.eq(bobAddress.toLowerCase());
    expect(game.player1Made).to.eq(false);
    expect(game.player2Made).to.eq(false);
    expect(game.revealed).to.eq(false);
    expect(game.result).to.eq(0); // GameResult.Pending
  });

  it("should allow players to make encrypted choices on Sepolia", async function () {
    steps = 5;
    this.timeout(120000);

    // Create game first
    progress(`Creating game...`);
    const createTx = await rpsContract.connect(signers.alice).createGame(signers.bob.address);
    await createTx.wait();
    const gameId = await rpsContract.gameCounter();

    // Alice makes choice (Rock = 1)
    progress(`Alice encrypting choice: Rock (1)...`);
    const aliceChoice = 1;
    const encryptedAliceChoice = await fhevm
      .createEncryptedInput(rpsContractAddress, signers.alice.address)
      .add8(aliceChoice)
      .encrypt();

    progress(`Alice submitting choice for gameId=${gameId}...`);
    let tx = await rpsContract
      .connect(signers.alice)
      .makeChoice(gameId, encryptedAliceChoice.handles[0], encryptedAliceChoice.inputProof);
    await tx.wait();
    console.log(`Alice's choice submitted`);

    // Bob makes choice (Paper = 2)
    progress(`Bob encrypting choice: Paper (2)...`);
    const bobChoice = 2;
    const encryptedBobChoice = await fhevm
      .createEncryptedInput(rpsContractAddress, signers.bob.address)
      .add8(bobChoice)
      .encrypt();

    progress(`Bob submitting choice for gameId=${gameId}...`);
    tx = await rpsContract
      .connect(signers.bob)
      .makeChoice(gameId, encryptedBobChoice.handles[0], encryptedBobChoice.inputProof);
    await tx.wait();
    console.log(`Bob's choice submitted`);

    progress(`Verifying game state...`);
    const game = await rpsContract.getGame(gameId);
    expect(game.player1Made).to.eq(true);
    expect(game.player2Made).to.eq(true);
  });

  it("should get player games on Sepolia", async function () {
    steps = 2;
    this.timeout(60000);

    // Create a game
    progress(`Creating game...`);
    const tx = await rpsContract.connect(signers.alice).createGame(signers.bob.address);
    await tx.wait();

    progress(`Getting player games for ${signers.alice.address}...`);
    const aliceGames = await rpsContract.getPlayerGames(signers.alice.address);
    console.log(`Alice's games: ${aliceGames}`);
    expect(aliceGames.length).to.be.gte(1);
  });
});

