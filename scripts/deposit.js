const hre = require("hardhat");
const { parseEther, formatEther } = hre.ethers.utils;

// Desired amount of ether to deposit
const depositAmount = "0.2";
// Ponzi contract address on Goerli testnet
const contractAddress = "0x933033cb97Df7fb4b32453b4aaa6776C4dC8Cee0";

async function main() {
  const Ponzi = await hre.ethers.getContractFactory("Ponzi");
  const ponzi = Ponzi.attach(contractAddress);
  const tx = await ponzi.deposit({ value: parseEther(depositAmount) });
  await tx.wait();

  const signer = await hre.ethers.getSigner();
  const balance = formatEther(await ponzi.balanceOf(signer.address));

  console.log(`Deposit ${depositAmount} ether`);
  console.log(`Ponzi tokens balance is ${balance}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
