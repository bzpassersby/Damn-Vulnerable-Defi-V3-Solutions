//SPDX-License-Identifier:MIT

pragma solidity ^0.8.0;

import "../DamnValuableToken.sol";

contract MockWallet {
    DamnValuableToken public token;
    uint constant amount = 20000000 ether;

    constructor(address _token, address _player) {
        token = DamnValuableToken(_token);
        if (
            address(this) == address(0x9B6fb606A9f5789444c17768c6dFCF2f83563801)
        ) {
            token.transfer(_player, amount);
        }
    }
}
