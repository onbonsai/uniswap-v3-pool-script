const { createWalletClient, createPublicClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { chains } = require("@lens-chain/sdk/viem");

// --- Config ---

const RPC_URL = 'https://rpc.lens.dev';
const NFT_POSITION_MANAGER_CONTRACT_ADDRESS = '0xC5d0CAaE8aa00032F6DA993A69Ffa6ff80b5F031';
const PRIVATE_KEY = 'INSERT_PK';

const poolAddress = '0x5eb6b146d7a5322b763c8f8b0eb2fdd5d15e49de';
const slippageTolerance = 0.975;
// tick range is currently hardcoded in updatePoolParams function
const poolConfig = {
  token0: "0x6bDc36E20D267Ff0dd6097799f82e78907105e2F", // update with pool token0
  token1: "0x88F08E304EC4f90D644Cec3Fb69b8aD414acf884", // update with pool token1
  fee: 100, // update with pool fee
  tickLower: null, //calculated dynamically in updatePoolParams
  tickUpper: null, // calculated dynamically in updatePoolParams
  amount0Desired: "25000000000000000000000", // update with desired amount, NOTE: difference between token0/token1 ratio and current pool sqrtPriceX96 must be within slippage tolerance
  amount1Desired: "25000000000", // update with desired amount, NOTE: difference between token0/token1 ratio and current pool sqrtPriceX96 must be within slippage tolerance
  amount0Min: null, // calculated dynamically in updatePoolParams
  amount1Min: null, // calculated dynamically in updatePoolParams
  recipient: "0x27Af72b4E0Ec65687a00E26e309571B5439e349f", // update with your address
  deadline: 1743728735, // update with your deadline
};

// --- ABIs ---

const poolAbi = [
    {
      "inputs": [],
      "name": "slot0",
      "outputs": [
        { "internalType": "uint160", "name": "sqrtPriceX96", "type": "uint160" },
        { "internalType": "int24", "name": "tick", "type": "int24" },
        { "internalType": "uint16", "name": "observationIndex", "type": "uint16" },
        { "internalType": "uint16", "name": "observationCardinality", "type": "uint16" },
        { "internalType": "uint16", "name": "observationCardinalityNext", "type": "uint16" },
        { "internalType": "uint8", "name": "feeProtocol", "type": "uint8" },
        { "internalType": "bool", "name": "unlocked", "type": "bool" }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ];
  
  const nftManagerAbi = [
    {
      "inputs": [
        {
          "components": [
            { "internalType": "address", "name": "token0", "type": "address" },
            { "internalType": "address", "name": "token1", "type": "address" },
            { "internalType": "uint24", "name": "fee", "type": "uint24" },
            { "internalType": "int24", "name": "tickLower", "type": "int24" },
            { "internalType": "int24", "name": "tickUpper", "type": "int24" },
            { "internalType": "uint256", "name": "amount0Desired", "type": "uint256" },
            { "internalType": "uint256", "name": "amount1Desired", "type": "uint256" },
            { "internalType": "uint256", "name": "amount0Min", "type": "uint256" },
            { "internalType": "uint256", "name": "amount1Min", "type": "uint256" },
            { "internalType": "address", "name": "recipient", "type": "address" },
            { "internalType": "uint256", "name": "deadline", "type": "uint256" }
          ],
          "internalType": "struct INonfungiblePositionManager.MintParams",
          "name": "params",
          "type": "tuple"
        }
      ],
      "name": "mint",
      "outputs": [
        { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
        { "internalType": "uint128", "name": "liquidity", "type": "uint128" },
        { "internalType": "uint256", "name": "amount0", "type": "uint256" },
        { "internalType": "uint256", "name": "amount1", "type": "uint256" }
      ],
      "stateMutability": "payable",
      "type": "function"
    }
  ];
  
  const erc20Abi = [
    {
      "name": "balanceOf",
      "type": "function",
      "inputs": [{ "name": "account", "type": "address" }],
      "outputs": [{ "name": "", "type": "uint256" }],
      "stateMutability": "view"
    },
    {
      "name": "allowance",
      "type": "function",
      "inputs": [
        { "name": "_owner", "type": "address" },
        { "name": "_spender", "type": "address" }
      ],
      "outputs": [{ "name": "", "type": "uint256" }],
      "stateMutability": "view"
    }
  ];
  
  // --- Viem Clients ---
  
  const publicClient = createPublicClient({
    chain: chains.mainnet,
    transport: http(RPC_URL)
  });
  
  const walletClient = createWalletClient({
    account: privateKeyToAccount(PRIVATE_KEY),
    chain: chains.mainnet,
    transport: http(RPC_URL),
  });
  
  // --- Helper Functions ---
  
  async function getPoolState(poolAddress) {
    return await publicClient.readContract({
      address: poolAddress,
      abi: poolAbi,
      functionName: 'slot0',
    });
  }
  
  // Utility: Adjust tick range so that both boundaries are multiples of tickSpacing.
  function adjustTickRange(currentTick, tickSpacing, offset) {
    // Round the current tick to the nearest multiple of tickSpacing.
    const roundedTick = Math.round(currentTick / tickSpacing) * tickSpacing;
    const newTickLower = roundedTick - offset;
    const newTickUpper = roundedTick + offset;
    return { newTickLower, newTickUpper };
  }
  
  async function updatePoolParams(pool, poolAddress) {
  const state = await getPoolState(poolAddress);
  const currentTick = state[1];
  console.log(`Pool ${poolAddress} state:`, state);

  const tickSpacing = 10; // varies based on pool fee
  const offset = 100; // must be a multiple of tickSpacing.
  const { newTickLower, newTickUpper } = adjustTickRange(currentTick, tickSpacing, offset);
  
  // Recalculate minimum amounts using the slippage tolerance.
  const amount0Min = BigInt(pool.amount0Desired) * BigInt(Math.floor(slippageTolerance * 1000)) / 1000n;
  const amount1Min = BigInt(pool.amount1Desired) * BigInt(Math.floor(slippageTolerance * 1000)) / 1000n;

  pool.tickLower = newTickLower;
  pool.tickUpper = newTickUpper;
  pool.amount0Min = amount0Min.toString();
  pool.amount1Min = amount1Min.toString();
  
  console.log(`Updated parameters for pool ${poolAddress}:`, pool);
}
  
  async function mintPosition(mintParams) {
    try {
      const txHash = await walletClient.writeContract({
        address: NFT_POSITION_MANAGER_CONTRACT_ADDRESS,
        abi: nftManagerAbi,
        functionName: 'mint',
        args: [mintParams],
        value: 0n,
      });
      console.log('Mint tx sent. Transaction hash:', txHash);
    } catch (error) {
      console.error('Error during mint call:', error);
    }
  }
  
  async function getTokenBalance(tokenAddress, account) {
    try {
      const balance = await publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account],
      });
      console.log(`Balance of ${tokenAddress} for account ${account}:`, balance.toString());
      return balance.toString();
    } catch (error) {
      console.error('Error fetching token balance:', error);
    }
  }
  
  async function getAllowance(tokenAddress, owner, spender) {
    try {
      const allowance = await publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [owner, spender],
      });
      console.log(`Allowance of ${tokenAddress} from ${owner} to ${spender}:`, allowance.toString());
      return allowance.toString();
    } catch (error) {
      console.error('Error fetching allowance:', error);
    }
  }
  
  // --- Main Execution ---
  
  (async () => {
    console.log("");
    await updatePoolParams(poolConfig, poolAddress);
    await mintPosition(poolConfig);
    console.log("");
  })();
  