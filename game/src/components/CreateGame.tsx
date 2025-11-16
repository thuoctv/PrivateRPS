import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import { useContractInteraction } from '../hooks/useContractInteraction';
import '../styles/CreateGame.css';

export function CreateGame() {
  const { address } = useAccount();
  const [player2Address, setPlayer2Address] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { createGame } = useContractInteraction();

  const validateAddress = (addr: string): boolean => {
    try {
      ethers.isAddress(addr);
      return true;
    } catch {
      return false;
    }
  };

  const handleCreateGame = async () => {
    if (!player2Address) {
      setError('Please enter player 2 address');
      return;
    }

    if (!validateAddress(player2Address)) {
      setError('Invalid Ethereum address');
      return;
    }

    if (player2Address.toLowerCase() === address?.toLowerCase()) {
      setError('Cannot play against yourself');
      return;
    }

    setIsCreating(true);
    setError('');
    setSuccess('');

    try {
      const gameId = await createGame(player2Address);
      setSuccess(`Game created successfully! Game ID: ${gameId}`);
      setPlayer2Address('');
    } catch (err: any) {
      setError(err.message || 'Failed to create game');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="create-game-container">
      <div className="create-game-card">
        <h2 className="create-game-title">Create New Game</h2>
        <p className="create-game-description">
          Start a new Rock Paper Scissors game by inviting another player
        </p>

        <div className="form-group">
          <label htmlFor="player2" className="form-label">
            Player 2 Address
          </label>
          <input
            id="player2"
            type="text"
            value={player2Address}
            onChange={(e) => setPlayer2Address(e.target.value)}
            placeholder="0x..."
            className="form-input"
            disabled={isCreating}
          />
          <p className="form-hint">
            Enter the Ethereum address of the player you want to challenge
          </p>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {success && (
          <div className="success-message">
            {success}
          </div>
        )}

        <button
          onClick={handleCreateGame}
          disabled={isCreating || !player2Address}
          className="create-game-button"
        >
          {isCreating ? 'Creating Game...' : 'Create Game'}
        </button>

        <div className="game-rules">
          <h3>Game Rules:</h3>
          <ul>
            <li>Rock (1) beats Scissors (3)</li>
            <li>Paper (2) beats Rock (1)</li>
            <li>Scissors (3) beats Paper (2)</li>
            <li>Both players must make their choice before revealing</li>
            <li>Choices are encrypted and hidden until revelation</li>
          </ul>
        </div>
      </div>
    </div>
  );
}