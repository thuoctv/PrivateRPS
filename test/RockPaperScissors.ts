import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { RockPaperScissors, RockPaperScissors__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("RockPaperScissors")) as RockPaperScissors__factory;
  const rpsContract = (await factory.deploy()) as RockPaperScissors;
  const rpsContractAddress = await rpsContract.getAddress();

  return { rpsContract, rpsContractAddress };
}

describe("RockPaperScissors", function () {
  let signers: Signers;
  let rpsContract: RockPaperScissors;
  let rpsContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ rpsContract, rpsContractAddress } = await deployFixture());
  });

  it("should deploy successfully", async function () {
    expect(await rpsContract.gameCounter()).to.eq(0);
  });

  it("should create a new game", async function () {
    const tx = await rpsContract.connect(signers.alice).createGame(signers.bob.address);
    const receipt = await tx.wait();
    
    expect(await rpsContract.gameCounter()).to.eq(1);
    
    const game = await rpsContract.getGame(1);
    expect(game.player1).to.eq(signers.alice.address);
    expect(game.player2).to.eq(signers.bob.address);
    expect(game.player1Made).to.eq(false);
    expect(game.player2Made).to.eq(false);
    expect(game.revealed).to.eq(false);
    expect(game.result).to.eq(0); // GameResult.Pending
  });

  it("should not allow creating game with same player", async function () {
    await expect(
      rpsContract.connect(signers.alice).createGame(signers.alice.address)
    ).to.be.revertedWith("Cannot play against yourself");
  });

  it("should allow players to make encrypted choices", async function () {
    // Create game
    await rpsContract.connect(signers.alice).createGame(signers.bob.address);
    
    // Alice makes choice (Rock = 1)
    const aliceChoice = 1;
    const encryptedAliceChoice = await fhevm
      .createEncryptedInput(rpsContractAddress, signers.alice.address)
      .add8(aliceChoice)
      .encrypt();

    let tx = await rpsContract
      .connect(signers.alice)
      .makeChoice(1, encryptedAliceChoice.handles[0], encryptedAliceChoice.inputProof);
    await tx.wait();

    // Bob makes choice (Paper = 2)
    const bobChoice = 2;
    const encryptedBobChoice = await fhevm
      .createEncryptedInput(rpsContractAddress, signers.bob.address)
      .add8(bobChoice)
      .encrypt();

    tx = await rpsContract
      .connect(signers.bob)
      .makeChoice(1, encryptedBobChoice.handles[0], encryptedBobChoice.inputProof);
    await tx.wait();

    const game = await rpsContract.getGame(1);
    expect(game.player1Made).to.eq(true);
    expect(game.player2Made).to.eq(true);
  });

  it("should not allow non-players to make choices", async function () {
    // Create game between Alice and Bob
    await rpsContract.connect(signers.alice).createGame(signers.bob.address);
    
    const choice = 1;
    const encryptedChoice = await fhevm
      .createEncryptedInput(rpsContractAddress, signers.deployer.address)
      .add8(choice)
      .encrypt();

    // Deployer (not a player) tries to make choice
    await expect(
      rpsContract
        .connect(signers.deployer)
        .makeChoice(1, encryptedChoice.handles[0], encryptedChoice.inputProof)
    ).to.be.revertedWith("Not a player in this game");
  });

  it("should not allow revealing game before both players make choices", async function () {
    // Create game
    await rpsContract.connect(signers.alice).createGame(signers.bob.address);
    
    // Only Alice makes choice
    const aliceChoice = 1;
    const encryptedAliceChoice = await fhevm
      .createEncryptedInput(rpsContractAddress, signers.alice.address)
      .add8(aliceChoice)
      .encrypt();

    await rpsContract
      .connect(signers.alice)
      .makeChoice(1, encryptedAliceChoice.handles[0], encryptedAliceChoice.inputProof);

    // Try to reveal before Bob makes choice
    await expect(
      rpsContract.connect(signers.alice).revealGame(1)
    ).to.be.revertedWith("Both players must make choices");
  });

  it("should allow revealing game after both players make choices", async function () {
    // Create game
    await rpsContract.connect(signers.alice).createGame(signers.bob.address);
    
    // Alice makes choice (Rock = 1)
    const aliceChoice = 1;
    const encryptedAliceChoice = await fhevm
      .createEncryptedInput(rpsContractAddress, signers.alice.address)
      .add8(aliceChoice)
      .encrypt();

    await rpsContract
      .connect(signers.alice)
      .makeChoice(1, encryptedAliceChoice.handles[0], encryptedAliceChoice.inputProof);

    // Bob makes choice (Paper = 2)
    const bobChoice = 2;
    const encryptedBobChoice = await fhevm
      .createEncryptedInput(rpsContractAddress, signers.bob.address)
      .add8(bobChoice)
      .encrypt();

    await rpsContract
      .connect(signers.bob)
      .makeChoice(1, encryptedBobChoice.handles[0], encryptedBobChoice.inputProof);

    // Reveal game
    const tx = await rpsContract.connect(signers.alice).revealGame(1);
    await tx.wait();

    // Game should now have decryption pending
    expect(await rpsContract.decryptionPending()).to.eq(true);
    expect(await rpsContract.pendingGameId()).to.eq(1);
  });

  it("should return player games correctly", async function () {
    // Create multiple games
    await rpsContract.connect(signers.alice).createGame(signers.bob.address);
    await rpsContract.connect(signers.bob).createGame(signers.alice.address);
    
    const aliceGames = await rpsContract.getPlayerGames(signers.alice.address);
    const bobGames = await rpsContract.getPlayerGames(signers.bob.address);
    
    expect(aliceGames.length).to.eq(2);
    expect(bobGames.length).to.eq(2);
    expect(aliceGames[0]).to.eq(1);
    expect(aliceGames[1]).to.eq(2);
    expect(bobGames[0]).to.eq(1);
    expect(bobGames[1]).to.eq(2);
  });

  it("should allow players to view their game choices", async function () {
    // Create game and make choices
    await rpsContract.connect(signers.alice).createGame(signers.bob.address);
    
    const aliceChoice = 1;
    const encryptedAliceChoice = await fhevm
      .createEncryptedInput(rpsContractAddress, signers.alice.address)
      .add8(aliceChoice)
      .encrypt();

    await rpsContract
      .connect(signers.alice)
      .makeChoice(1, encryptedAliceChoice.handles[0], encryptedAliceChoice.inputProof);

    const bobChoice = 2;
    const encryptedBobChoice = await fhevm
      .createEncryptedInput(rpsContractAddress, signers.bob.address)
      .add8(bobChoice)
      .encrypt();

    await rpsContract
      .connect(signers.bob)
      .makeChoice(1, encryptedBobChoice.handles[0], encryptedBobChoice.inputProof);

    // Players can view their choices
    const choices = await rpsContract.connect(signers.alice).getGameChoices(1);
    expect(choices.length).to.eq(2);
  });

  it("should not allow non-players to view game choices", async function () {
    // Create game between Alice and Bob
    await rpsContract.connect(signers.alice).createGame(signers.bob.address);
    
    // Deployer (not a player) tries to view choices
    await expect(
      rpsContract.connect(signers.deployer).getGameChoices(1)
    ).to.be.revertedWith("Not a player in this game");
  });
});