import { ethers } from 'ethers';
import { useState, useCallback } from 'react';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import { useZamaInstance } from './useZamaInstance';

export function useContractInteraction() {
  const [isLoading, setIsLoading] = useState(false);
  const { instance } = useZamaInstance();


  const getProvider = () => {
    if (!window.ethereum) {
      throw new Error('No ethereum provider found');
    }
    return new ethers.BrowserProvider(window.ethereum);
  };

  const getContract = async (withSigner = false) => {
    const provider = getProvider();

    if (withSigner) {
      const signer = await provider.getSigner();
      return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    }

    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
  };

  const createGame = async (player2Address: string): Promise<number> => {
    setIsLoading(true);
    try {
      const contract = await getContract(true);
      const tx = await contract.createGame(player2Address);
      const receipt = await tx.wait();

      // Find the GameCreated event to get the game ID
      const gameCreatedEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = contract.interface.parseLog(log);
          return parsed?.name === 'GameCreated';
        } catch {
          return false;
        }
      });

      if (gameCreatedEvent) {
        const parsed = contract.interface.parseLog(gameCreatedEvent);
        return Number(parsed?.args?.gameId);
      }

      throw new Error('Game creation event not found');
    } finally {
      setIsLoading(false);
    }
  };

  const makeChoice = async (
    gameId: number,
    encryptedChoice: string,
    inputProof: string
  ): Promise<void> => {
    setIsLoading(true);
    try {
      const contract = await getContract(true);
      console.log("makeChoice:",gameId,encryptedChoice,inputProof);
      
      const tx = await contract.makeChoice(gameId, encryptedChoice, inputProof);
      await tx.wait();
    } finally {
      setIsLoading(false);
    }
  };

  const revealGame = async (gameId: number): Promise<void> => {
    setIsLoading(true);
    try {
      const contract = await getContract(true);
      let shouldTriggerRevealTx = true;

      const decryptionPending = await contract.decryptionPending();
      if (decryptionPending) {
        const pendingId = Number(await contract.pendingGameId());
        if (pendingId === gameId) {
          console.log('Decryption already pending for this game. Resuming decryption flow without calling revealGame.');
          shouldTriggerRevealTx = false;
        } else {
          throw new Error(`Another decryption is currently in progress for game ${pendingId}. Please wait for it to finish before revealing another game.`);
        }
      }

      if (shouldTriggerRevealTx) {
        // Step 1: Call revealGame to make choices publicly decryptable
        // This will call _determineWinner() which sets decryptionPending = true
        console.log('Step 1: Calling revealGame to make choices publicly decryptable...');
        const revealTx = await contract.revealGame(gameId);
        const revealReceipt = await revealTx.wait();
        console.log('revealGame transaction confirmed:', revealReceipt.hash);
        
        // Step 2: Wait a bit for the contract state to update
        // (decryptionPending should now be true)
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.log('Skipping revealGame transaction because decryption is already pending for this game.');
      }
      
      // Step 3: Get the encrypted choices (handles) from contract
      console.log('Step 2: Fetching game choices (handles) from contract...');
      const [handle1, handle2] = await contract.getGameChoices(gameId);
      console.log('Handles retrieved:', { handle1, handle2 });
      
      // Step 4: Decrypt off-chain using relayer-sdk
      if (!instance) {
        throw new Error('Zama instance not initialized. Please wait for encryption service to be ready.');
      }
      
      console.log('Step 3: Decrypting off-chain using Zama relayer-sdk...');
      const handlesList = [handle1, handle2];
      
      // Call publicDecrypt from Zama instance
      // Note: API might be different in v0.3, adjust if needed
      const normalizeHandle = (handle: string | Uint8Array) =>
        (typeof handle === 'string' ? handle : ethers.hexlify(handle)).toLowerCase();

      const normalizedHandles = handlesList.map((handle: string | Uint8Array) => normalizeHandle(handle));

      const decryptionResult = await instance.publicDecrypt(handlesList);
      console.log('Decryption result:', decryptionResult);

      const clearValues = decryptionResult?.clearValues ?? {};
      const resolvedValues = normalizedHandles.map((handle) => clearValues[handle as keyof typeof clearValues]);

      let cleartexts: string | null = decryptionResult?.abiEncodedClearValues ?? null;
      if (!cleartexts) {
        if (resolvedValues.some((value) => value === undefined)) {
          throw new Error('Decryption failed. Please try revealing again.');
        }

        // Step 5: Encode cleartexts as ABI-encoded (uint8, uint8)
        // The contract expects: abi.decode(cleartexts, (uint8, uint8))
        cleartexts = ethers.AbiCoder.defaultAbiCoder().encode(
          ['uint8', 'uint8'],
          resolvedValues.map((value) => Number(value))
        );
      }

      const decryptionProof = decryptionResult?.decryptionProof ?? decryptionResult?.proof;
      if (!decryptionProof) {
        throw new Error('Missing decryption proof from relayer.');
      }
      
      // Step 6: Call decryptionCallback with handlesList, cleartexts, and proof
      console.log('Step 4: Calling decryptionCallback with decrypted values and proof...');
      const callbackTx = await contract.decryptionCallback(
        handlesList,
        cleartexts,
        decryptionProof
      );
      
      const callbackReceipt = await callbackTx.wait();
      console.log('decryptionCallback transaction confirmed:', callbackReceipt.hash);
      console.log('Game revealed successfully!');
      
    } catch (err: any) {
      console.error('Error in revealGame:', err);
      throw new Error(err.message || 'Failed to reveal game');
    } finally {
      setIsLoading(false);
    }
  };

  const getGame = async (gameId: number) => {
    const contract = await getContract(false);
    const result = await contract.getGame(gameId);

    return {
      player1: result[0],
      player2: result[1],
      player1Made: result[2],
      player2Made: result[3],
      revealed: result[4],
      result: Number(result[5]),
      revealedChoice1: Number(result[6]),
      revealedChoice2: Number(result[7]),
      createdAt: Number(result[8])
    };
  };

  const getPlayerGames = async (playerAddress: string): Promise<number[]> => {
    const contract = await getContract(false);
    const result = await contract.getPlayerGames(playerAddress);
    return result.map((id: any) => Number(id));
  };

  // Event listening functions
  const subscribeToChoiceMadeEvent = useCallback((callback: (gameId: number, player: string) => void) => {
    let cleanupFunc: (() => void) | null = null;

    const setupListener = async () => {
      try {
        const contract = await getContract(false);

        const listener = (gameId: bigint, player: string) => {
          console.log('ChoiceMade event:', { gameId: Number(gameId), player });
          callback(Number(gameId), player);
        };

        contract.on('ChoiceMade', listener);

        cleanupFunc = () => {
          contract.off('ChoiceMade', listener);
        };

        console.log('Subscribed to ChoiceMade events');
      } catch (error) {
        console.error('Failed to subscribe to ChoiceMade events:', error);
      }
    };

    setupListener();

    // Return cleanup function
    return () => {
      if (cleanupFunc) {
        cleanupFunc();
      }
    };
  }, []);

  const subscribeToGameRevealedEvent = useCallback((callback: (gameId: number, result: number, choice1: number, choice2: number) => void) => {
    let cleanupFunc: (() => void) | null = null;

    const setupListener = async () => {
      try {
        const contract = await getContract(false);

        const listener = (gameId: bigint, result: number, choice1: number, choice2: number) => {
          console.log('GameRevealed event:', { gameId: Number(gameId), result, choice1, choice2 });
          callback(Number(gameId), result, choice1, choice2);
        };

        contract.on('GameRevealed', listener);

        cleanupFunc = () => {
          contract.off('GameRevealed', listener);
        };

        console.log('Subscribed to GameRevealed events');
      } catch (error) {
        console.error('Failed to subscribe to GameRevealed events:', error);
      }
    };

    setupListener();

    // Return cleanup function
    return () => {
      if (cleanupFunc) {
        cleanupFunc();
      }
    };
  }, []);


  return {
    createGame,
    makeChoice,
    revealGame,
    getGame,
    getPlayerGames,
    subscribeToChoiceMadeEvent,
    subscribeToGameRevealedEvent,
    isLoading,
    contractAddress: CONTRACT_ADDRESS
  };
}