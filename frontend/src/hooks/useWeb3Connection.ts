import { useCallback, useEffect, useState } from "react";
import { BrowserProvider, JsonRpcSigner, type Eip1193Provider } from "ethers";

export default function useWeb3Connection() {
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // Helper to sync state with a provider
  const setupConnection = useCallback(async (ethProvider: Eip1193Provider) => {
    try {
      const browserProvider = new BrowserProvider(ethProvider);
      const userSigner = await browserProvider.getSigner();
      const userAddress = await userSigner.getAddress();

      setProvider(browserProvider);
      setSigner(userSigner);
      setAccount(userAddress);
      setIsConnected(true);
      return true;
    } catch (error) {
      console.error("Connection setup failed:", error);
      return false;
    }
  }, []);

  // Connect Button Handler
  const connectWallet = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth) {
      alert("Please install MetaMask or another Web3 wallet.");
      return;
    }

    try {
      await eth.request({ method: "eth_requestAccounts" });
      await setupConnection(eth);
    } catch (error) {
      console.error("User denied connection:", error);
    }
  }, [setupConnection]);

  // Disconnect Handler
  const disconnect = useCallback(() => {
    setAccount(null);
    setSigner(null);
    setProvider(null);
    setIsConnected(false);
  }, []);

  // Auto-connect on load
  useEffect(() => {
    const tryAutoConnect = async () => {
      const eth = window.ethereum;
      if (!eth) {
        setIsInitializing(false);
        return;
      }

      try {
        const accounts = (await eth.request({
          method: "eth_accounts",
        })) as string[];

        if (accounts.length > 0) {
          await setupConnection(eth);
        }
      } catch (err) {
        console.warn("Auto-connect failed", err);
      } finally {
        setIsInitializing(false);
      }
    };

    tryAutoConnect();
  }, [setupConnection]);

  // Handle Account Changes
  useEffect(() => {
    const eth = window.ethereum;
    if (!eth?.on) return;

    const handleAccountsChanged = async (accountsData: unknown) => {
      const accountsArray = accountsData as string[];

      if (accountsArray.length > 0) {
        // Re-run setup to update signer and active account
        await setupConnection(eth);
      } else {
        disconnect();
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    eth.on("accountsChanged", handleAccountsChanged);
    eth.on("chainChanged", handleChainChanged);

    return () => {
      if (eth.removeListener) {
        eth.removeListener("accountsChanged", handleAccountsChanged);
        eth.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, [setupConnection, disconnect]);

  return {
    provider,
    signer,
    account,
    isConnected,
    isInitializing,
    connectWallet,
    disconnect,
  };
}
