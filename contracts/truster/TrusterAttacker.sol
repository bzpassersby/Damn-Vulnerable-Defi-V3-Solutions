//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "solmate/src/tokens/ERC20.sol";
import "../DamnValuableToken.sol";

contract TrusterAttacker {
    address public player;
    DamnValuableToken public immutable token;

    constructor(address payable _player, DamnValuableToken _token) {
        player = _player;
        token = _token;
    }

    function getFunds() external payable {
        token.transfer(player, token.balanceOf(address(this)));
    }
}
