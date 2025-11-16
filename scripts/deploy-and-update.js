const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('=== Deploying RockPaperScissors to Sepolia ===\n');
  
  // Step 1: Deploy contract
  console.log('Step 1: Deploying contract...');
  try {
    const deployOutput = execSync('npx hardhat deploy --network sepolia', {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    console.log(deployOutput);
    
    // Extract contract address from output
    const addressMatch = deployOutput.match(/RockPaperScissors contract:\s+(0x[a-fA-F0-9]{40})/);
    if (!addressMatch) {
      throw new Error('Could not find contract address in deploy output');
    }
    const contractAddress = addressMatch[1];
    console.log(`\n✅ Contract deployed at: ${contractAddress}\n`);
    
    // Step 2: Read deployment JSON to get ABI
    console.log('Step 2: Reading contract ABI from deployment...');
    const deploymentPath = path.join(__dirname, '..', 'deployments', 'sepolia', 'RockPaperScissors.json');
    if (!fs.existsSync(deploymentPath)) {
      throw new Error(`Deployment file not found: ${deploymentPath}`);
    }
    
    const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
    const contractABI = deploymentData.abi;
    
    console.log(`✅ ABI loaded (${contractABI.length} items)\n`);
    
    // Step 3: Update frontend config
    console.log('Step 3: Updating frontend config...');
    const frontendConfigPath = path.join(__dirname, '..', 'game', 'src', 'config', 'contracts.ts');
    
    // Read current config
    let configContent = fs.readFileSync(frontendConfigPath, 'utf-8');
    
    // Update contract address
    const addressRegex = /export const CONTRACT_ADDRESS = ['"](0x[a-fA-F0-9]{40})['"];?/;
    if (addressRegex.test(configContent)) {
      configContent = configContent.replace(
        addressRegex,
        `export const CONTRACT_ADDRESS = '${contractAddress}';`
      );
      console.log(`✅ Updated CONTRACT_ADDRESS to ${contractAddress}`);
    } else {
      // If pattern not found, add it after the comment
      configContent = configContent.replace(
        /\/\/ RockPaperScissors contract deployed on Sepolia\n/,
        `// RockPaperScissors contract deployed on Sepolia\nexport const CONTRACT_ADDRESS = '${contractAddress}';\n`
      );
    }
    
    // Update ABI
    const abiStartRegex = /export const CONTRACT_ABI = \[/;
    const abiEndRegex = /\] as const;/;
    
    if (abiStartRegex.test(configContent) && abiEndRegex.test(configContent)) {
      // Replace existing ABI
      const abiStart = configContent.indexOf('export const CONTRACT_ABI = [');
      const abiEnd = configContent.indexOf('] as const;', abiStart) + '] as const;'.length;
      
      const newABI = `export const CONTRACT_ABI = ${JSON.stringify(contractABI, null, 2)} as const;`;
      configContent = configContent.substring(0, abiStart) + newABI + configContent.substring(abiEnd);
      console.log(`✅ Updated CONTRACT_ABI (${contractABI.length} items)`);
    } else {
      // Add ABI if not found
      configContent += `\n\nexport const CONTRACT_ABI = ${JSON.stringify(contractABI, null, 2)} as const;`;
      console.log(`✅ Added CONTRACT_ABI (${contractABI.length} items)`);
    }
    
    // Write updated config
    fs.writeFileSync(frontendConfigPath, configContent, 'utf-8');
    console.log(`✅ Frontend config updated: ${frontendConfigPath}\n`);
    
    console.log('=== Deployment and Update Complete ===');
    console.log(`Contract Address: ${contractAddress}`);
    console.log(`Frontend Config: ${frontendConfigPath}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stdout) console.error('STDOUT:', error.stdout);
    if (error.stderr) console.error('STDERR:', error.stderr);
    process.exit(1);
  }
}

main();

