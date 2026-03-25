import deployed from "../../../monarch-contracts/deployed-addresses.json" with { type: "json" };

export const contracts = deployed.contracts;
export const chainId = Number(deployed.chainId);
export const deployerAddress = deployed.deployer as string;
