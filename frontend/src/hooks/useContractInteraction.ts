import { ethers } from 'ethers';
import type { Log } from 'ethers';
import { useState, useCallback } from 'react';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import { useZamaInstance } from './useZamaInstance';

export function useContractInteraction() {
  const [isLoading, setIsLoading] = useState(false);
  const { instance } = useZamaInstance();

  const getProvider = useCallback(() => {
    if (!window.ethereum) {
      throw new Error('No ethereum provider found');
    }
    return new ethers.BrowserProvider(window.ethereum);
  }, []);

  const getContract = useCallback(
    async (withSigner = false) => {
      const provider = getProvider();

      if (withSigner) {
        const signer = await provider.getSigner();
        return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      }

      return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    },
    [getProvider],
  );

  const createGame = async (player2Address: string): Promise<number> => {
    setIsLoading(true);
    try {
      const contract = await getContract(true);
      const tx = await contract.createGame(player2Address);
      const receipt = await tx.wait();

      // Find the GameCreated event to get the game ID
      const gameCreatedEvent = receipt.logs.find((log: Log) => {
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
    inputProof: string,
  ): Promise<void> => {
    setIsLoading(true);
    try {
      const contract = await getContract(true);
      console.log('makeChoice:', gameId, encryptedChoice, inputProof);

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

      let revealRequested = false;
      try {
        const gameDetails = await contract.games(gameId);
        revealRequested = Boolean(
          gameDetails?.revealRequested ?? gameDetails?.[6],
        );
      } catch (readError) {
        console.warn('Unable to read game details before reveal:', readError);
      }

      if (!revealRequested) {
        console.log(
          'Calling revealGame to mark ciphertexts publicly decryptable...',
        );
        const revealTx = await contract.revealGame(gameId);
        const revealReceipt = await revealTx.wait();
        console.log('revealGame transaction confirmed:', revealReceipt.hash);
      } else {
        console.log(
          'Reveal already requested, skipping revealGame transaction.',
        );
      }

      console.log('Fetching encrypted choice handles...');
      const handlesList = await contract.getGameChoices(gameId);

      if (!instance) {
        throw new Error(
          'Zama instance not initialized. Please wait for encryption service to be ready.',
        );
      }

      console.log('Decrypting off-chain using relayer SDK...');
      const normalizeHandle = (handle: string | Uint8Array) =>
        (typeof handle === 'string'
          ? handle
          : ethers.hexlify(handle)
        ).toLowerCase();
      const normalizedHandles = handlesList.map((handle: string | Uint8Array) =>
        normalizeHandle(handle),
      );

      const decryptionResult = await instance.publicDecrypt(handlesList);
      console.log('Decryption result:', decryptionResult);

      const valuesMap = (decryptionResult?.clearValues ??
        decryptionResult?.values ??
        {}) as Record<string, string | number | undefined>;
      const resolvedValues = normalizedHandles.map(
        (handle: string) => valuesMap[handle],
      );

      if (
        resolvedValues.some(
          (value: string | number | undefined) => value === undefined,
        )
      ) {
        throw new Error(
          'Missing decrypted values. Please try revealing again.',
        );
      }

      const numericChoices = resolvedValues as Array<string | number>;
      const [choice1, choice2] = numericChoices.map((value) => Number(value));

      const decryptionProof =
        decryptionResult?.decryptionProof ?? decryptionResult?.proof;
      if (!decryptionProof) {
        throw new Error('Missing decryption proof from relayer.');
      }

      console.log(
        'Calling finalizeGameReveal with decrypted values and proof...',
      );
      const finalizeTx = await contract.finalizeGameReveal(
        gameId,
        choice1,
        choice2,
        decryptionProof,
      );
      const finalizeReceipt = await finalizeTx.wait();
      console.log(
        'finalizeGameReveal transaction confirmed:',
        finalizeReceipt.hash,
      );
      console.log('Game revealed successfully!');
    } catch (err: unknown) {
      console.error('Error in revealGame:', err);
      if (err instanceof Error) {
        throw err;
      }
      throw new Error('Failed to reveal game');
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
      createdAt: Number(result[8]),
    };
  };

  const getPlayerGames = async (playerAddress: string): Promise<number[]> => {
    const contract = await getContract(false);
    const result = (await contract.getPlayerGames(
      playerAddress,
    )) as Array<bigint>;
    return result.map((id) => Number(id));
  };

  // Event listening functions
  const subscribeToChoiceMadeEvent = useCallback(
    (callback: (gameId: number, player: string) => void) => {
      let cleanupFunc: (() => void) | null = null;

      const setupListener = async () => {
        try {
          const contract = await getContract(false);

          const listener = (gameId: bigint, player: string) => {
            console.log('ChoiceMade event:', {
              gameId: Number(gameId),
              player,
            });
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
    },
    [getContract],
  );

  const subscribeToGameRevealedEvent = useCallback(
    (
      callback: (
        gameId: number,
        result: number,
        choice1: number,
        choice2: number,
      ) => void,
    ) => {
      let cleanupFunc: (() => void) | null = null;

      const setupListener = async () => {
        try {
          const contract = await getContract(false);

          const listener = (
            gameId: bigint,
            result: number,
            choice1: number,
            choice2: number,
          ) => {
            console.log('GameRevealed event:', {
              gameId: Number(gameId),
              result,
              choice1,
              choice2,
            });
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
    },
    [getContract],
  );

  return {
    createGame,
    makeChoice,
    revealGame,
    getGame,
    getPlayerGames,
    subscribeToChoiceMadeEvent,
    subscribeToGameRevealedEvent,
    isLoading,
    contractAddress: CONTRACT_ADDRESS,
  };
}
