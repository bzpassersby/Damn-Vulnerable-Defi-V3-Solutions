//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./MockWallet.sol";

import "./WalletDeployer.sol";

contract MockFactory is IGnosisSafeProxyFactory {
    function createProxy(address _copy, bytes memory _wat)
        external
        returns (address)
    {
        return address(this);
    }

    function createWallet(address _token, address _player) public {
        for (uint i = 0; i < 45; i++) {
            new MockWallet(_token, _player);
        }
    }
}
