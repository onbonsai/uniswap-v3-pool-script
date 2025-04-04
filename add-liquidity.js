const { createWalletClient, createPublicClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { chains } = require("@lens-chain/sdk/viem");

// --- Config ---

const RPC_URL = 'https://rpc.lens.dev';
const NFT_POSITION_MANAGER_CONTRACT_ADDRESS = '0xC5d0CAaE8aa00032F6DA993A69Ffa6ff80b5F031';
const PRIVATE_KEY = ''; // TODO: Add your private key
const DRY_RUN = true; // Set to false to execute the actual transaction

const poolAddress = '0x3708D16Fe930a0CB083B8bC73e6Aa3198084bEDF'; // UniswapV3Pool address, deploy from NonfungiblePositionManager.createAndInitializePoolIfNecessary
const slippageTolerance = 0.975;
// tick range is currently hardcoded in updatePoolParams function
const poolConfig = {
  token0: "0x6bDc36E20D267Ff0dd6097799f82e78907105e2F", // WGHO
  token1: "0xB0588f9A9cADe7CD5f194a5fe77AcD6A58250f82", // BONSAI
  fee: 10000, // update with pool fee
  tickLower: null, //calculated dynamically in updatePoolParams
  tickUpper: null, // calculated dynamically in updatePoolParams
  // 3,800 WGHO = 3800 * 10^18 = 3800000000000000000000
  amount0Desired: "3800000000000000000000", // update with desired amount, NOTE: difference between token0/token1 ratio and current pool sqrtPriceX96 must be within slippage tolerance
  // 1.1m BONSAI = 1.1m * 10^18 = 1100000000000000000000000
  amount1Desired: "1100000000000000000000000", // update with desired amount, NOTE: difference between token0/token1 ratio and current pool sqrtPriceX96 must be within slippage tolerance
  amount0Min: null, // calculated dynamically in updatePoolParams
  amount1Min: null, // calculated dynamically in updatePoolParams
  recipient: "0x21aF1185734D213D45C6236146fb81E2b0E8b821", // update with your address
  deadline: 1743898414, // update with your deadline
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
    // const roundedTick = Math.round(currentTick / tickSpacing) * tickSpacing;
    // const newTickLower = roundedTick - offset;
    // const newTickUpper = roundedTick + offset;
    return { newTickLower: -887220, newTickUpper: 887220 };
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
      // Check allowance for token0
      const token0Allowance = await getAllowance(
        mintParams.token0,
        walletClient.account.address,
        NFT_POSITION_MANAGER_CONTRACT_ADDRESS
      );
      
      // Check allowance for token1
      const token1Allowance = await getAllowance(
        mintParams.token1,
        walletClient.account.address,
        NFT_POSITION_MANAGER_CONTRACT_ADDRESS
      );
      
      // Check if we need to approve token0
      if (BigInt(token0Allowance) < BigInt(mintParams.amount0Desired)) {
        console.log(`Insufficient allowance for token0. Approving...`);
        if (!DRY_RUN) {
          await approveToken(
            mintParams.token0,
            NFT_POSITION_MANAGER_CONTRACT_ADDRESS,
            mintParams.amount0Desired
          );
        } else {
          console.log(`[DRY RUN] Would approve token0: ${mintParams.token0}`);
        }
      }
      
      // Check if we need to approve token1
      if (BigInt(token1Allowance) < BigInt(mintParams.amount1Desired)) {
        console.log(`Insufficient allowance for token1. Approving...`);
        if (!DRY_RUN) {
          await approveToken(
            mintParams.token1,
            NFT_POSITION_MANAGER_CONTRACT_ADDRESS,
            mintParams.amount1Desired
          );
        } else {
          console.log(`[DRY RUN] Would approve token1: ${mintParams.token1}`);
        }
      }
      
      // Now mint the position
      if (DRY_RUN) {
        console.log('[DRY RUN] Would mint position with params:', JSON.stringify(mintParams, null, 2));
        
        // Simulate the transaction
        try {
          const simulation = await publicClient.simulateContract({
            address: NFT_POSITION_MANAGER_CONTRACT_ADDRESS,
            abi: nftManagerAbi,
            functionName: 'mint',
            args: [mintParams],
            account: walletClient.account,
          });
          console.log('[DRY RUN] Simulation successful:', simulation);
        } catch (simError) {
          console.error('[DRY RUN] Simulation failed:', simError);
        }
      } else {
        const txHash = await walletClient.writeContract({
          address: NFT_POSITION_MANAGER_CONTRACT_ADDRESS,
          abi: nftManagerAbi,
          functionName: 'mint',
          args: [mintParams],
          value: 0n,
        });
        console.log('Mint tx sent. Transaction hash:', txHash);
      }
    } catch (error) {
      console.error('Error during mint call:', error);
    }
  }
  
  // Helper function to approve token spending
  async function approveToken(tokenAddress, spender, amount) {
    try {
      const approveTxHash = await walletClient.writeContract({
        address: tokenAddress,
        abi: [
          {
            name: "approve",
            type: "function",
            inputs: [
              { name: "_spender", type: "address" },
              { name: "_value", type: "uint256" }
            ],
            outputs: [{ name: "", type: "bool" }],
            stateMutability: "nonpayable"
          }
        ],
        functionName: 'approve',
        args: [spender, BigInt(amount)],
      });
      console.log(`Approval tx sent for ${tokenAddress}. Transaction hash:`, approveTxHash);
      return approveTxHash;
    } catch (error) {
      console.error(`Error approving ${tokenAddress}:`, error);
      throw error;
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
  
  // Function to send tokens to another address
  async function sendTokens(tokenAddress, recipient, amount) {
    try {
      console.log(`Sending ${amount} tokens from ${tokenAddress} to ${recipient}...`);
      
      if (DRY_RUN) {
        console.log(`[DRY RUN] Would send ${amount} tokens from ${tokenAddress} to ${recipient}`);
        
        // Simulate the transaction
        try {
          const simulation = await publicClient.simulateContract({
            address: tokenAddress,
            abi: [
              {
                name: "transfer",
                type: "function",
                inputs: [
                  { name: "_to", type: "address" },
                  { name: "_value", type: "uint256" }
                ],
                outputs: [{ name: "", type: "bool" }],
                stateMutability: "nonpayable"
              }
            ],
            functionName: 'transfer',
            args: [recipient, BigInt(amount)],
            account: walletClient.account,
          });
          console.log('[DRY RUN] Transfer simulation successful:', simulation);
        } catch (simError) {
          console.error('[DRY RUN] Transfer simulation failed:', simError);
        }
      } else {
        const txHash = await walletClient.writeContract({
          address: tokenAddress,
          abi: [
            {
              name: "transfer",
              type: "function",
              inputs: [
                { name: "_to", type: "address" },
                { name: "_value", type: "uint256" }
              ],
              outputs: [{ name: "", type: "bool" }],
              stateMutability: "nonpayable"
            }
          ],
          functionName: 'transfer',
          args: [recipient, BigInt(amount)],
        });
        console.log('Transfer tx sent. Transaction hash:', txHash);
        return txHash;
      }
    } catch (error) {
      console.error('Error sending tokens:', error);
      throw error;
    }
  }
  
  // --- Main Execution ---
  
  (async () => {
    console.log("");
    console.log(`Running in ${DRY_RUN ? 'DRY RUN' : 'EXECUTION'} mode`);
    
    // Uncomment the line below to send tokens to another address
    // await sendTokens(poolConfig.token1, "0xDC4471ee9DFcA619Ac5465FdE7CF2634253a9dc6", "1000000000000000000"); // 1 token with 18 decimals
    
    await updatePoolParams(poolConfig, poolAddress);
    await mintPosition(poolConfig);
    console.log("");
  })();
  