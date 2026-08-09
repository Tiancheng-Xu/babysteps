#!/usr/bin/env bash
set -euo pipefail

read -r -s -p "Hardhat keystore password: " deployment_keystore_password
printf "\n"
export HARDHAT_KEYSTORE_PASSWORD="$deployment_keystore_password"
unset deployment_keystore_password
trap 'unset HARDHAT_KEYSTORE_PASSWORD' EXIT

pnpm inspect:sepolia
pnpm prepare:vrf:sepolia
pnpm deploy:web3:sepolia
pnpm configure:vrf:sepolia

if pnpm exec hardhat keystore list | grep -q '^ETHERSCANAPIKEY$'; then
	pnpm deploy:web3:verify:sepolia
else
	printf "Etherscan verification skipped: ETHERSCANAPIKEY is not in the keystore.\n"
fi
