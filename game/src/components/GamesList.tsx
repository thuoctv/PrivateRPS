import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useContractInteraction } from '../hooks/useContractInteraction';
import '../styles/GamesList.css';

interface Game {
  gameId: number;
  player1: string;
  player2: string;
  player1Made: boolean;
  player2Made: boolean;
  revealed: boolean;
  result: number;
  revealedChoice1: number;
  revealedChoice2: number;
  createdAt: number;
}

export function GamesList() {
  const { address } = useAccount();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { getPlayerGames, getGame, revealGame, subscribeToChoiceMadeEvent, subscribeToGameRevealedEvent } = useContractInteraction();

  const loadGames = async () => {
    if (!address) return;

    setLoading(true);
    setError('');

    try {
      const gameIds = await getPlayerGames(address);
      const gameDetails = await Promise.all(
        gameIds.map(async (id) => {
          const game = await getGame(Number(id));
          return {
            gameId: Number(id),
            ...game
          };
        })
      );

      // Sort by creation time, newest first
      gameDetails.sort((a, b) => b.createdAt - a.createdAt);
      setGames(gameDetails);
    } catch (err: any) {
      setError('Failed to load games');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Handle real-time events
  const handleChoiceMadeEvent = useCallback((gameId: number, player: string) => {
    console.log('Received ChoiceMade event:', { gameId, player });
    // Update the specific game in our state
    setGames(prevGames =>
      prevGames.map(game => {
        if (game.gameId === gameId) {
          const isPlayer1 = game.player1.toLowerCase() === player.toLowerCase();
          return {
            ...game,
            player1Made: isPlayer1 ? true : game.player1Made,
            player2Made: !isPlayer1 ? true : game.player2Made,
          };
        }
        return game;
      })
    );
  }, []);

  const handleGameRevealedEvent = useCallback((gameId: number, result: number, choice1: number, choice2: number) => {
    console.log('Received GameRevealed event:', { gameId, result, choice1, choice2 });
    // Update the specific game in our state
    setGames(prevGames =>
      prevGames.map(game =>
        game.gameId === gameId
          ? { ...game, revealed: true, result, revealedChoice1: choice1, revealedChoice2: choice2 }
          : game
      )
    );
  }, []);

  useEffect(() => {
    loadGames();
  }, [address]);

  // Set up event listeners
  useEffect(() => {
    const choiceCleanup = subscribeToChoiceMadeEvent(handleChoiceMadeEvent);
    const revealCleanup = subscribeToGameRevealedEvent(handleGameRevealedEvent);

    return () => {
      choiceCleanup();
      revealCleanup();
    };
  }, [subscribeToChoiceMadeEvent, subscribeToGameRevealedEvent, handleChoiceMadeEvent, handleGameRevealedEvent]);

  const handleRevealGame = async (gameId: number) => {
    try {
      await revealGame(gameId);
      // Refresh the games list
      await loadGames();
    } catch (err: any) {
      setError(err.message || 'Failed to reveal game');
    }
  };

  const getGameStatus = (game: Game) => {
    if (game.revealed) {
      const results = ['Pending', 'Draw', 'Player 1 Wins', 'Player 2 Wins'];
      return results[game.result];
    }

    if (!game.player1Made && !game.player2Made) {
      return 'Waiting for both players';
    } else if (!game.player1Made) {
      return 'Waiting for Player 1';
    } else if (!game.player2Made) {
      return 'Waiting for Player 2';
    } else {
      return 'Ready to reveal';
    }
  };

  const canReveal = (game: Game) => {
    return !game.revealed && game.player1Made && game.player2Made;
  };

  const isPlayerTurn = (game: Game) => {
    if (!address || game.revealed) return false;

    const isPlayer1 = game.player1.toLowerCase() === address.toLowerCase();
    const isPlayer2 = game.player2.toLowerCase() === address.toLowerCase();

    if (isPlayer1 && !game.player1Made) return true;
    if (isPlayer2 && !game.player2Made) return true;

    return false;
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
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

  if (loading) {
    return (
      <div className="games-list-container">
        <div className="loading">Loading your games...</div>
      </div>
    );
  }

  return (
    <div className="games-list-container">
      <div className="games-list-header">
        <h2>My Games</h2>
        <button onClick={loadGames} className="refresh-button">
          Refresh
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {games.length === 0 ? (
        <div className="no-games">
          <p>No games found. Create a new game to get started!</p>
        </div>
      ) : (
        <div className="games-grid">
          {games.map((game) => (
            <div key={game.gameId} className={`game-card ${isPlayerTurn(game) ? 'your-turn' : ''}`}>
              <div className="game-header">
                <h3>Game #{game.gameId}</h3>
                <span className={`status-badge ${game.revealed ? 'completed' : 'active'}`}>
                  {getGameStatus(game)}
                </span>
              </div>

              <div className="game-details">
                <div className="players">
                  <div className="player">
                    <span className="player-label">Player 1:</span>
                    <span className="player-address">{formatAddress(game.player1)}</span>
                    <span className={`ready-status ${game.player1Made ? 'ready' : 'waiting'}`}>
                      {game.player1Made ? '✅' : '⏳'}
                    </span>
                  </div>
                  <div className="player">
                    <span className="player-label">Player 2:</span>
                    <span className="player-address">{formatAddress(game.player2)}</span>
                    <span className={`ready-status ${game.player2Made ? 'ready' : 'waiting'}`}>
                      {game.player2Made ? '✅' : '⏳'}
                    </span>
                  </div>
                </div>

                <div className="game-meta">
                  <p className="created-date">Created: {formatDate(game.createdAt)}</p>
                </div>
              </div>

              <div className="game-actions">
                {isPlayerTurn(game) && (
                  <div className="turn-indicator">
                    <span className="turn-text">Your turn to play!</span>
                  </div>
                )}

                {canReveal(game) && (
                  <button
                    onClick={() => handleRevealGame(game.gameId)}
                    className="reveal-button"
                  >
                    Reveal Results
                  </button>
                )}

                {game.revealed && (
                  <div className="game-result">
                    <div className={`result ${game.result === 1 ? 'draw' : game.result === 2 ? 'player1-wins' : 'player2-wins'}`}>
                      <strong>{getGameStatus(game)}</strong>
                      {game.result === 2 && game.player1.toLowerCase() === address?.toLowerCase() && (
                        <span className="you-won"> - You Won! 🎉</span>
                      )}
                      {game.result === 3 && game.player2.toLowerCase() === address?.toLowerCase() && (
                        <span className="you-won"> - You Won! 🎉</span>
                      )}
                      {game.result === 1 && (
                        <span className="draw-result"> - It's a Draw!</span>
                      )}
                    </div>
                    <div className="choices-revealed">
                      <div className="choice-display">
                        <span className="player-label">Player 1 chose:</span>
                        <span className="choice-emoji">{getChoiceDisplay(game.revealedChoice1).emoji}</span>
                        <span className="choice-name">{getChoiceDisplay(game.revealedChoice1).name}</span>
                      </div>
                      <div className="choice-display">
                        <span className="player-label">Player 2 chose:</span>
                        <span className="choice-emoji">{getChoiceDisplay(game.revealedChoice2).emoji}</span>
                        <span className="choice-name">{getChoiceDisplay(game.revealedChoice2).name}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}