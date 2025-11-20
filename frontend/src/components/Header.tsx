import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <div className="header-left">
            <div className="logo-mark">FHE</div>
            <div>
              <p className="header-label">Rock · Paper · Scissors</p>
              <h1 className="header-title">Create Confidential On-chain Duels</h1>
              <p className="header-tagline">No leaking moves. Fully homomorphic battles.</p>
            </div>
          </div>
          <div className="header-actions">
            <span className="network-pill">FHEVM Testnet</span>
            <ConnectButton />
          </div>
        </div>
      </div>
    </header>
  );
}