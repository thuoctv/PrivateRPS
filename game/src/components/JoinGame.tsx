import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useContractInteraction } from '../hooks/useContractInteraction';
import '../styles/JoinGame.css';

export function JoinGame() {
  const { address } = useAccount();
  const [gameId, setGameId] = useState('');
  const [selectedChoice, setSelectedChoice] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [gameInfo, setGameInfo] = useState<any>(null);

  const { instance } = useZamaInstance();
  const { getGame, makeChoice, contractAddress, subscribeToChoiceMadeEvent, subscribeToGameRevealedEvent } = useContractInteraction();

  const choices = [
    { value: 1, name: 'Rock', emoji: '🪨', description: 'Crushes Scissors' },
    { value: 2, name: 'Paper', emoji: '📄', description: 'Covers Rock' },
    { value: 3, name: 'Scissors', emoji: '✂️', description: 'Cuts Paper' }
  ];

  const fetchGameInfo = async () => {
    if (!gameId || !parseInt(gameId)) return;

    try {
      const game = await getGame(parseInt(gameId));
      setGameInfo(game);
      setError('');
    } catch (err: any) {
      setError('Game not found or invalid game ID');
      setGameInfo(null);
    }
  };

  useEffect(() => {
    if (gameId) {
      fetchGameInfo();
    }
  }, [gameId]);

  // Handle real-time events for the current game
  const handleChoiceMadeEvent = useCallback((eventGameId: number, player: string) => {
    if (gameInfo && eventGameId === parseInt(gameId)) {
      console.log('Received ChoiceMade event for current game:', { eventGameId, player });
      setGameInfo((prev: any) => {
        if (!prev) return prev;
        const isPlayer1 = prev.player1.toLowerCase() === player.toLowerCase();
        return {
          ...prev,
          player1Made: isPlayer1 ? true : prev.player1Made,
          player2Made: !isPlayer1 ? true : prev.player2Made,
        };
      });
    }
  }, [gameInfo, gameId]);

  const handleGameRevealedEvent = useCallback((eventGameId: number, result: number, choice1: number, choice2: number) => {
    if (gameInfo && eventGameId === parseInt(gameId)) {
      console.log('Received GameRevealed event for current game:', { eventGameId, result, choice1, choice2 });
      setGameInfo((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          revealed: true,
          result,
          revealedChoice1: choice1,
          revealedChoice2: choice2
        };
      });
    }
  }, [gameInfo, gameId]);

  // Set up event listeners for real-time updates
  useEffect(() => {
    if (gameId && parseInt(gameId)) {
      const choiceCleanup = subscribeToChoiceMadeEvent(handleChoiceMadeEvent);
      const revealCleanup = subscribeToGameRevealedEvent(handleGameRevealedEvent);

      return () => {
        choiceCleanup();
        revealCleanup();
      };
    }
  }, [gameId, subscribeToChoiceMadeEvent, subscribeToGameRevealedEvent, handleChoiceMadeEvent, handleGameRevealedEvent]);

  const canMakeChoice = () => {
    if (!gameInfo || !address) return false;

    const isPlayer = gameInfo.player1.toLowerCase() === address.toLowerCase() ||
                     gameInfo.player2.toLowerCase() === address.toLowerCase();

    if (!isPlayer) return false;
    if (gameInfo.revealed) return false;

    const isPlayer1 = gameInfo.player1.toLowerCase() === address.toLowerCase();
    return isPlayer1 ? !gameInfo.player1Made : !gameInfo.player2Made;
  };

  const handleMakeChoice = async () => {
    if (!instance || !selectedChoice || !gameId) {
      setError('Please select a choice and ensure wallet is connected');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      // Create encrypted input for the choice
      console.log("createEncryptedInput:",address,selectedChoice);
      
      const input = instance.createEncryptedInput(contractAddress, address!);
      input.add8(selectedChoice);
      const encryptedInput = await input.encrypt();

      await makeChoice(
        parseInt(gameId),
        encryptedInput.handles[0],
        encryptedInput.inputProof
      );

      setSuccess('Choice submitted successfully!');
      setSelectedChoice(0);
      await fetchGameInfo(); // Refresh game info
    } catch (err: any) {
      setError(err.message || 'Failed to submit choice');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPlayerStatus = () => {
    if (!gameInfo || !address) return '';

    const isPlayer1 = gameInfo.player1.toLowerCase() === address.toLowerCase();
    const isPlayer2 = gameInfo.player2.toLowerCase() === address.toLowerCase();

    if (!isPlayer1 && !isPlayer2) return 'You are not a player in this game';

    if (gameInfo.revealed) return `Game completed! Result: ${['Pending', 'Draw', 'Player 1 Wins', 'Player 2 Wins'][gameInfo.result]}`;

    // Check if both players have made their choices
    if (gameInfo.player1Made && gameInfo.player2Made) {
      return 'Both players ready! Game can be revealed.';
    }

    if (isPlayer1) {
      return gameInfo.player1Made ? 'You have already made your choice. Waiting for Player 2.' : 'Make your choice!';
    } else {
      return gameInfo.player2Made ? 'You have already made your choice. Waiting for Player 1.' : 'Make your choice!';
    }
  };

  const getChoiceDisplay = (choice: number) => {
    const choices = {
      0: { emoji: '❓', name: 'Unknown' },
      1: { emoji: '🪨', name: 'Rock' },
      2: { emoji: '📄', name: 'Paper' },
      3: { emoji: '✂️', name: 'Scissors' }
    };
    return choices[choice as keyof typeof choices] || choices[0];
  };

  return (
    <div className="join-game-container">
      <div className="join-game-card">
        <h2 className="join-game-title">Join Game</h2>

        <div className="form-group">
          <label htmlFor="gameId" className="form-label">
            Game ID
          </label>
          <input
            id="gameId"
            type="number"
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            placeholder="Enter game ID"
            className="form-input"
          />
        </div>

        {gameInfo && (
          <div className="game-info">
            <h3>Game Information</h3>
            <div className="game-details">
              <p><strong>Player 1:</strong> {gameInfo.player1}</p>
              <p><strong>Player 2:</strong> {gameInfo.player2}</p>
              <p><strong>Player 1 Ready:</strong> {gameInfo.player1Made ? '✅' : '❌'}</p>
              <p><strong>Player 2 Ready:</strong> {gameInfo.player2Made ? '✅' : '❌'}</p>
              <p><strong>Status:</strong> {getPlayerStatus()}</p>

              {gameInfo.revealed && (
                <div className="revealed-choices">
                  <h4>Game Results</h4>
                  <div className="choice-results">
                    <div className="player-choice">
                      <span>Player 1 chose: </span>
                      <span className="choice-emoji">{getChoiceDisplay(gameInfo.revealedChoice1).emoji}</span>
                      <span className="choice-name">{getChoiceDisplay(gameInfo.revealedChoice1).name}</span>
                    </div>
                    <div className="player-choice">
                      <span>Player 2 chose: </span>
                      <span className="choice-emoji">{getChoiceDisplay(gameInfo.revealedChoice2).emoji}</span>
                      <span className="choice-name">{getChoiceDisplay(gameInfo.revealedChoice2).name}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {gameInfo && canMakeChoice() && (
          <div className="choice-selection">
            <h3>Make Your Choice</h3>
            <div className="choices-grid">
              {choices.map((choice) => (
                <button
                  key={choice.value}
                  onClick={() => setSelectedChoice(choice.value)}
                  className={`choice-button ${selectedChoice === choice.value ? 'selected' : ''}`}
                  disabled={isSubmitting}
                >
                  <div className="choice-emoji">{choice.emoji}</div>
                  <div className="choice-name">{choice.name}</div>
                  <div className="choice-description">{choice.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}

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

        {gameInfo && canMakeChoice() && selectedChoice > 0 && (
          <button
            onClick={handleMakeChoice}
            disabled={isSubmitting}
            className="submit-choice-button"
          >
            {isSubmitting ? 'Submitting Choice...' : `Submit ${choices.find(c => c.value === selectedChoice)?.name}`}
          </button>
        )}
      </div>
    </div>
  );
}