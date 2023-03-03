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

  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#1-unstoppable">Unstoppable</a>
    </li>
    <li>
      <a href="#2-naive-receiver">Naive receiver</a>
    </li>
    <li><a href="#3-truster">Truster</a></li>
    <li><a href="#4-side-entrance">Side Entrance</a></li>
    <li><a href="#5-the-rewarder">The Rewarder</a></li>
    <li><a href="#6-selfie">Selfie</a></li>
    <li><a href="#7-compromised">Compromised</a></li>
    <li><a href="#8-puppet">Puppet</a></li>
    <li><a href="#9-puppet-v2">Puppet V2</a></li>
    <li><a href="#10-free-rider">Free Rider</a></li>
    <li><a href="#11-backdoor">Backdoor</a></li>
    <li><a href="#12-climber">Climber</a></li>
    <li><a href="#13-wallet-mining">Wallet Mining</a></li>
    <li><a href="#14-puppet-v3">Puppet V3</a></li>
    <li><a href="#15-abi-smuggling">ABI Smuggling</a></li>
  </ol>

## 1-Unstoppable

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

## 2-Naive Receiver

This challenge require us to drain all the funds from a flash loan receiver contract in a single transaction.

The vulnerability is that the flash loan contract allow anyone to call `flashLoan` function on any receiver's behalf.

In order to achieve the attack in a single transaction, we need to deploy an attacker contract that call `flashLoan` multiple times.

[Test File](test/naive-receiver/naive-receiver.challenge.js)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## 3-Truster

Starting with 0 balance, we are tasked to take all tokens from the flash loan pool.

There are two vulnerabilities in the `flashLoan` function:

(1) it allows anyone to pass bytes data for it make a low-level call to any user provided address.

(2) it passes '0' amount flash loan to allow internal functions to run.

We can exploit by passing '0' amount flashLoan with data for the lending pool to approve attacker for taken all its tokens.

[Test File](test/truster/truster.challenge.js)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## 4-Side Entrance

The challenge start with a flash loan pool with 1000ETH and we need to drain the pool.

Similar to Unstoppable, the pool contract uses two different accounting systems.

To exploit, we simply need to take all tokens from the pool and call the `deposit` function to gave them all back to the pool. This allows us to pay back the pool but increase our balance. Then we call `withdraw` function to drain the pool.

[Test File](test/side-entrance/side-entrance.challenge.js)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## 5-The Rewarder

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

## 6-Selfie

Starting with a flash loan pool and a governance contract that manage the pool, we need to drain the funds from the pool.

**The biggest vulnerability is that the asset token and the governance token are the same token.** And this allow us to take the flash loan of asset token and use it for governance actions if other vulnerabilities line up.

Similar to the rewarder challenge, `ERC20 Snapshot` is used for the token and not properly implemented.

(1) It allows anyone to take a snapshot, which depending on how snapshot id is accessed to enforce restrictions later is a red flag.

(2) No additional book keeping of snapshot id is enforced in governance contract. When approving an action, the governance contract would take the last snapshot to check balances and determine eligibility.

The combination of the above mentioned would allow us to simply take the flash loan, pass an action through governance contract to execute `emergencyExit` function on the pool contract to drain the funds. But we would still need to wait for 2 days set delay time before executing the action.

Note that the delayed execution is a good practice that in reality would allow remedial actions to intercept before a malicious action like this to be executed.

[Test File](test/selfie/selfie.challenge.js)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## 7-Compromised

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

## 8-Puppet

The challenge is to drain all the tokens from the lender pool in a single transaction.

The main vulnerability is Uniswap pool V1 is prone to price manipulation when liquidity is low.

Uniswap pool V1 uses spot price to determine token prices in the pool by assess the ratio of the paired tokens at a given time.

We can achieve the attack by dumping large amount of token in uniswap liquidity pool to deflate the token value in the lender pool, this allow us to borrow all tokens from the pool with a low collateral.

Finally, we need to deploy our attacker contract to swap token and borrow tokens in a single transaction. Note that our attacker contract has to be deployed with additional ether. This is to avoid us supplying ether to attacker contract in a separate transaction.

[Test File](test/puppet/puppet.challenge.js)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## 9-Puppet-v2

The challenge is similar to Puppet. Instead we need to manipulate the oracle price pulled from Uniswap v2 liquidity pool.

Uniswap v2 added improvements to prevent price oracle attacks. One is it measures prices at the beginning of every block, increasing the possibility for the attacker to lose money to arbitrageurs. Second, it introduces TWAP (time-weighted average price), which allows oracles to survey average price as a specific time intervals.

The main vulnerability in the puppet lending pool is that the TWAP is not implemented, instead it directly query the spot price of the liquidity pool.

[Test File](test/puppet-v2/puppet-v2.challenge.js)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## 10-Free Rider

We are tasked to get the NFTs from a marketplace and send it to a designated recovery contract.

The major error in the marketplace contract is the buy nft function `_buyOne` would send the sales to the new buyer instead of the original owner/seller.

Another error is that when buying multiple NFTs at once through `_buyMany`, you only need to send Eth for a single NFT price.

The attack would be get a flash loan from Uniswap to buy NFTs, and return it in a single transaction.

[Test File](test/free-rider/free-rider.challenge.js)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## 11-Backdoor

Here we are tasked to deploy Gnosis wallet contract on behalf of 5 existing registered users in the WalletRegistry and take all the rewards that the registry sends to the user owned wallets.

Specifically, the WalletRegistry contract has a call back function `proxyCreated` which is supposed to be called whenever a new wallet is create through Gnosis wallet factory using `createProxyWithCallback` function. And several checks are performed in the `proxyCreated` function to make sure the new wallet create are initialized in an intended safe manner, if so, WalletRegistry send token rewards to the wallet address.

Several safe guards are checked in the `proxyCreated` function, including making sure `fallbackManager` address which allows wallet to send random transaction to the address is set to address(0).

After reviewing the `initializer` data which was passed during wallet creation to initialize the wallet through invoking `setup` function on GnosisSafe.sol, we can see that of all the arguments passed to `setup`, only `address to`,`bytes calldata data`, `paymentToken`,`payment`,`paymentReceiver` can be customized while still passing the checks from the registry.

```solidiy
function setup(
        address[] calldata _owners,
        uint256 _threshold,
        address to, //this arg is not checked by proxyCreated function
        bytes calldata data, //this arg is not checked by proxyCreated function
        address fallbackHandler,
        address paymentToken, //this arg is not checked by proxyCreated function
        uint256 payment, //this arg is not checked by proxyCreated function
        address payable paymentReceiver //this arg is not checked by proxyCreated function
    ) external {
        setupOwners(_owners, _threshold);
        if (fallbackHandler != address(0)) internalSetFallbackHandler(fallbackHandler);

        setupModules(to, data);

        if (payment > 0) {
            // To avoid running into issues with EIP-170 we reuse the handlePayment function (to avoid adjusting code of that has been verified we do not adjust the method itself)
            // baseGas = 0, gasPrice = 1 and gas = payment => amount = (payment + 0) * 1 = payment
            handlePayment(payment, 0, 1, paymentToken, paymentReceiver);
        }
        emit SafeSetup(msg.sender, _owners, _threshold, to, fallbackHandler);
    }

```

Note that even though we are free to set the `paymentReceiver` and `payment` argument to directly send token to us at initialization, the wallet has not received token rewards at this point to send.

Of the customizable arguments, only `address to` and `bytes calldata data` seem helpful since they allow us to invoke `setupModules(to,data)`. From within `setupModules` function we are free to call a `delegatecall` function on behalf of the wallet, which will allow us to change states of this wallet.

```solidity
function setupModules(address to, bytes memory data) internal {
        require(modules[SENTINEL_MODULES] == address(0), "GS100");
        modules[SENTINEL_MODULES] = SENTINEL_MODULES;
        if (to != address(0))
            // Setup has to complete successfully or transaction fails.
            require(execute(to, 0, data, Enum.Operation.DelegateCall, gasleft()), "GS000");
    }
```

**Now we see a major vulnerability of the wallet contract to allow us modify its state through `delegatecall` within `setupModules`.This allows a malicious logic contract to modify the wallet proxy.**

In order to exploit this, our malicious logic contract(FakeMaster.sol) modifies the state of `mapping(address => address) internal modules` to whitelist an attacker contract(BackDoor.sol) as trusted module. We carry out the attack with `execTransactionFromModule` function to make any call we want to steal the tokens after wallet initialization. Note that we can also whitelist an EOA as a module instead of a contract.

[Test File](test/backdoor/backdoor.challenge.js)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## 12-Climber

The challenge is to drain the funds in the vault administered by a Timelock contract. And the vault itself is UUPS upgradable.

There are two main vulnerabilities in the Timelock contract.

(1) The `execute` function allows anyone to call, which when properly safe guarded is fine. But it allows a random low level `call` to be executed prior to verify if the operation has been approved.

(2) The Timelock contract itself is self-administered as well, which is not a red flag but when combined with the first vulnerability allows an attacker to execute administrative actions through 'call' before the operation is verified.

In order to exploit, we need to `execute` a series of administrative actions by calling back to timelock itself. First, to set the delayed execution to zero. Second, grant ourself the 'PROPOSER' role. Third, schedule the first and second step through `schedule` function.

However, one caveat is that when passing bytes data to `schedule` the operation, we need to avoid a self-referencing loop, because the data would include the `schedule` function itself. To avoid this, we can do the first and second step through EOA and invoke an attacker contract to `schedule` the operations.

After our attacker contract(ClimberAttack.sol) reset the delay and got the proposal role, we can transfer ownership and upgrade the vault logic contract to a malicious logic contract (FakeVault.sol) to sweep the funds.

[Test File](test/climber/climber.challenge.js)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## 13-Wallet Mining

There are several small challenges combined. We are tasked to drain all funds from a wallet deployer contract which only issues rewards to specific users with pre-calculated wallet address registered in an authorizer contract. The authorizer contract is upgradable. On the other hand, we need to deploy contracts to three empty addresses, two of the addresses are referenced in the wallet deployer contract. The third address has funds that we need to recover.

There are two aspects in solving the challenge. First is to figure out how to deploy contracts to predetermined address, finishing this would easily allow us to recover the funds in the empty address. Second is to drain the funds from wallet deployer contract.

### 1- Empty addresses

From the context, we know `0x76E2cFc1F5Fa8F6a5b3fC4c8F4788F0116861F9B` is the Gnosis safe factory which supposed to deploy the empty wallet address `0x9b6fb606a9f5789444c17768c6dfcf2f83563801`. From `GnosisSafeProxyFactory.sol`, we know there are two ways to create proxy wallet and only `createProxy` function allow us to create a proxy wallet with only the address of the factory itself and a nonce, without a random `salt` input.

We can first brute force it with an incrementing nonce and `0x76E2cFc1F5Fa8F6a5b3fC4c8F4788F0116861F9B` as deployer address to find the empty wallet address `0x9b6fb606a9f5789444c17768c6dfcf2f83563801`. This should give us required deployment nonce.

To find the deployment method for the factory address and master copy address, an etherscan search reveals the exact same addresses and their deployment EOA account `0x1aa7451DD11b8cb16AC089ED7fE05eFa00100A6A`. Without the private key to this EOA account, it seems we cannot replicate its deployments. I did a research and found out the exact attack against this EOA account toke place last year.
Credit to #Coucou who wrote the attack analysis [here](https://mirror.xyz/0xbuidlerdao.eth/lOE5VN-BHI0olGOXe27F0auviIuoSlnou_9t3XRJseY). See etherscan for signed transaction data of factory deployment [here](https://etherscan.io/getRawTx?tx=0x06d2fa464546e99d2147e1fc997ddb624cec9c8c5e25a050cc381ee8a384eed3). We can use the exact signed raw transaction data used for initial deployment. The attacker was able to replay the development of initial contract on optimism L2 chain. This should be the same strategy for our challenge.

See test file for details.

### 2- Drain wallet deployer contract

There are two vulnerabilities on the wallet deployer contract.The `drop` function would only return but not revert the transaction if invalid wallets are passed through the nested `can` function. This would allow any state changes made by `aim = fact.createProxy(copy, wat)` to persist. However, this would still not allow us to drain the funds.

```solidity
    function drop(bytes memory wat) external returns (address aim) {
        aim = fact.createProxy(copy, wat);
        if (mom != address(0) && !can(msg.sender, aim)) {
            revert Boom();
        }
        IERC20(gem).transfer(msg.sender, pay);
    }

```

Another potential point of exploit in the wallet deployer contract is `can` function only checks whether the return data from the `staticcall` is zero. If we can modify the logic of the authorizer to make it return any other value. The `can` function would return true, allowing `drop`function to send tokens.

```solidity
    function can(address u, address a) public view returns (bool) {
        assembly {
            let m := sload(0)
            if iszero(extcodesize(m)) {
                return(0, 0)
            }
            let p := mload(0x40)
            mstore(0x40, add(p, 0x44))
            mstore(p, shl(0xe0, 0x4538c4eb))
            mstore(add(p, 0x04), u)
            mstore(add(p, 0x24), a)
            if iszero(staticcall(gas(), m, p, 0x44, p, 0x20)) {
                return(0, 0)
            }
            if and(not(iszero(returndatasize())), iszero(mload(p))) {
                return(0, 0)
            }
        }
        return true;
    }
```

**There two major vulnerabilities in the upgradable authorizer contract. And these would help us solve the challenge.**

(1) The initializer function was only initialized in the proxy context but not on the logic contract context. This would allow anyone to modify the state of the logic contract, given other vulnerabilities line up.

```solidity
    function init(address[] memory _wards, address[] memory _aims)
        external
        initializer
    {
        __Ownable_init();
        __UUPSUpgradeable_init();

        for (uint256 i = 0; i < _wards.length; ) {
            _rely(_wards[i], _aims[i]);
            unchecked {
                i++;
            }
        }
    }
```

(2) The logic contract inherit `upgradeToAndCall` function, which is restricted to owner, but if owner was compromised, it makes a `delegatecall` under the hood to the new logic contract. This is a red flag that would allow anyone who gains control of the logic contract to change its state.

In order to exploit, we need to first initialize the logic contract to claim ownership. Second, we need to upgrade it to a malicious logic contract and call `selfdestruct`. Now we can empty the authorizer logic contract attached to its proxy.

If we execute our attack as above, we should be able to pass the `drop` function to receive tokens.

```solidity
    function upgradeToAndCall(address imp, bytes memory wat)
        external
        payable
        override
    {
        _authorizeUpgrade(imp);
        _upgradeToAndCallUUPS(imp, wat, true);
    }
```

[Test File](test/wallet-mining/wallet-mining.challenge.js)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## 14-Puppet V3

This challenge asks us to drain all the DVT tokens from the lending pool, which take price oracles from Uniswap v3 liquidity pool.

Uniswap v3 introduced TWAP (time weight average price) based on geometric mean of spot prices, as opposed to arithmetic mean used for Uniswap v2. The change in price calculation greatly increases capital efficiency, as well as improved resistance against oracle manipulation.

We can see that the lending pool set a time interval of 10 min for price oracle, which should be long enough to prevent price manipulation in reality for a decent sized pool. But in our case, we start with more DVT tokens compared to uniswap pool, which gives us an advantage. To carry out the attack, we need to swap maximum amount of tokens with uniswap pool with sufficient time increments to tip the price to our favor. We also need to make sure the total time increments are less than 156 seconds as specified by the test.

To maximize price impact, I swap the maximum allowable amount of DVT token (110 ether) in the swap and then increase the time by 100s. The desirable price is reached after one block has passed and with 100s time increments. After receiving enough Eth as collateral, we would simply drain the lending pool.

Note to run the test file, insert your own json rpc url to fork mainnet in the test preparation section.
`  const MAINNET_FORKING_URL = process.env.MAINNET_FORKING_URL;`

[Test File](test/wallet-mining/wallet-mining.challenge.js)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## 15-ABI Smuggling

The challenge asks us to drain all tokens in the vault contract. The vault token also inherits an authorization contract which only allows registered account to execute specific functions.

An important feature of the vault contract is that its `withdraw` and `sweepFunds` function are self-authorized, and can only be called by `execute` function which enforces that only callers and actions with permission can invoke the function.

The vulnerability lies in the way the function selector is verified in `execute`. The function selector is pulled from `msg.data` at a fixed calldata byte offset `uint256 calldataOffset = 4 + 32 * 3`, which means that as long as we have the correct function selector in the calldata at this offset, we have a chance to pass.

Even though accessing calldata at a fixed offset is commonly done, in our case, the arguments contains `bytes call actionData` which is a dynamic data type that stores the location of the data first. The actual data which contains the length of data and data content starts at the specified store location. This `msg.data` structure allows us to put authorized function selector `withdraw` at offset ('4+32x3') first and sneak in `sweepFunds` function selector and its arguments after.

```solidity
    function execute(address target, bytes calldata actionData) external nonReentrant returns (bytes memory) {
        // Read the 4-bytes selector at the beginning of `actionData`
        bytes4 selector;
        uint256 calldataOffset = 4 + 32 * 3; // calldata position where `actionData` begins
        assembly {
            selector := calldataload(calldataOffset)
        }

        if (!permissions[getActionId(selector, msg.sender, target)]) {
            revert NotAllowed();
        }

        _beforeFunctionCall(target, actionData);

        return target.functionCall(actionData);
    }
```

[Test File](test/abi-smuggling/abi-smuggling.challenge.js)

<p align="right">(<a href="#readme-top">back to top</a>)</p>
