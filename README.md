<!-- Improved compatibility of back to top link: See: https://github.com/othneildrew/Best-README-Template/pull/73 -->

<a name="readme-top"></a>

<!-- PROJECT SHIELDS -->
<!--
*** I'm using markdown "reference style" links for readability.
*** Reference links are enclosed in brackets [ ] instead of parentheses ( ).
*** See the bottom of this document for the declaration of the reference variables
*** for contributors-url, forks-url, etc. This is an optional, concise syntax you may use.
*** https://www.markdownguide.org/basic-syntax/#reference-style-links
-->

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://damnvulnerabledefi.xyz">
    <img src="./cover.png" alt="Logo" width="600" height="80">
  </a>

<h3 align="center">Damn Vulnerable Defi V3 Solutions</h3>

  <p align="center">
This repo contains my solutions to Damn Vulnerable Defi V3 challenges (V3 released in January 2023). Damn Vulnerable Defi is a series of solidity hacking games created by @tinchoabbate.

Most challenges requires attacker contracts in the contracts folder and the execution javascript code in the test folder.
<br />
<a href="https://www.damnvulnerabledefi.xyz/">View Challenges</a>
·
<a href="https://github.com/bzpassersby/Damn-Vulnerable-Defi-V3---Solutions/issues">Report Bug</a>
·

  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#unstoppable">Unstoppable</a>
    </li>
    <li>
      <a href="#naive receiver">Naive receiver</a>
    </li>
    <li><a href="#truster">Truster</a></li>
    <li><a href="#side entrance">Side Entrance</a></li>
    <li><a href="#the rewarder">The Rewarder</a></li>
    <li><a href="#selfie">Selfie</a></li>
    <li><a href="#compromised">Compromised</a></li>
    <li><a href="#puppet">Puppet</a></li>
    <li><a href="#puppet v2">Puppet V2</a></li>
    <li><a href="#free rider">Free Rider</a></li>
    <li><a href="#backdoor">Backdoor</a></li>
    <li><a href="#climber">Climber</a></li>
    <li><a href="#wallet mining">Wallet Mining</a></li>
    <li><a href="#puppet v3">Puppet V3</a></li>
    <li><a href="#abi smuggling">ABI Smuggling</a></li>
  </ol>
</details>

## Unstoppable

The goal of the first challenge is to perform a DOS (Denial of Service) attack to the contract.

There is a vulnerability in the `flashLoan` function:

```solidity
uint256 balanceBefore = totalAssets();
if (convertToShares(totalSupply) != balanceBefore) revert InvalidBalance(); // enforce ERC4626 requirement
```

ERC4626 proposes a standard for tokenized vault with functionalities to track shares of user deposits in the vault, usually to determine the rewards to distribute for a given user who staked their tokens in the vault.

In this case, the asset is the underlying token that user deposit/withdraw into the vault. And the share is the amount of vault tokens that the vault mint/burn for users to represent their deposited assets. In this challenge, the underlying token is 'DVT', and the vault token is deployed as 'oDVT'.

Based on ERC4626, `convertToShares()` function takes input of an amount of assets('DVT'), and calculates the amount of share('oDVT') the vault should mint, based on the ratio of user's deposited assets. Now we are able to see two issues here.

(1) `(convertToShares(totalSupply) != balanceBefore)` enforces the condition where `totalSupply` of the vault tokens should always equal `totalAsset` of underlying tokens before any flash loan execution. If there are other implementations of the vault that divert asset tokens to other contracts, the `flashLoan` function would be inactive.

(2) `totalAssets` function is overridden to return always the balance of the vault contract `asset.balanceOf(address(this))`. And this is a separate system of accounting implemented through tracking supply of vault tokens.

The attack is to create a conflict between the two accounting systems by manually transferring 'DVT' to the vault.

[Test File](test/unstoppable/unstoppable.challenge.js)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Naive Receiver

This challenge require us to drain all the funds from a flash loan receiver contract in a single transaction.

The vulnerability is that the flash loan contract allow anyone to call `flashLoan` function on any receiver's behalf.

In order to achieve the attack in a single transaction, we need to deploy an attacker contract that call `flashLoan` multiple times.

[Test File](test/naive-receiver/naive-receiver.challenge.js)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Truster

Starting with 0 balance, we are tasked to take all tokens from the flash loan pool.

There are two vulnerabilities in the `flashLoan` function:

(1) it allows anyone to pass bytes data for it make a low-level call to any user provided address.

(2) it passes '0' amount flash loan to allow internal functions to run.

We can exploit by passing '0' amount flashLoan with data for the lending pool to approve attacker for taken all its tokens.

[Test File](test/truster/truster.challenge.js)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Side Entrance

The challenge start with a flash loan pool with 1000ETH and we need to drain the pool.

Similar to Unstoppable, the pool contract uses two different accounting systems.

To exploit, we simply need to take all tokens from the pool and call the `deposit` function to gave them all back to the pool. This allows us to pay back the pool but increase our balance. Then we call `withdraw` function to drain the pool.

[Test File](test/side-entrance/side-entrance.challenge.js)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## The Rewarder

Here we are tasked to claim rewards from a yield farming pool with zero token to start.

With a flash loan pool available, we can easily take flash loans and stake in the pool. But here is the catch. First, the pool needs to allow us to gain rewards from a single transaction of deposit and withdraw without tracking the duration of our deposit. Second, we need to bypass the pool's time restriction to claim rewards- the default delay in reward claiming is 5 days.

There are three main vulnerabilities in the reward pool contract.

(1) **The reward calculation doesn't take into account the duration of deposit.** Instead it only takes snapshot value of balance retrieved at a certain time. **Also, the calculation doesn't protect against manipulation of reward amount by dumping large amount of tokens into the pool when pool assets are low;**

```solidity
    rewards = amountDeposited.mulDiv(REWARDS, totalDeposits);
```

(2) **The time restriction on reward claiming is not properly set.**

```solidity
 if (amountDeposited > 0 && totalDeposits > 0) {
            rewards = amountDeposited.mulDiv(REWARDS, totalDeposits);
            if (rewards > 0 && !_hasRetrievedReward(msg.sender)) {
                rewardToken.mint(msg.sender, rewards);
                lastRewardTimestamps[msg.sender] = uint64(block.timestamp);
            }
        }
```

```solidity
    function _hasRetrievedReward(address account) private view returns (bool) {
        return (
            lastRewardTimestamps[account] >= lastRecordedSnapshotTimestamp
                && lastRewardTimestamps[account] <= lastRecordedSnapshotTimestamp + REWARDS_ROUND_MIN_DURATION
        );
    }
```

As seen above, the `_hasRetrievedReward` function would allow first time reward claimer to bypass the `REWARDS_ROUND_MIN_DURATION` (5 days) and execute the `mint` function as long as the calculated rewards is above 0.

(3) **The snapshot feature of `ERC20 Snapshot` is not properly implemented.**

The pool use a universal snapshot id stored in `lastSnapshotIdForRewards` to enforce the rewards are calculated at a time set at closing of an earlier round, such that new snapshots of user deposited balance in current round would not be eligible until the beginning of the next round.

But the order in which the snapshots are taken is incorrectly set.

```solidity
    function deposit(uint256 amount) external {
        if (amount == 0) {
            revert InvalidDepositAmount();
        }

        accountingToken.mint(msg.sender, amount);
        //The distributeRewards() should be set before the mint() function
        distributeRewards();

        SafeTransferLib.safeTransferFrom(
            liquidityToken,
            msg.sender,
            address(this),
            amount
        );
    }
```

From the above, the `distributeRewards` would increase the snapshot id whenever a new round is due. This means that the snapshot id incremented by `mint` function prior would be lower than snapshot id for this round. This allows any user who is the first to deposit at a new round to register their deposit balance in the current round.

In this case, it's safer to set `distributeRewards` before `mint`, since the intended behavior is to send rewards only for the past round.

The attack would be to set the time at the beginning at a new round, and execute the attack from a contract that take the flash loan and deposit and withdraw in a single transaction.

[Test File](test/the-rewarder/the-rewarder.challenge.js)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Selfie

Starting with a flash loan pool and a governance contract that manage the pool, we need to drain the funds from the pool.

**The biggest vulnerability is that the asset token and the governance token are the same token.** And this allow us to take the flash loan of asset token and use it for governance actions if other vulnerabilities line up.

Similar to the rewarder challenge, `ERC20 Snapshot` is used for the token and not properly implemented.

(1) It allows anyone to take a snapshot, which depending on how snapshot id is accessed to enforce restrictions later on may be an issue.

(2) No additional book keeping of snapshot id is enforced in governance contract. When approving an action, the governance contract would take the last snapshot to check balances and determine eligibility.

The combination of the above mentioned would allow us to simply take the flash loan, pass an action through governance contract to execute `emergencyExit` function on the pool contract to drain the funds. But we would still need to wait for 2 days set delay time before executing the action.

Note that the delayed execution is a good practice that in reality would allow remedial actions to intercept before a malicious action like this to be executed.

[Test File](test/selfie/selfie.challenge.js)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Compromised

The challenge is to manipulate NFT prices to drain all funds from an NFT exchange.

The NFT price on the exchange is accessed on an on-chain oracle where only trusted account can post NFT prices. If we can manipulate the prices by getting access to these trusted accounts, we are able to complete the challenge.

The key is the leaked message from the web service:

```
4d 48 68 6a 4e 6a 63 34 5a 57 59 78 59 57 45 30 4e 54 5a 6b 59 54 59 31 59 7a 5a 6d 59 7a 55 34 4e 6a 46 6b 4e 44 51 34 4f 54 4a 6a 5a 47 5a 68 59 7a 42 6a 4e 6d 4d 34 59 7a 49 31 4e 6a 42 69 5a 6a 42 6a 4f 57 5a 69 59 32 52 68 5a 54 4a 6d 4e 44 63 7a 4e 57 45 35

4d 48 67 79 4d 44 67 79 4e 44 4a 6a 4e 44 42 68 59 32 52 6d 59 54 6c 6c 5a 44 67 34 4f 57 55 32 4f 44 56 6a 4d 6a 4d 31 4e 44 64 68 59 32 4a 6c 5a 44 6c 69 5a 57 5a 6a 4e 6a 41 7a 4e 7a 46 6c 4f 54 67 33 4e 57 5a 69 59 32 51 33 4d 7a 59 7a 4e 44 42 69 59 6a 51 34
```

If we convert the above code in hex into utf-8 text, we get these.

```
MHhjNjc4ZWYxYWE0NTZkYTY1YzZmYzU4NjFkNDQ4OTJjZGZhYzBjNmM4YzI1NjBiZjBjOWZiY2RhZTJmNDczNWE5
MHgyMDgyNDJjNDBhY2RmYTllZDg4OWU2ODVjMjM1NDdhY2JlZDliZWZjNjAzNzFlOTg3NWZiY2Q3MzYzNDBiYjQ4
```

The text string could be encoded in Base64, which is a common binary to text encoding method for the web. If we decode it from base64 into utf-8 text, we get these.

```
0xc678ef1aa456da65c6fc5861d44892cdfac0c6c8c2560bf0c9fbcdae2f4735a9
0x208242c40acdfa9ed889e685c23547acbed9befc60371e9875fbcd736340bb48
```

We can verify that these are private keys to the trusted accounts of the oracle. The attack is to use the private keys to sign transactions to manipulate prices in the oracle, which allow us to buy low and sell high to drain the exchange.

[Test File](test/compromised/compromised.challenge.js)

<p align="right">(<a href="#readme-top">back to top</a>)</p>
