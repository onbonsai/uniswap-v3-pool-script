# Uniswap V3 Pool Script

## Step 1

Call `NonfungiblePositionManager.createAndInitializePoolIfNecessary(...)` through block exlorer or separate script to create UniswapV3Pool

Lens Chain NonFungiblePositionManager address: [0xC5d0CAaE8aa00032F6DA993A69Ffa6ff80b5F031](https://explorer.lens.xyz/address/0xC5d0CAaE8aa00032F6DA993A69Ffa6ff80b5F031)

- `fee` is in basis points (i.e. 100 = 0.01%)
- `token0` and `token1` will always be ordered alphabetically in the created pool
- `sqrtPriceX96` is encoding of initial price, see [here](https://blog.uniswap.org/uniswap-v3-math-primer) (AI chatbots are also helpful for generating this if you pass in the decimals of each token and target price, but keep in mind that order of tokens passed will affect the sqrtPriceX96)


## Step 2

Update config variables at top of `add-liquidity.js`

Tick spacing is currently hardcoded in `updatePoolParams`, tick spacing must be updated based on the fee of the pool and desired liquidity range

## Step 3

Run script

`pnpm install`
`node add-liquidity.js`

Adjust desired amounts and slippage tolerance as needed.

## Helper Functions

`getTokenBalance(tokenAddress, owner)`
`getAllowance(tokenAddress, owner, spender)`