import { useState, useEffect } from "react";
import { ethers } from "ethers";
import type { Provider } from "ethers";

export function useBlockNumber(provider: Provider | null) {
  const [currentBlock, setCurrentBlock] = useState<number | null>(null);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let pollingProviderInstance: ethers.JsonRpcProvider | null = null;
    let isActive = true;

    if (provider) {
      const setupBlockPolling = async () => {
        try {
          const network = await provider.getNetwork();
          console.log("Setting up block polling for network:", network.chainId);

          let rpcUrl: string | null = null;

          if (network.chainId === 1n) {
            rpcUrl = "https://eth.llamarpc.com"; // Mainnet
          } else if (network.chainId === 11155111n) {
            // Sepolia endpoints with proper CORS support
            const sepoliaEndpoints = [
              "https://ethereum-sepolia-rpc.publicnode.com",
              "https://sepolia.gateway.tenderly.co",
            ];

            // Try each endpoint until one works
            for (const endpoint of sepoliaEndpoints) {
              try {
                const testProvider = new ethers.JsonRpcProvider(endpoint);
                await testProvider.getBlockNumber(); // Test if it works
                rpcUrl = endpoint;
                console.log(
                  "✅ Successfully connected to Sepolia endpoint:",
                  endpoint
                );
                break;
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
              } catch (error) {
                console.warn(
                  `⚠️  Failed to connect to ${endpoint}, trying next...`
                );
              }
            }

            if (!rpcUrl) {
              console.error(
                "❌ All Sepolia endpoints failed, using original provider"
              );
              pollingProviderInstance = provider as ethers.JsonRpcProvider;
            }
          } else if (network.chainId === 1337n || network.chainId === 31337n) {
            rpcUrl = "http://127.0.0.1:8545"; // Local
          }

          // Create the polling provider
          if (rpcUrl && !pollingProviderInstance) {
            pollingProviderInstance = new ethers.JsonRpcProvider(rpcUrl);
            console.log("📡 Created polling provider with URL:", rpcUrl);
          } else if (!pollingProviderInstance) {
            console.warn(
              `⚠️  Unknown network chainId: ${network.chainId}, using original provider`
            );
            pollingProviderInstance = provider as ethers.JsonRpcProvider;
          }

          const fetchBlock = async () => {
            if (!pollingProviderInstance || !isActive) return;

            try {
              const blockNum = await pollingProviderInstance.getBlockNumber();
              if (isActive) {
                setCurrentBlock(blockNum);
              }
            } catch (err) {
              console.error("Failed to fetch current block number:", err);
              // Fallback to original provider
              if (isActive && provider) {
                try {
                  const blockNum = await provider.getBlockNumber();
                  setCurrentBlock(blockNum);
                } catch (fallbackErr) {
                  console.error("Fallback also failed:", fallbackErr);
                }
              }
            }
          };

          await fetchBlock(); // Initial fetch
          intervalId = setInterval(fetchBlock, 13000); // Poll every 13 seconds (average block time)
        } catch (err) {
          console.error("Failed to setup block polling:", err);
          // Last resort: use original provider
          if (isActive) {
            try {
              const blockNum = await provider.getBlockNumber();
              setCurrentBlock(blockNum);
            } catch (fallbackErr) {
              console.error("All attempts failed:", fallbackErr);
            }
          }
        }
      };

      setupBlockPolling();
    }

    return () => {
      isActive = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
      pollingProviderInstance = null;
    };
  }, [provider]);

  return currentBlock;
}
