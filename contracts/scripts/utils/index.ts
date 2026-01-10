import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  http,
  getContract,
  type PublicClient,
  type WalletClient,
  type Account,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import * as fs from "fs";
import * as path from "path";

// --- 1. Environment & Keys ---

export function getPrivateKey(envVar: string): `0x${string}` {
  const key = process.env[envVar];
  if (!key || !key.startsWith("0x") || key.length !== 66) {
    throw new Error(`Invalid/missing private key in env: ${envVar}`);
  }
  return key as `0x${string}`;
}

export function getEnvAddress(envVar: string): `0x${string}` {
  const addr = process.env[envVar];
  if (!addr || !addr.startsWith("0x")) {
    throw new Error(`Invalid/missing address in env: ${envVar}`);
  }
  return addr as `0x${string}`;
}

// --- 2. Clients ---

export function createClients(privateKey?: `0x${string}`) {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  if (!rpcUrl) throw new Error("SEPOLIA_RPC_URL not set.");

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });

  let walletClient: WalletClient | undefined;
  let account: Account | undefined;

  if (privateKey) {
    account = privateKeyToAccount(privateKey);
    walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http(rpcUrl),
    });
  }

  return { publicClient, walletClient, account };
}

// --- 3. Contract Helpers ---

/**
 * Helper to load artifacts without hardcoding paths in every script.
 * Assumes standard Hardhat directory structure.
 */
export async function getContractInstance(
  address: Address,
  contractName: string,
  client: PublicClient | WalletClient
) {
  // Try to find the artifact in the artifacts folder
  // Note: specific path might vary depending on folder structure depth
  const artifactPath = path.resolve(
    process.cwd(),
    `artifacts/contracts/${contractName}.sol/${contractName}.json`
  );

  // Fallback for separated artifact folders (like Registry/Governor specific folders)
  // You might need a more robust finder if your contracts are deeply nested
  let artifact;
  try {
    const content = fs.readFileSync(artifactPath, "utf-8");
    artifact = JSON.parse(content);
  } catch (_e) {
    // Attempt recursive search or known locations if specific path fails
    // For now, let's assume the standard path or throw
    // You can also import specific JSONs in the scripts if this is too generic
    throw new Error(
      `Could not find artifact for ${contractName} at ${artifactPath}`
    );
  }

  return getContract({
    address,
    abi: artifact.abi,
    client: client as any,
  }) as any;
}

// --- 4. Argument Parsing ---

export function parseArgs<T extends Record<string, any>>(spec: {
  [K in keyof T]: (value: string) => T[K];
}): T {
  const args: Record<string, any> = {};
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const parser = spec[arg];
    if (parser) {
      const value = argv[++i];
      if (value === undefined) throw new Error(`Missing value for ${arg}`);
      args[arg] = parser(value);
    }
  }

  return args as T;
}
