const { ethers } = require("hardhat");
const hre = require("hardhat");
const { parseEther, formatEther } = hre.ethers.utils;

// Desired amount of ether to withdraw or "all" to withdraw all
const withdrawAmount = "all";
// Ponzi contract address on Goerli testnet
const contractAddress = "0x933033cb97Df7fb4b32453b4aaa6776C4dC8Cee0";

async function main() {
  const Ponzi = await hre.ethers.getContractFactory("Ponzi");
  const ponzi = Ponzi.attach(contractAddress);

  const signer = await hre.ethers.getSigner();
  const balance0 = formatEther(
    await ethers.provider.getBalance(signer.address)
  );

  if (withdrawAmount === "all") {
    const tx = await ponzi.withdrawAll();
    await tx.wait();
  } else {
    const tx = await ponzi.withdraw(parseEther(withdrawAmount));
    await tx.wait();
  }

  const balance1 = formatEther(
    await ethers.provider.getBalance(signer.address)
  );

  console.log(`Withdraw ${withdrawAmount} ether`);
  console.log(`Ether balance before withdrawal is ${balance0}`);
  console.log(`Ether balance after withdrawal is ${balance1}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
