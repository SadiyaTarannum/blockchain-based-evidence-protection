const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const EvidenceStorage = await hre.ethers.getContractFactory("EvidenceStorage");
  const contract = await EvidenceStorage.deploy();
  // await contract.deployed(); // <--- REMOVE OR COMMENT OUT THIS LINE

  console.log("✅ Contract deployed to:", contract.address);

  // Optional: save address to frontend
  const frontendPath = path.resolve(__dirname, "../../client/src/contract");
  if (!fs.existsSync(frontendPath)) {
    fs.mkdirSync(frontendPath);
  }

  fs.writeFileSync(
    `${frontendPath}/contract-address.json`,
    JSON.stringify({ address: contract.address }, null, 2)
  );

  fs.writeFileSync(
    `${frontendPath}/abi.json`,
    JSON.stringify(contract.interface.format("json"), null, 2)
  );
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});