// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint8, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract RockPaperScissors is ZamaEthereumConfig {
    enum GameResult {
        Pending,
        Draw,
        Player1Wins,
        Player2Wins
    }
    enum Choice {
        None,
        Rock,
        Paper,
        Scissors
    }

    struct Game {
        address player1;
        address player2;
        euint8 choice1;
        euint8 choice2;
        bool player1Made;
        bool player2Made;
        bool revealRequested;
        bool revealed;
        GameResult result;
        uint8 revealedChoice1;
        uint8 revealedChoice2;
        uint256 createdAt;
    }

    uint256 public gameCounter;
    mapping(uint256 => Game) public games;
    mapping(address => uint256[]) public playerGames;

    event GameCreated(
        uint256 indexed gameId,
        address indexed player1,
        address indexed player2
    );
    event ChoiceMade(uint256 indexed gameId, address indexed player);
    event GameRevealed(
        uint256 indexed gameId,
        GameResult result,
        uint8 choice1,
        uint8 choice2
    );

    function createGame(address _player2) external returns (uint256) {
        require(_player2 != address(0), "Invalid player2 address");
        require(_player2 != msg.sender, "Cannot play against yourself");

        gameCounter++;
        uint256 gameId = gameCounter;

        games[gameId] = Game({
            player1: msg.sender,
            player2: _player2,
            choice1: FHE.asEuint8(0),
            choice2: FHE.asEuint8(0),
            player1Made: false,
            player2Made: false,
            revealRequested: false,
            revealed: false,
            result: GameResult.Pending,
            revealedChoice1: 0,
            revealedChoice2: 0,
            createdAt: block.timestamp
        });

        playerGames[msg.sender].push(gameId);
        playerGames[_player2].push(gameId);

        emit GameCreated(gameId, msg.sender, _player2);
        return gameId;
    }

    function makeChoice(
        uint256 _gameId,
        externalEuint8 _encryptedChoice,
        bytes calldata _inputProof
    ) external {
        // require(_gameId > 0 && _gameId <= gameCounter, "Invalid game ID");

        Game storage game = games[_gameId];
        require(!game.revealed, "Game already revealed");
        require(
            msg.sender == game.player1 || msg.sender == game.player2,
            "Not a player in this game"
        );

        euint8 choice = FHE.fromExternal(_encryptedChoice, _inputProof);

        if (msg.sender == game.player1) {
            require(!game.player1Made, "Player1 already made choice");
            game.choice1 = choice;
            game.player1Made = true;
            FHE.allowThis(game.choice1);
        } else {
            require(!game.player2Made, "Player2 already made choice");
            game.choice2 = choice;
            game.player2Made = true;
            FHE.allowThis(game.choice2);
        }

        emit ChoiceMade(_gameId, msg.sender);
    }

    function revealGame(uint256 _gameId) external {
        require(_gameId > 0 && _gameId <= gameCounter, "Invalid game ID");
        Game storage game = games[_gameId];
        require(
            msg.sender == game.player1 || msg.sender == game.player2,
            "Not a player in this game"
        );
        require(
            game.player1Made && game.player2Made,
            "Both players must make choices"
        );
        require(!game.revealed, "Game already revealed");

        require(!game.revealRequested, "Reveal already requested");

        // Mark both ciphertext handles as publicly decryptable so any client can
        // execute the off-chain publicDecrypt flow described in the Zama docs.
        FHE.makePubliclyDecryptable(game.choice1);
        FHE.makePubliclyDecryptable(game.choice2);
        game.revealRequested = true;

        emit RevealRequested(_gameId, game.choice1, game.choice2);
    }

    event RevealRequested(
        uint256 indexed gameId,
        euint8 player1ChoiceHandle,
        euint8 player2ChoiceHandle
    );

    function finalizeGameReveal(
        uint256 _gameId,
        uint8 _choice1,
        uint8 _choice2,
        bytes calldata _publicDecryptionProof
    ) external {
        require(_gameId > 0 && _gameId <= gameCounter, "Invalid game ID");

        Game storage game = games[_gameId];
        require(game.revealRequested, "Reveal not requested");
        require(!game.revealed, "Game already revealed");

        // Build the ciphertext handle list in the same order used when the
        // off-chain client called publicDecrypt([choice1, choice2]).
        bytes32[] memory handles = new bytes32[](2);
        handles[0] = FHE.toBytes32(game.choice1);
        handles[1] = FHE.toBytes32(game.choice2);

        bytes memory cleartexts = abi.encode(_choice1, _choice2);
        FHE.checkSignatures(handles, cleartexts, _publicDecryptionProof);

        GameResult result;
        if (_choice1 == _choice2) {
            result = GameResult.Draw;
        } else if (
            (_choice1 == 1 && _choice2 == 3) ||
            (_choice1 == 2 && _choice2 == 1) ||
            (_choice1 == 3 && _choice2 == 2)
        ) {
            result = GameResult.Player1Wins;
        } else {
            result = GameResult.Player2Wins;
        }

        game.result = result;
        game.revealed = true;
        game.revealedChoice1 = _choice1;
        game.revealedChoice2 = _choice2;

        emit GameRevealed(_gameId, result, _choice1, _choice2);
    }

    function getGame(
        uint256 _gameId
    )
        external
        view
        returns (
            address player1,
            address player2,
            bool player1Made,
            bool player2Made,
            bool revealed,
            GameResult result,
            uint8 revealedChoice1,
            uint8 revealedChoice2,
            uint256 createdAt
        )
    {
        require(_gameId > 0 && _gameId <= gameCounter, "Invalid game ID");

        Game storage game = games[_gameId];
        return (
            game.player1,
            game.player2,
            game.player1Made,
            game.player2Made,
            game.revealed,
            game.result,
            game.revealedChoice1,
            game.revealedChoice2,
            game.createdAt
        );
    }

    function getPlayerGames(
        address _player
    ) external view returns (uint256[] memory) {
        return playerGames[_player];
    }

    function getGameChoices(
        uint256 _gameId
    ) external view returns (euint8, euint8) {
        require(_gameId > 0 && _gameId <= gameCounter, "Invalid game ID");

        Game storage game = games[_gameId];
        require(
            msg.sender == game.player1 || msg.sender == game.player2,
            "Not a player in this game"
        );

        return (game.choice1, game.choice2);
    }
}
