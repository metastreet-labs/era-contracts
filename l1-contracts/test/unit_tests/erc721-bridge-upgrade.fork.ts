import { expect } from "chai";
import * as hardhat from "hardhat";

import type { ethers } from "ethers";
import type { L1ERC721Bridge } from "../../typechain";
import { L1ERC721BridgeTestFactory } from "../../typechain";

import type { ITransparentUpgradeableProxy } from "../../typechain/ITransparentUpgradeableProxy";
import { ITransparentUpgradeableProxyFactory } from "../../typechain/ITransparentUpgradeableProxyFactory";

// TODO: change to the mainet config
const L1_ERC721_BRIDGE = "0x927DdFcc55164a59E0F33918D13a2D559bC10ce7";
const GOVERNOR_ADDRESS = "0x98591957D9741e7E7d58FC253044e0A014A3a323";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function isPromiseFailed(promise: Promise<any>): Promise<boolean> {
  let failed = false;
  try {
    await promise;
  } catch {
    failed = true;
  }
  return failed;
}

describe("L1 ERC721 proxy upgrade fork test", function () {
  const mailboxOnNewImplementation = "0x1234567890123456789012345678901234567890";

  let governor: ethers.Signer;
  let randomSigner: ethers.Signer;
  let bridgeProxy: ITransparentUpgradeableProxy;
  let newBridgeImplementation: L1ERC721Bridge;
  let oldBridgeImplementationAddress: string;

  before(async () => {
    await hardhat.network.provider.request({ method: "hardhat_impersonateAccount", params: [GOVERNOR_ADDRESS] });
    governor = await hardhat.ethers.provider.getSigner(GOVERNOR_ADDRESS);
    await hardhat.network.provider.send("hardhat_setBalance", [GOVERNOR_ADDRESS, "0xfffffffffffffffff"]);

    const signers = await hardhat.ethers.getSigners();
    randomSigner = signers[0];
    bridgeProxy = ITransparentUpgradeableProxyFactory.connect(L1_ERC721_BRIDGE, randomSigner);
    oldBridgeImplementationAddress = await bridgeProxy.connect(governor).callStatic.implementation();

    const l1Erc721BridgeFactory = await hardhat.ethers.getContractFactory("L1ERC721BridgeTest");
    const l1Erc721Bridge = await l1Erc721BridgeFactory.deploy(mailboxOnNewImplementation);
    newBridgeImplementation = L1ERC721BridgeTestFactory.connect(l1Erc721Bridge.address, l1Erc721Bridge.signer);
  });

  it("should revert on non-existed methods", async () => {
    const bridgeProxyAsNewImplementation = L1ERC721BridgeTestFactory.connect(bridgeProxy.address, randomSigner);

    const failedGetMailbox = await isPromiseFailed(bridgeProxyAsNewImplementation.getZkSyncMailbox());
    expect(failedGetMailbox).to.be.true;
  });

  it("should upgrade", async () => {
    await bridgeProxy.connect(governor).upgradeTo(newBridgeImplementation.address);
  });

  it("check new functions", async () => {
    const bridgeProxyAsNewImplementation = L1ERC721BridgeTestFactory.connect(bridgeProxy.address, randomSigner);

    const mailbox = await bridgeProxyAsNewImplementation.getZkSyncMailbox();
    expect(mailbox.toLocaleLowerCase()).to.be.eq(mailboxOnNewImplementation.toLocaleLowerCase());
  });

  it("should upgrade second time", async () => {
    const bridgeAsTransparentProxy = ITransparentUpgradeableProxyFactory.connect(bridgeProxy.address, governor);
    await bridgeAsTransparentProxy.upgradeTo(oldBridgeImplementationAddress);
  });

  it("should revert on non-existed methods", async () => {
    const bridgeProxyAsNewImplementation = L1ERC721BridgeTestFactory.connect(bridgeProxy.address, randomSigner);

    const failedGetAllowList = await isPromiseFailed(bridgeProxyAsNewImplementation.getAllowList());
    expect(failedGetAllowList).to.be.true;

    const failedGetMailbox = await isPromiseFailed(bridgeProxyAsNewImplementation.getZkSyncMailbox());
    expect(failedGetMailbox).to.be.true;
  });
});
