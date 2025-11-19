import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { Header } from './Header';
import { CreateGame } from './CreateGame';
import { JoinGame } from './JoinGame';
import { GamesList } from './GamesList';
import '../styles/RockPaperScissorsApp.css';

type SelectedGame = {
  id: number;
  token: number;
};

export function RockPaperScissorsApp() {
  const { isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<'create' | 'join' | 'games'>(
    'create',
  );
  const [selectedGame, setSelectedGame] = useState<SelectedGame | null>(null);

  const handleSelectGame = (gameId: number) => {
    setSelectedGame({
      id: gameId,
      token: Date.now(),
    });
    setActiveTab('join');
  };

  return (
    <div className="rps-app">
      <Header />

      <main className="main-content">
        {!isConnected ? (
          <div className="connect-wallet-container">
            <h2 className="connect-wallet-title">
              Connect Your Wallet to Play Rock Paper Scissors
            </h2>
            <p className="connect-wallet-description">
              Join the confidential Rock Paper Scissors game powered by Zama FHE
            </p>
            <ConnectButton />
          </div>
        ) : (
          <div>
            <div className="tab-navigation">
              <nav className="tab-nav">
                <button
                  onClick={() => setActiveTab('create')}
                  className={`tab-button ${activeTab === 'create' ? 'active' : 'inactive'}`}
                >
                  Create Game
                </button>
                <button
                  onClick={() => setActiveTab('join')}
                  className={`tab-button ${activeTab === 'join' ? 'active' : 'inactive'}`}
                >
                  Join Game
                </button>
                <button
                  onClick={() => setActiveTab('games')}
                  className={`tab-button ${activeTab === 'games' ? 'active' : 'inactive'}`}
                >
                  My Games
                </button>
              </nav>
            </div>

            {activeTab === 'create' && <CreateGame />}
            {activeTab === 'join' && <JoinGame selectedGame={selectedGame} />}
            {activeTab === 'games' && (
              <GamesList onSelectGame={handleSelectGame} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
