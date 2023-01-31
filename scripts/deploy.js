const hre = require("hardhat");

async function main() {
  const Ponzi = await hre.ethers.getContractFactory("Ponzi");
  const ponzi = await Ponzi.deploy();

  await ponzi.deployed();

  console.log(`Deployed to ${ponzi.address} on ${hre.network.name} network`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
