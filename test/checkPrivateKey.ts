import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("=== Checking PRIVATE_KEY ===\n");
  
  const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
  const YOUR_WALLET = "0xe19B0343891D90519cB6664a03747b89a49Bb714";
  
  console.log(`PRIVATE_KEY length: ${PRIVATE_KEY.length}`);
  console.log(`PRIVATE_KEY starts with 0x: ${PRIVATE_KEY.startsWith('0x')}`);
  console.log(`PRIVATE_KEY first 10 chars: ${PRIVATE_KEY.substring(0, 10)}...`);
  console.log(`PRIVATE_KEY last 10 chars: ...${PRIVATE_KEY.substring(PRIVATE_KEY.length - 10)}`);
  
  // Check if it's a mnemonic
  const words = PRIVATE_KEY.split(' ');
  if (words.length === 12 || words.length === 24) {
    console.log(`\n⚠️  PRIVATE_KEY appears to be a MNEMONIC (${words.length} words)`);
    console.log(`   First 3 words: ${words.slice(0, 3).join(' ')}...`);
    
    // Try to derive address from mnemonic
    try {
      const wallet = ethers.Wallet.fromPhrase(PRIVATE_KEY);
      const derivedAddress = wallet.address;
      console.log(`\nDerived address from mnemonic: ${derivedAddress}`);
      console.log(`Your wallet: ${YOUR_WALLET}`);
      console.log(`Match: ${derivedAddress.toLowerCase() === YOUR_WALLET.toLowerCase() ? '✅ YES' : '❌ NO'}`);
    } catch (e) {
      console.log(`\n❌ Error deriving address from mnemonic: ${(e as Error).message}`);
    }
  } else {
    // Try as private key
    try {
      let privateKey = PRIVATE_KEY;
      if (!privateKey.startsWith('0x')) {
        privateKey = '0x' + privateKey;
      }
      
      // Validate private key length (should be 66 chars with 0x, or 64 without)
      if (privateKey.length !== 66 && privateKey.length !== 64) {
        console.log(`\n⚠️  PRIVATE_KEY length is ${privateKey.length}, expected 64 or 66 characters`);
        console.log(`   This might be a mnemonic or invalid key`);
      } else {
        const wallet = new ethers.Wallet(privateKey);
        const derivedAddress = wallet.address;
        console.log(`\nDerived address from private key: ${derivedAddress}`);
        console.log(`Your wallet: ${YOUR_WALLET}`);
        console.log(`Match: ${derivedAddress.toLowerCase() === YOUR_WALLET.toLowerCase() ? '✅ YES' : '❌ NO'}`);
      }
    } catch (e) {
      console.log(`\n❌ Error deriving address from private key: ${(e as Error).message}`);
    }
  }
  
  // Check what Hardhat is using
  console.log(`\n=== Hardhat Signers ===`);
  const signers = await ethers.getSigners();
  for (let i = 0; i < Math.min(signers.length, 5); i++) {
    const address = await signers[i].getAddress();
    const balance = await ethers.provider.getBalance(address);
    console.log(`Account ${i}: ${address}`);
    console.log(`  Balance: ${ethers.formatEther(balance)} ETH`);
    console.log(`  Is your wallet: ${address.toLowerCase() === YOUR_WALLET.toLowerCase() ? '✅ YES' : '❌ NO'}`);
  }
  
  // Check MNEMONIC if exists
  const MNEMONIC = process.env.MNEMONIC || "";
  if (MNEMONIC) {
    console.log(`\n=== Checking MNEMONIC ===`);
    console.log(`MNEMONIC length: ${MNEMONIC.length}`);
    console.log(`MNEMONIC words: ${MNEMONIC.split(' ').length}`);
    
    try {
      const wallet = ethers.Wallet.fromPhrase(MNEMONIC);
      const derivedAddress = wallet.address;
      console.log(`Derived address from MNEMONIC: ${derivedAddress}`);
      console.log(`Your wallet: ${YOUR_WALLET}`);
      console.log(`Match: ${derivedAddress.toLowerCase() === YOUR_WALLET.toLowerCase() ? '✅ YES' : '❌ NO'}`);
    } catch (e) {
      console.log(`Error deriving from MNEMONIC: ${(e as Error).message}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

