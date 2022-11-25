const hre = require("hardhat");
const ethers = hre.ethers;

const { deployProtocolClients } = require("../../../scripts/util/deploy-protocol-clients");
const { getInterfaceIds } = require("../../../scripts/config/supported-interfaces.js");
const { deployProtocolDiamond } = require("../../../scripts/util/deploy-protocol-diamond.js");
const { deployProtocolHandlerFacets } = require("../../../scripts/util/deploy-protocol-handler-facets.js");
const Role = require("../../../scripts/domain/Role");
const { DisputeResolverFee } = require("../../../scripts/domain/DisputeResolverFee");
const Range = require("../../../scripts/domain/Range");
const VoucherInitValues = require("../../../scripts/domain/VoucherInitValues");
const { mockOffer } = require("../../util/mock.js");
const { deployProtocolConfigFacet } = require("../../../scripts/util/deploy-protocol-config-facet.js");
const { assert, expect } = require("chai");
const { RevertReasons } = require("../../../scripts/config/revert-reasons");
const { oneWeek, oneMonth, maxPriorityFeePerGas } = require("../../util/constants");
const {
  mockDisputeResolver,
  mockSeller,
  mockVoucherInitValues,
  mockAuthToken,
  mockBuyer,
  accountId,
} = require("../../util/mock");
const { applyPercentage } = require("../../util/utils.js");

describe("IBosonVoucher", function () {
  let interfaceIds;
  let protocolDiamond, accessController;
  let bosonVoucher, offerHandler, accountHandler, exchangeHandler, fundsHandler;
  let deployer,
    protocol,
    buyer,
    rando,
    operator,
    admin,
    clerk,
    treasury,
    operatorDR,
    adminDR,
    clerkDR,
    treasuryDR,
    seller,
    protocolTreasury,
    bosonToken;
  let disputeResolver, disputeResolverFees;
  let emptyAuthToken;
  let agentId;
  let voucherInitValues, contractURI, royaltyPercentage, exchangeId, offerPrice;

  before(async function () {
    // Get interface id
    const { IBosonVoucher, IERC721, IERC2981 } = await getInterfaceIds();
    interfaceIds = { IBosonVoucher, IERC721, IERC2981 };
  });

  beforeEach(async function () {
    // Set signers (fake protocol address to test issue and burn voucher without protocol dependencie)
    [deployer, protocol, buyer, rando, admin, treasury, adminDR, treasuryDR, protocolTreasury, bosonToken] =
      await ethers.getSigners();

    // make all account the same
    operator = clerk = admin;
    operatorDR = clerkDR = adminDR;

    // Deploy diamond
    [protocolDiamond, , , , accessController] = await deployProtocolDiamond(maxPriorityFeePerGas);

    // Cast Diamond to contract interfaces
    offerHandler = await ethers.getContractAt("IBosonOfferHandler", protocolDiamond.address);
    accountHandler = await ethers.getContractAt("IBosonAccountHandler", protocolDiamond.address);
    exchangeHandler = await ethers.getContractAt("IBosonExchangeHandler", protocolDiamond.address);
    fundsHandler = await ethers.getContractAt("IBosonFundsHandler", protocolDiamond.address);

    // Grant roles
    await accessController.grantRole(Role.PROTOCOL, protocol.address);
    await accessController.grantRole(Role.PROTOCOL, protocolDiamond.address);
    await accessController.grantRole(Role.UPGRADER, deployer.address);

    // Cut the protocol handler facets into the Diamond
    await deployProtocolHandlerFacets(
      protocolDiamond,
      [
        "ExchangeHandlerFacet",
        "OfferHandlerFacet",
        "SellerHandlerFacet",
        "DisputeResolverHandlerFacet",
        "FundsHandlerFacet",
      ],
      maxPriorityFeePerGas
    );

    const protocolClientArgs = [protocolDiamond.address];
    const [, beacons, proxies, bv] = await deployProtocolClients(protocolClientArgs, maxPriorityFeePerGas);
    [bosonVoucher] = bv;
    const [beacon] = beacons;
    const [proxy] = proxies;

    const protocolFeeFlatBoson = ethers.utils.parseUnits("0.01", "ether").toString();
    const buyerEscalationDepositPercentage = "1000"; // 10%

    // Add config Handler, so ids start at 1, and so voucher address can be found
    const protocolConfig = [
      // Protocol addresses
      {
        treasury: protocolTreasury.address,
        token: bosonToken.address,
        voucherBeacon: beacon.address,
        beaconProxy: proxy.address,
      },
      // Protocol limits
      {
        maxExchangesPerBatch: 100,
        maxOffersPerGroup: 100,
        maxTwinsPerBundle: 100,
        maxOffersPerBundle: 100,
        maxOffersPerBatch: 100,
        maxTokensPerWithdrawal: 100,
        maxFeesPerDisputeResolver: 100,
        maxEscalationResponsePeriod: oneMonth,
        maxDisputesPerBatch: 100,
        maxAllowedSellers: 100,
        maxTotalOfferFeePercentage: 4000, //40%
        maxRoyaltyPecentage: 1000, //10%
        maxResolutionPeriod: oneMonth,
        minDisputePeriod: oneWeek,
      },
      //Protocol fees
      {
        percentage: 200, // 2%
        flatBoson: protocolFeeFlatBoson,
        buyerEscalationDepositPercentage,
      },
    ];

    await deployProtocolConfigFacet(protocolDiamond, protocolConfig, maxPriorityFeePerGas);
  });

  // Interface support
  context("📋 Interfaces", async function () {
    context("👉 supportsInterface()", async function () {
      it("should indicate support for IBosonVoucher, IERC721 and IERC2981 interface", async function () {
        // IBosonVoucher interface
        let support = await bosonVoucher.supportsInterface(interfaceIds["IBosonVoucher"]);
        expect(support, "IBosonVoucher interface not supported").is.true;

        // IERC721 interface
        support = await bosonVoucher.supportsInterface(interfaceIds["IERC721"]);
        expect(support, "IERC721 interface not supported").is.true;

        // IERC2981 interface
        support = await bosonVoucher.supportsInterface(interfaceIds["IERC2981"]);
        expect(support, "IERC2981 interface not supported").is.true;
      });
    });
  });

  context("issueVoucher()", function () {
    let buyerStruct;
    let buyerWallet;

    before(function () {
      buyerStruct = mockBuyer(buyer.address).toStruct();
      buyerWallet = buyerStruct[1];
    });

    after(async function () {
      // Reset the accountId iterator
      accountId.next(true);
    });

    it("should issue a voucher with success", async function () {
      const balanceBefore = await bosonVoucher.balanceOf(buyer.address);
      await bosonVoucher.connect(protocol).issueVoucher(0, buyerWallet);

      const balanceAfter = await bosonVoucher.balanceOf(buyer.address);

      expect(balanceAfter.sub(balanceBefore)).eq(1);
    });

    it("should revert if caller does not have PROTOCOL role", async function () {
      // Expect revert if random user attempts to issue voucher
      await expect(bosonVoucher.connect(rando).issueVoucher(0, buyerWallet)).to.be.revertedWith(
        RevertReasons.ACCESS_DENIED
      );

      // Grant PROTOCOL role to random user address
      await accessController.grantRole(Role.PROTOCOL, rando.address);

      //Attempt to issue voucher again as a random user
      const balanceBefore = await bosonVoucher.balanceOf(buyer.address);
      await bosonVoucher.connect(rando).issueVoucher(0, buyerWallet);
      const balanceAfter = await bosonVoucher.balanceOf(buyer.address);

      expect(balanceAfter.sub(balanceBefore)).eq(1);
    });
  });

  context.skip("premint", function () {
    // before(function () {
    //   buyerStruct = mockBuyer(buyer.address).toStruct();
    //   buyerWallet = buyerStruct[1];
    // });

    after(async function () {
      // Reset the accountId iterator
      accountId.next(true);
    });

    it.only("safetransferfrom", async function () {
      seller = mockSeller(operator.address, admin.address, clerk.address, treasury.address);

      console.log("owner address", operator.address);
      // prepare the VoucherInitValues
      voucherInitValues = mockVoucherInitValues();
      const bosonVoucher2 = await ethers.getContractAt("BosonVoucher", bosonVoucher.address);

      await bosonVoucher2.initializeVoucher(seller.id, operator.address, voucherInitValues);
      // const balanceBefore = await bosonVoucher.balanceOf(buyer.address);

      await bosonVoucher2.connect(protocol).reserveRange(10, 15, 50); // 15 - 65

      let tokenId = 16;
      await expect(bosonVoucher2.ownerOf(tokenId)).to.be.revertedWith("ERC721: invalid token ID");
      let ownerOf = await bosonVoucher2.ownerOf(tokenId);
      console.log(ownerOf);

      await bosonVoucher2.connect(operator).preMint(10, 20); // 15 - 65

      // ownerOf = await bosonVoucher2.ownerOf(tokenId);
      // console.log(ownerOf)

      // transfer shoud work
      await bosonVoucher2.connect(operator).transferFrom(operator.address, rando.address, 16);
      await bosonVoucher2
        .connect(operator)
        ["safeTransferFrom(address,address,uint256,bytes)"](operator.address, rando.address, 17, "0x");
      await bosonVoucher2.connect(operator).setApprovalForAll(rando.address, true);
      await bosonVoucher2
        .connect(rando)
        ["safeTransferFrom(address,address,uint256,bytes)"](operator.address, rando.address, 18, "0x");
    });
  });

  context("reserveRange()", function () {
    let offerId, startId, length;
    let range;

    beforeEach(async function () {
      const sellerId = 1;

      // prepare the VoucherInitValues
      voucherInitValues = mockVoucherInitValues();
      const bosonVoucherInit = await ethers.getContractAt("BosonVoucher", bosonVoucher.address);

      await bosonVoucherInit.initializeVoucher(sellerId, operator.address, voucherInitValues);

      offerId = "5";
      startId = "10";
      length = "123";

      range = new Range(offerId, startId, length, "0");
    });

    it("Should emit event RangeReserved", async function () {
      // Reserve range, test for event
      await expect(bosonVoucher.connect(protocol).reserveRange(offerId, startId, length))
        .to.emit(bosonVoucher, "RangeReserved")
        .withArgs(offerId, range.toStruct());
    });

    it("Should update state", async function () {
      // Reserve range
      await bosonVoucher.connect(protocol).reserveRange(offerId, startId, length);

      // Get range object from contract
      const returnedRange = Range.fromStruct(await bosonVoucher.getRangeByOfferId(offerId));
      assert.equal(returnedRange.toString(), range.toString(), "Range mismatch");

      // Get available premints from contract
      const availablePremints = await bosonVoucher.getAvailablePreMints(offerId);
      assert.equal(availablePremints.toString(), length, "Available Premints mismatch");
    });

    context("💔 Revert Reasons", async function () {
      it("caller does not have PROTOCOL role", async function () {
        await expect(bosonVoucher.connect(rando).reserveRange(offerId, startId, length)).to.be.revertedWith(
          RevertReasons.ACCESS_DENIED
        );
      });

      it("Start id is not greater than zero", async function () {
        // Set start id to 0
        startId = 0;

        // Try to reserve range, it should fail
        await expect(bosonVoucher.connect(protocol).reserveRange(offerId, startId, length)).to.be.revertedWith(
          RevertReasons.INVALID_RANGE_START
        );
      });

      it("Offer id is already associated with a range", async function () {
        // Reserve range for an offer
        await bosonVoucher.connect(protocol).reserveRange(offerId, startId, length);

        // Try to reserve range for the same offer, it should fail
        await expect(bosonVoucher.connect(protocol).reserveRange(offerId, startId, length)).to.be.revertedWith(
          RevertReasons.OFFER_RANGE_ALREADY_RESERVED
        );
      });
    });
  });

  context("preMint()", function () {
    let offerId, startId, length, amount;
    let range;

    beforeEach(async function () {
      const sellerId = 1;

      // prepare the VoucherInitValues
      voucherInitValues = mockVoucherInitValues();
      const bosonVoucherInit = await ethers.getContractAt("BosonVoucher", bosonVoucher.address);

      await bosonVoucherInit.initializeVoucher(sellerId, operator.address, voucherInitValues);

      // reserve a range
      offerId = "5";
      startId = "10";
      length = "1000";

      range = new Range(offerId, startId, length, "0");

      await bosonVoucher.connect(protocol).reserveRange(offerId, startId, length);

      // amount to mint
      amount = 50;
    });

    it("Should emit Transfer events", async function () {
      // Premint tokens, test for event
      const tx = await bosonVoucher.connect(operator).preMint(offerId, amount);

      // Expect an event for every mint
      for (let i = 0; i < Number(amount); i++) {
        await expect(tx).to.emit(bosonVoucher,"Transfer").withArgs(ethers.constants.AddressZero,operator.address,i+Number(startId))
      }
      
    });

    it.skip("Should update state", async function () {
      let sellerBalanceBefore = await bosonVoucher.balanceOf(operator.address);

      // Premint tokens
      await bosonVoucher.connect(operator).preMint(offerId, amount);

      // Expect an event for every mint
      for (let i = 0; i < Number(amount); i++) {
        let tokenId = i+Number(startId);
        tokenOwner = await bosonVoucher.ownerOf(tokenId); // I suspcet ownerOf does not work correctly
        assert.equal(tokenOwner, operator.address, `Wrong token owner for token ${tokenId}`);
      }

      // Token that is inside a range, but wasn't preminted yet should not have an owner 
      await expect(bosonVoucher.ownerOf(Number(amount)+Number(startId)+1)).to.be.revertedWith(RevertReasons.ERC721_NON_EXISTENT);

      // Seller's balance should be updated for the total mint amount
      let sellerBalanceAfter = await bosonVoucher.balanceOf(operator.address);
      console.log("after", sellerBalanceAfter.toString())
      console.log("before", sellerBalanceBefore.toString())
      assert.equal(sellerBalanceAfter.toNumber(), sellerBalanceBefore.add(amount).toNumber(), "Balance mismatch")

      // Get available premints from contract
      const availablePremints = await bosonVoucher.getAvailablePreMints(offerId);
      assert.equal(availablePremints.toString(), `${Number(length)-Number(amount)}`, "Available Premints mismatch");
    });

    context("💔 Revert Reasons", async function () {
      it("Caller is not the owner", async function () {
        await expect(bosonVoucher.connect(rando).preMint(offerId, amount)).to.be.revertedWith(
          RevertReasons.OWNABLE_NOT_OWNER
        );
      });

      it("Offer id is not associated with a range", async function () {
        // Set invalid offer id
        offerId = 15;

        // Try to premint, it should fail
        await expect(bosonVoucher.connect(operator).preMint(offerId, amount)).to.be.revertedWith(
          RevertReasons.NO_RESERVED_RANGE_FOR_OFFER
        );
      });

      it("Amount to mint is more than remaining un-minted in range", async function () {
        // Mint 50 tokens
        await bosonVoucher.connect(operator).preMint(offerId, amount);
        
        // Set invalid amount
        amount = "990" // length is 1000, already minted 50

        // Try to premint, it should fail
        await expect(bosonVoucher.connect(operator).preMint(offerId, amount)).to.be.revertedWith(
          RevertReasons.INVALID_AMOUNT_TO_MINT
        );
      });

      it.skip("Too many to mint in a single transaction, given current block gas limit", async function () {
        // TODO: add maxPremintedTokens to voucher and write test for it
      });
    });
  });

  ("");
  ("");
  ("");
  ("");
  ("");
  ("");
  ("");
  ("getAvailablePreMints()");
  ("Returns correct values");
  ("ownerOf()");
  ("Returns true owner if token exists");
  ("Returns seller if token is preminted and not transferred yet");
  ("Reverts for not minted tokens");
  ("REverts for token in reserved range, if not premited yet");
  ("Reverts if token was preminted and already burned");
  ("transferFrom()");
  ("normal transfer");
  ("calls on voucher transferred");
  ("normal transfer when seller is true owner");
  ("transfer preminted");
  ("calls commitToPreMintedOffer");
  "nosilenmintallowed"

  context("burnVoucher()", function () {
    after(async function () {
      // Reset the accountId iterator
      accountId.next(true);
    });

    it("should burn a voucher with success", async function () {
      const buyerStruct = mockBuyer(buyer.address).toStruct();
      const buyerWallet = buyerStruct[1];
      await bosonVoucher.connect(protocol).issueVoucher(0, buyerWallet);

      const balanceBefore = await bosonVoucher.balanceOf(buyer.address);

      await bosonVoucher.connect(protocol).burnVoucher(0);

      const balanceAfter = await bosonVoucher.balanceOf(buyer.address);

      expect(balanceBefore.sub(balanceAfter)).eq(1);
    });

    it("should revert if caller does not have PROTOCOL role", async function () {
      // Expect revert if random user attempts to burn voucher
      await expect(bosonVoucher.connect(rando).burnVoucher(0)).to.be.revertedWith(RevertReasons.ACCESS_DENIED);

      // Grant PROTOCOL role to random user address
      await accessController.grantRole(Role.PROTOCOL, rando.address);

      // Prepare to burn voucher as a random user
      const buyerStruct = mockBuyer(buyer.address).toStruct();
      const buyerWallet = buyerStruct[1];
      await bosonVoucher.connect(protocol).issueVoucher(0, buyerWallet);
      const balanceBefore = await bosonVoucher.balanceOf(buyer.address);

      //Attempt to burn voucher as a random user
      await bosonVoucher.connect(protocol).burnVoucher(0);
      const balanceAfter = await bosonVoucher.balanceOf(buyer.address);

      expect(balanceBefore.sub(balanceAfter)).eq(1);
    });
  });

  context("tokenURI", function () {
    let metadataUri;

    beforeEach(async function () {
      seller = mockSeller(operator.address, admin.address, clerk.address, treasury.address);

      // prepare the VoucherInitValues
      voucherInitValues = mockVoucherInitValues();
      expect(voucherInitValues.isValid()).is.true;

      // AuthToken
      emptyAuthToken = mockAuthToken();
      expect(emptyAuthToken.isValid()).is.true;

      await accountHandler.connect(admin).createSeller(seller, emptyAuthToken, voucherInitValues);

      agentId = "0"; // agent id is optional while creating an offer

      // Create a valid dispute resolver
      disputeResolver = mockDisputeResolver(
        operatorDR.address,
        adminDR.address,
        clerkDR.address,
        treasuryDR.address,
        true
      );
      expect(disputeResolver.isValid()).is.true;

      //Create DisputeResolverFee array so offer creation will succeed
      disputeResolverFees = [new DisputeResolverFee(ethers.constants.AddressZero, "Native", "0")];

      // Make empty seller list, so every seller is allowed
      const sellerAllowList = [];

      // Register the dispute resolver
      await accountHandler
        .connect(adminDR)
        .createDisputeResolver(disputeResolver, disputeResolverFees, sellerAllowList);

      const { offer, offerDates, offerDurations, disputeResolverId } = await mockOffer();
      await offerHandler
        .connect(operator)
        .createOffer(offer.toStruct(), offerDates.toStruct(), offerDurations.toStruct(), disputeResolverId, agentId);
      await fundsHandler
        .connect(admin)
        .depositFunds(seller.id, ethers.constants.AddressZero, offer.sellerDeposit, { value: offer.sellerDeposit });
      await exchangeHandler.connect(buyer).commitToOffer(buyer.address, offer.id, { value: offer.price });

      metadataUri = offer.metadataUri;
    });

    afterEach(async function () {
      // Reset the accountId iterator
      accountId.next(true);
    });

    it("should return the correct tokenURI", async function () {
      const tokenURI = await bosonVoucher.tokenURI(1);
      expect(tokenURI).eq(metadataUri);
    });
  });

  context("transferOwnership()", function () {
    it("should emit OwnershipTransferred", async function () {
      const ownable = await ethers.getContractAt("OwnableUpgradeable", bosonVoucher.address);
      await expect(bosonVoucher.connect(protocol).transferOwnership(operator.address))
        .to.emit(ownable, "OwnershipTransferred")
        .withArgs(ethers.constants.AddressZero, operator.address);
    });

    it("should transfer ownership with success", async function () {
      await bosonVoucher.connect(protocol).transferOwnership(operator.address);

      const ownable = await ethers.getContractAt("OwnableUpgradeable", bosonVoucher.address);
      const owner = await ownable.owner();

      expect(owner).eq(operator.address, "Wrong owner");
    });

    context("💔 Revert Reasons", async function () {
      it("should revert if caller does not have PROTOCOL role", async function () {
        await expect(bosonVoucher.connect(rando).transferOwnership(operator.address)).to.be.revertedWith(
          RevertReasons.ACCESS_DENIED
        );
      });

      it("Even the current owner cannot transfer the ownership", async function () {
        // succesfully transfer to operator
        await bosonVoucher.connect(protocol).transferOwnership(operator.address);

        // owner tries to transfer, it should fail
        await expect(bosonVoucher.connect(operator).transferOwnership(rando.address)).to.be.revertedWith(
          RevertReasons.ACCESS_DENIED
        );
      });

      it("Transfering ownership to 0 is not allowed", async function () {
        // try to transfer ownership to address 0, should fail
        await expect(bosonVoucher.connect(protocol).transferOwnership(ethers.constants.AddressZero)).to.be.revertedWith(
          RevertReasons.OWNABLE_ZERO_ADDRESS
        );
      });
    });
  });

  context("setContractURI()", function () {
    beforeEach(async function () {
      // give ownership to operator
      await bosonVoucher.connect(protocol).transferOwnership(operator.address);

      contractURI = "newContractURI";
    });

    it("should emit ContractURIChanged event", async function () {
      await expect(bosonVoucher.connect(operator).setContractURI(contractURI))
        .to.emit(bosonVoucher, "ContractURIChanged")
        .withArgs(contractURI);
    });

    it("should set new contract with success", async function () {
      await bosonVoucher.connect(operator).setContractURI(contractURI);

      const returnedContractURI = await bosonVoucher.contractURI();

      expect(returnedContractURI).eq(contractURI, "Wrong contractURI");
    });

    it("should revert if caller is not the owner", async function () {
      // random caller
      await expect(bosonVoucher.connect(rando).setContractURI(contractURI)).to.be.revertedWith(
        RevertReasons.OWNABLE_NOT_OWNER
      );

      // protocol as the caller
      await expect(bosonVoucher.connect(protocol).setContractURI(contractURI)).to.be.revertedWith(
        RevertReasons.OWNABLE_NOT_OWNER
      );
    });
  });

  context("ERC2981 NFT Royalty fee", function () {
    beforeEach(async function () {
      seller = mockSeller(operator.address, admin.address, clerk.address, treasury.address);

      // prepare the VoucherInitValues
      voucherInitValues = mockVoucherInitValues();
      expect(voucherInitValues.isValid()).is.true;

      // AuthToken
      emptyAuthToken = mockAuthToken();
      expect(emptyAuthToken.isValid()).is.true;

      await accountHandler.connect(admin).createSeller(seller, emptyAuthToken, voucherInitValues);

      agentId = "0"; // agent id is optional while creating an offer

      // Create a valid dispute resolver
      disputeResolver = mockDisputeResolver(
        operatorDR.address,
        adminDR.address,
        clerkDR.address,
        treasuryDR.address,
        true
      );
      expect(disputeResolver.isValid()).is.true;

      //Create DisputeResolverFee array so offer creation will succeed
      disputeResolverFees = [new DisputeResolverFee(ethers.constants.AddressZero, "Native", "0")];

      // Make empty seller list, so every seller is allowed
      const sellerAllowList = [];

      // Register the dispute resolver
      await accountHandler
        .connect(adminDR)
        .createDisputeResolver(disputeResolver, disputeResolverFees, sellerAllowList);

      const { offer, offerDates, offerDurations, disputeResolverId } = await mockOffer();
      await offerHandler
        .connect(operator)
        .createOffer(offer.toStruct(), offerDates.toStruct(), offerDurations.toStruct(), disputeResolverId, agentId);
      await fundsHandler
        .connect(admin)
        .depositFunds(seller.id, ethers.constants.AddressZero, offer.sellerDeposit, { value: offer.sellerDeposit });
      await exchangeHandler.connect(buyer).commitToOffer(buyer.address, offer.id, { value: offer.price });

      exchangeId = "1";

      offerPrice = offer.price;
    });

    afterEach(async function () {
      // Reset the accountId iterator
      accountId.next(true);
    });

    context("setRoyaltyPercentage()", function () {
      beforeEach(async function () {
        // give ownership to operator
        await bosonVoucher.connect(protocol).transferOwnership(operator.address);
      });

      it("should emit RoyaltyPercentageChanged event", async function () {
        royaltyPercentage = "0"; //0%
        await expect(bosonVoucher.connect(operator).setRoyaltyPercentage(royaltyPercentage))
          .to.emit(bosonVoucher, "RoyaltyPercentageChanged")
          .withArgs(royaltyPercentage);
      });

      it("should set a royalty fee percentage", async function () {
        // First, set royalty fee as 0
        royaltyPercentage = "0"; //0%
        await bosonVoucher.connect(operator).setRoyaltyPercentage(royaltyPercentage);

        let receiver, royaltyAmount;
        [receiver, royaltyAmount] = await bosonVoucher.connect(rando).royaltyInfo(exchangeId, offerPrice);

        // Expectations
        let expectedRecipient = seller.treasury;
        let expectedRoyaltyAmount = "0";

        assert.equal(receiver, expectedRecipient, "Recipient address is incorrect");
        assert.equal(royaltyAmount.toString(), expectedRoyaltyAmount, "Royalty amount is incorrect");

        // Now, set royalty fee as 10%
        royaltyPercentage = "1000"; //10%
        await bosonVoucher.connect(operator).setRoyaltyPercentage(royaltyPercentage);

        [receiver, royaltyAmount] = await bosonVoucher.connect(rando).royaltyInfo(exchangeId, offerPrice);

        // Expectations
        expectedRecipient = seller.treasury;
        expectedRoyaltyAmount = applyPercentage(offerPrice, royaltyPercentage);

        assert.equal(receiver, expectedRecipient, "Recipient address is incorrect");
        assert.equal(royaltyAmount.toString(), expectedRoyaltyAmount, "Royalty amount is incorrect");
      });

      context("💔 Revert Reasons", async function () {
        it("should revert if caller is not the owner", async function () {
          // random caller
          await expect(bosonVoucher.connect(rando).setRoyaltyPercentage(royaltyPercentage)).to.be.revertedWith(
            RevertReasons.OWNABLE_NOT_OWNER
          );

          // protocol as the caller
          await expect(bosonVoucher.connect(protocol).setRoyaltyPercentage(royaltyPercentage)).to.be.revertedWith(
            RevertReasons.OWNABLE_NOT_OWNER
          );
        });

        it("should revert if royaltyPercentage is greater than max royalty percentage defined in the protocol", async function () {
          // Set royalty fee as 15% (protocol limit is 10%)
          royaltyPercentage = "1500"; //15%

          // royalty percentage too high, expectig revert
          await expect(bosonVoucher.connect(operator).setRoyaltyPercentage(royaltyPercentage)).to.be.revertedWith(
            RevertReasons.ROYALTY_FEE_INVALID
          );
        });
      });
    });

    context("getRoyaltyPercentage()", function () {
      it("should return the royalty fee percentage", async function () {
        // give ownership to operator
        await bosonVoucher.connect(protocol).transferOwnership(operator.address);

        royaltyPercentage = "1000"; //10%
        await bosonVoucher.connect(operator).setRoyaltyPercentage(royaltyPercentage);

        expect(await bosonVoucher.connect(rando).getRoyaltyPercentage()).to.equal(
          royaltyPercentage,
          "Invalid royalty percentage"
        );
      });
    });

    context("royaltyInfo()", function () {
      beforeEach(async function () {
        // give ownership to operator
        await bosonVoucher.connect(protocol).transferOwnership(operator.address);
      });

      it("should return a recipient and royalty fee", async function () {
        // First, set royalty fee as 0
        royaltyPercentage = "0"; //0%
        await bosonVoucher.connect(operator).setRoyaltyPercentage(royaltyPercentage);

        let receiver, royaltyAmount;
        [receiver, royaltyAmount] = await bosonVoucher.connect(operator).royaltyInfo(exchangeId, offerPrice);

        // Expectations
        let expectedRecipient = seller.treasury;
        let expectedRoyaltyAmount = "0";

        assert.equal(receiver, expectedRecipient, "Recipient address is incorrect");
        assert.equal(royaltyAmount.toString(), expectedRoyaltyAmount, "Royalty amount is incorrect");

        // Now, set royalty fee as 10%
        royaltyPercentage = "1000"; //10%
        await bosonVoucher.connect(operator).setRoyaltyPercentage(royaltyPercentage);

        [receiver, royaltyAmount] = await bosonVoucher.connect(operator).royaltyInfo(exchangeId, offerPrice);

        // Expectations
        expectedRecipient = seller.treasury;
        expectedRoyaltyAmount = applyPercentage(offerPrice, royaltyPercentage);

        assert.equal(receiver, expectedRecipient, "Recipient address is incorrect");
        assert.equal(royaltyAmount.toString(), expectedRoyaltyAmount, "Royalty amount is incorrect");

        // Any random address can check the royalty info
        // Now, set royalty fee as 8%
        royaltyPercentage = "800"; //8%
        await bosonVoucher.connect(operator).setRoyaltyPercentage(royaltyPercentage);

        [receiver, royaltyAmount] = await bosonVoucher.connect(rando).royaltyInfo(exchangeId, offerPrice);

        // Expectations
        expectedRecipient = seller.treasury;
        expectedRoyaltyAmount = applyPercentage(offerPrice, royaltyPercentage);

        assert.equal(receiver, expectedRecipient, "Recipient address is incorrect");
        assert.equal(royaltyAmount.toString(), expectedRoyaltyAmount, "Royalty amount is incorrect");
      });
    });

    context("💔 Revert Reasons", async function () {
      it("should revert during create seller if royaltyPercentage is greater than max royalty percentage defined in the protocol", async function () {
        // create invalid voucherInitValues
        royaltyPercentage = "2000"; // 20%
        voucherInitValues = new VoucherInitValues("ContractURI", royaltyPercentage);

        // create another seller
        seller = mockSeller(rando.address, rando.address, rando.address, rando.address);
        seller.id = "2";

        // royalty percentage too high, expectig revert
        await expect(
          accountHandler.connect(rando).createSeller(seller, emptyAuthToken, voucherInitValues)
        ).to.be.revertedWith(RevertReasons.ROYALTY_FEE_INVALID);
      });
    });
  });

  context("getSellerId()", function () {
    it("should return the seller id", async function () {
      // prepare the VoucherInitValues
      voucherInitValues = mockVoucherInitValues();
      expect(voucherInitValues.isValid()).is.true;

      // AuthToken
      emptyAuthToken = mockAuthToken();
      expect(emptyAuthToken.isValid()).is.true;

      seller = mockSeller(operator.address, admin.address, clerk.address, treasury.address);

      await accountHandler.connect(admin).createSeller(seller, emptyAuthToken, voucherInitValues);

      await bosonVoucher.connect(protocol).transferOwnership(operator.address);

      expect(await bosonVoucher.connect(rando).getSellerId()).to.equal(seller.id, "Invalid seller id returned");

      // Reset the accountId iterator
      accountId.next(true);
    });
  });
});
