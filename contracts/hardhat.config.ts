import type { HardhatUserConfig } from "hardhat/config";
import { configVariable } from "hardhat/config";

import hardhatViem from "@nomicfoundation/hardhat-viem";
import hardhatNetworkHelpers from "@nomicfoundation/hardhat-network-helpers";
import hardhatIgnition from "@nomicfoundation/hardhat-ignition";
import hardhatKeystore from "@nomicfoundation/hardhat-keystore";

import dotenv from "dotenv";
dotenv.config({ path: "../.env" });

const config: HardhatUserConfig = {
  plugins: [
    hardhatViem,
    hardhatNetworkHelpers,
    hardhatIgnition,
    hardhatKeystore,
  ],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
        settings: {
          optimizer: { enabled: true, runs: 1 },
          viaIR: true,
        },
      },
    },
  },
  networks: {
    hardhat: { type: "edr-simulated", chainType: "l1" },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("RPC_URL"),
      accounts: [],
    },
  },
  paths: {
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
    ignition: "./ignition",
  },
};

export default config;
