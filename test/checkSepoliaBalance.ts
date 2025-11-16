import { ethers } from "hardhat";

async function main() {
  console.log("=== Checking Sepolia Account Balances ===\n");
  
  const signers = await ethers.getSigners();
  
  for (let i = 0; i < Math.min(signers.length, 5); i++) {
    const signer = signers[i];
    const address = await signer.getAddress();
    const balance = await ethers.provider.getBalance(address);
    const balanceInEth = ethers.formatEther(balance);
    
    console.log(`Account ${i}: ${address}`);
    console.log(`  Balance: ${balanceInEth} ETH (${balance.toString()} wei)`);
    console.log(`  Has funds: ${balance > 0n ? '✅ YES' : '❌ NO'}\n`);
  }
  
  // Check contract balance
  const contractAddress = "0x6B63cC1e6aC090FaFAD61332e40E9B4Fa3cBd44F";
  const contractBalance = await ethers.provider.getBalance(contractAddress);
  console.log(`Contract ${contractAddress}:`);
  console.log(`  Balance: ${ethers.formatEther(contractBalance)} ETH\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

