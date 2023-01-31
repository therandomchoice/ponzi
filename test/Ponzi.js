const { ethers } = require("hardhat");
const { expect } = require("chai");
const { parseEther, formatEther } = ethers.utils;
const {
  loadFixture,
  time,
} = require("@nomicfoundation/hardhat-network-helpers");
require("@nomicfoundation/hardhat-chai-matchers");

describe("Ponzi", function () {
  // fixture for Ponzi contract
  async function deployPonzi() {
    // seconds in a day
    const day = 86400;
    const [signer1, signer2, signer3] = await ethers.getSigners();
    const Ponzi = await ethers.getContractFactory("Ponzi");
    const ponzi = await Ponzi.deploy();
    // skip some initial time to better check the token conversion
    await time.increase(100 * day);

    return { ponzi, signer1, signer2, signer3, day };
  }

  // convert BigNumber value in wei to float number in ether
  function toFloatEther(value) {
    return parseFloat(formatEther(value));
  }

  it("allow to deposit", async function () {
    const { ponzi, signer1 } = await loadFixture(deployPonzi);
    await ponzi.deposit({ value: parseEther("1") });

    const balance_token = toFloatEther(await ponzi.balanceOf(signer1.address));
    expect(balance_token).to.be.approximately(1, 1e-9);

    const balance_internal = toFloatEther(
      await ponzi.internalBalanceOf(signer1.address)
    );
    expect(balance_internal).to.be.approximately(1 / 2 ** (100 / 32), 1e-9);

    const balance_ether = toFloatEther(
      await ethers.provider.getBalance(ponzi.address)
    );
    expect(balance_ether).to.eq(1);
  });

  it("zero deposit allowed but don't increase balance", async function () {
    const { ponzi, signer1 } = await loadFixture(deployPonzi);
    await ponzi.deposit();

    const balance_token = toFloatEther(await ponzi.balanceOf(signer1.address));
    expect(balance_token).to.eq(0);

    const balance_internal = toFloatEther(
      await ponzi.internalBalanceOf(signer1.address)
    );
    expect(balance_internal).to.eq(0);
  });

  it("sequential deposits correctly increase the internal token amount", async function () {
    const { ponzi, signer1, day } = await loadFixture(deployPonzi);
    var expected_tokens = 0;

    for (var t = 0; t < 32; t++) {
      await ponzi.deposit({ value: parseEther("0.1") });
      expected_tokens += 0.1 / 2 ** ((100 + t) / 32);
      const tokens = toFloatEther(
        await ponzi.internalBalanceOf(signer1.address)
      );
      expect(tokens).to.be.approximately(expected_tokens, 1e-9);
      await time.increase(day);
    }
  });

  it("allow to withdraw part of the deposit", async function () {
    const { ponzi, signer1 } = await loadFixture(deployPonzi);
    await ponzi.deposit({ value: parseEther("2") });

    const balance0 = toFloatEther(
      await ethers.provider.getBalance(signer1.address)
    );
    const tx = await ponzi.withdraw(parseEther("1"));
    const receipt = await tx.wait();
    const balance1 = toFloatEther(
      await ethers.provider.getBalance(signer1.address)
    );
    const gasSpent = toFloatEther(
      receipt.gasUsed.mul(receipt.effectiveGasPrice)
    );
    expect(balance1 - balance0).to.be.approximately(1 - gasSpent, 1e-9);

    const balance_token = toFloatEther(await ponzi.balanceOf(signer1.address));
    expect(balance_token).to.be.approximately(1, 1e-9);
  });

  it("withdraw with incorrect amount should be reverted", async function () {
    const { ponzi } = await loadFixture(deployPonzi);
    await ponzi.deposit({ value: parseEther("1") });

    const tx = ponzi.withdraw(parseEther("2"));
    await expect(tx).to.be.reverted;
  });

  it("allow to withdraw all deposit", async function () {
    const { ponzi, signer1 } = await loadFixture(deployPonzi);
    await ponzi.deposit({ value: parseEther("2") });

    const balance0 = toFloatEther(
      await ethers.provider.getBalance(signer1.address)
    );
    const tx = await ponzi.withdrawAll();
    const receipt = await tx.wait();
    const balance1 = toFloatEther(
      await ethers.provider.getBalance(signer1.address)
    );
    const gasSpent = toFloatEther(
      receipt.gasUsed.mul(receipt.effectiveGasPrice)
    );
    expect(balance1 - balance0).to.be.approximately(2 - gasSpent, 1e-9);

    const balance_token = toFloatEther(await ponzi.balanceOf(signer1.address));
    expect(balance_token).to.eq(0);
  });

  it("deposit should grow exponentially over time", async function () {
    const { ponzi, signer1, signer2, day } = await loadFixture(deployPonzi);
    await ponzi.deposit({ value: parseEther("1") });
    await ponzi.connect(signer2).deposit({ value: parseEther("2") });

    // check the correct growth for each day of the next four months
    for (var t = 1; t <= 32 * 4; t++) {
      await time.increase(day);
      const balance1 = toFloatEther(await ponzi.balanceOf(signer1.address));
      const balance2 = toFloatEther(await ponzi.balanceOf(signer2.address));
      const total = toFloatEther(await ponzi.totalSupply());
      expect(balance1).to.be.approximately(1 * 2 ** (t / 32), 1e-9);
      expect(balance2).to.be.approximately(2 * 2 ** (t / 32), 1e-9);
      expect(total).to.be.approximately(balance1 + balance2, 1e-9);
    }
  });

  it("allow to withdraw 2x ether after a month", async function () {
    const { ponzi, signer1, signer2, day } = await loadFixture(deployPonzi);
    await ponzi.deposit({ value: parseEther("1") });
    await ponzi.connect(signer2).deposit({ value: parseEther("1") });

    await time.increase(32 * day);
    const balance0 = toFloatEther(
      await ethers.provider.getBalance(signer1.address)
    );
    const tx = await ponzi.withdrawAll();
    const receipt = await tx.wait();
    const balance1 = toFloatEther(
      await ethers.provider.getBalance(signer1.address)
    );
    const gasSpent = toFloatEther(
      receipt.gasUsed.mul(receipt.effectiveGasPrice)
    );
    // ether balance should increase by two ether
    expect(balance1 - balance0).to.be.approximately(2 - gasSpent, 1e-9);
  });

  it("revert withdrawal if not enough ether left", async function () {
    const { ponzi, signer2, day } = await loadFixture(deployPonzi);
    await ponzi.deposit({ value: parseEther("1") });
    await ponzi.connect(signer2).deposit({ value: parseEther("1") });

    await time.increase(day);
    await ponzi.withdrawAll();

    // not enough ether for second user - it is Ponzi after all
    const tx = ponzi.connect(signer2).withdrawAll();
    await expect(tx).to.be.reverted;
  });

  it("allow to transfer more tokens than deposited after some time", async function () {
    const { ponzi, signer1, signer2, day } = await loadFixture(deployPonzi);
    await ponzi.deposit({ value: parseEther("2") });
    await ponzi.connect(signer2).deposit({ value: parseEther("2") });

    await time.increase(32 * day);
    // each user should have 4 tokens
    await ponzi.transfer(signer2.address, parseEther("3"));
    const balance1 = toFloatEther(await ponzi.balanceOf(signer1.address));
    const balance2 = toFloatEther(await ponzi.balanceOf(signer2.address));
    // check balances after transfer
    expect(balance1).to.be.approximately(4 - 3, 1e-9);
    expect(balance2).to.be.approximately(4 + 3, 1e-9);

    // check growth after transfer
    await time.increase(32 * day);
    const balance1a = toFloatEther(await ponzi.balanceOf(signer1.address));
    const balance2a = toFloatEther(await ponzi.balanceOf(signer2.address));
    expect(balance1a).to.be.approximately((4 - 3) * 2, 1e-9);
    expect(balance2a).to.be.approximately((4 + 3) * 2, 1e-9);
  });

  it("transfer of incorrect amount should be reverted", async function () {
    const { ponzi, signer2, day } = await loadFixture(deployPonzi);
    await ponzi.deposit({ value: parseEther("2") });

    await time.increase(32 * day);
    const tx = ponzi.transfer(signer2.address, parseEther("5"));
    await expect(tx).to.be.reverted;
  });

  // check allowances not growing with time
  it("allowances are not scaled", async function () {
    const { ponzi, signer1, signer2, day } = await loadFixture(deployPonzi);

    await ponzi.approve(signer2.address, parseEther("1"));
    await time.increase(32 * day);
    const allowance = toFloatEther(
      await ponzi.allowance(signer1.address, signer2.address)
    );
    expect(allowance).to.eq(1);
  });

  it("check transferFrom correctly work with allowances", async function () {
    const { ponzi, signer1, signer2, signer3, day } = await loadFixture(
      deployPonzi
    );
    await ponzi.deposit({ value: parseEther("1") });
    await ponzi.approve(signer2.address, parseEther("2"));

    await time.increase(32 * day);
    await ponzi
      .connect(signer2)
      .transferFrom(signer1.address, signer3.address, parseEther("2"));

    const balance1 = toFloatEther(await ponzi.balanceOf(signer1.address));
    expect(balance1).to.be.approximately(0, 1e-9);

    const balance3 = toFloatEther(await ponzi.balanceOf(signer3.address));
    expect(balance3).to.be.approximately(2, 1e-9);

    const allowance = toFloatEther(
      await ponzi.allowance(signer1.address, signer2.address)
    );
    expect(allowance).to.eq(0);
  });

  it("transferFrom with not enough allowance should be reverted", async function () {
    const { ponzi, signer1, signer2 } = await loadFixture(deployPonzi);
    await ponzi.deposit({ value: parseEther("4") });
    await ponzi.approve(signer2.address, parseEther("1"));

    const tx = ponzi
      .connect(signer2)
      .transferFrom(signer1.address, signer2.address, parseEther("2"));
    await expect(tx).to.be.reverted;
  });
});
