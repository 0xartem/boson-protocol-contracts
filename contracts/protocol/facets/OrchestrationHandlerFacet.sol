// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

import "../../domain/BosonConstants.sol";
import { IBosonOrchestrationHandler } from "../../interfaces/handlers/IBosonOrchestrationHandler.sol";
import { DiamondLib } from "../../diamond/DiamondLib.sol";
import { SellerBase } from "../bases/SellerBase.sol";
import { GroupBase } from "../bases/GroupBase.sol";
import { OfferBase } from "../bases/OfferBase.sol";
import { TwinBase } from "../bases/TwinBase.sol";
import { BundleBase } from "../bases/BundleBase.sol";
import { PausableBase } from "../bases/PausableBase.sol";

/**
 * @title OrchestrationHandlerFacet
 *
 * @notice Combines creation of multiple entities (accounts, offers, groups, twins, bundles) in a single transaction.
 */
contract OrchestrationHandlerFacet is
    PausableBase,
    SellerBase,
    OfferBase,
    GroupBase,
    TwinBase,
    BundleBase,
    IBosonOrchestrationHandler
{
    /**
     * @notice Initializes facet.
     * This function is callable only once.
     */
    function initialize() public onlyUnInitialized(type(IBosonOrchestrationHandler).interfaceId) {
        DiamondLib.addSupportedInterface(type(IBosonOrchestrationHandler).interfaceId);
    }

    /**
     * @notice Creates a seller (with optional auth token) and an offer in a single transaction.
     *
     * Limitation of the method:
     * If chosen dispute resolver has seller allow list, this method will not succeed, since seller that will be created
     * cannot be on that list. To avoid the failure you can
     * - Choose a dispute resolver without seller allow list
     * - Make an absolute zero offer without and dispute resolver specified
     * - First create a seller {AccountHandler.createSeller}, make sure that dispute resolver adds seller to its allow list
     *   and then continue with the offer creation
     *
     * Emits a SellerCreated and an OfferCreated event if successful.
     *
     * Reverts if:
     * - The sellers region of protocol is paused
     * - The offers region of protocol is paused
     * - The orchestration region of protocol is paused
     * - Caller is not the supplied operator and clerk
     * - Caller is not the supplied admin or does not own supplied auth token
     * - Admin address is zero address and AuthTokenType == None
     * - AuthTokenType is not unique to this seller
     * - In seller struct:
     *   - Address values are zero address
     *   - Addresses are not unique to this seller
     *   - Seller is not active (if active == false)
     * - In offer struct:
     *   - Valid from date is greater than valid until date
     *   - Valid until date is not in the future
     *   - Both voucher expiration date and voucher expiration period are defined
     *   - Neither voucher expiration date nor voucher expiration period are defined
     *   - Voucher redeemable period is fixed, but it ends before it starts
     *   - Voucher redeemable period is fixed, but it ends before offer expires
     *   - Dispute period is less than minimum dispute period
     *   - Resolution period is set to zero or above the maximum resolution period
     *   - Voided is set to true
     *   - Available quantity is set to zero
     *   - Dispute resolver wallet is not registered, except for absolute zero offers with unspecified dispute resolver
     *   - Dispute resolver is not active, except for absolute zero offers with unspecified dispute resolver
     *   - Seller is not on dispute resolver's seller allow list
     *   - Dispute resolver does not accept fees in the exchange token
     *   - Buyer cancel penalty is greater than price
     * - When agent id is non zero:
     *   - If Agent does not exist
     *   - If the sum of agent fee amount and protocol fee amount is greater than the offer fee limit
     *
     * @param _offer - the fully populated struct with offer id set to 0x0 and voided set to false
     * @param _seller - the fully populated seller struct
     * @param _offerDates - the fully populated offer dates struct
     * @param _offerDurations - the fully populated offer durations struct
     * @param _disputeResolverId - the id of chosen dispute resolver (can be 0)
     * @param _authToken - optional AuthToken struct that specifies an AuthToken type and tokenId that the seller can use to do admin functions
     * @param _voucherInitValues - the fully populated BosonTypes.VoucherInitValues struct
     * @param _agentId - the id of agent
     */
    function createSellerAndOffer(
        Seller memory _seller,
        Offer memory _offer,
        OfferDates calldata _offerDates,
        OfferDurations calldata _offerDurations,
        uint256 _disputeResolverId,
        AuthToken calldata _authToken,
        VoucherInitValues calldata _voucherInitValues,
        uint256 _agentId
    ) external override sellersNotPaused offersNotPaused orchestrationNotPaused nonReentrant {
        createSellerInternal(_seller, _authToken, _voucherInitValues);
        createOfferInternal(_offer, _offerDates, _offerDurations, _disputeResolverId, _agentId);
    }

    /**
     * @notice Takes an offer and a condition, creates an offer, then creates a group with that offer and the given condition.
     *
     * Emits an OfferCreated and a GroupCreated event if successful.
     *
     * Reverts if:
     * - The offers region of protocol is paused
     * - The groups region of protocol is paused
     * - The orchestration region of protocol is paused
     * - In offer struct:
     *   - Caller is not an operator
     *   - Valid from date is greater than valid until date
     *   - Valid until date is not in the future
     *   - Both voucher expiration date and voucher expiration period are defined
     *   - Neither voucher expiration date nor voucher expiration period are defined
     *   - Voucher redeemable period is fixed, but it ends before it starts
     *   - Voucher redeemable period is fixed, but it ends before offer expires
     *   - Dispute period is less than minimum dispute period
     *   - Resolution period is set to zero or above the maximum resolution period
     *   - Voided is set to true
     *   - Available quantity is set to zero
     *   - Dispute resolver wallet is not registered, except for absolute zero offers with unspecified dispute resolver
     *   - Dispute resolver is not active, except for absolute zero offers with unspecified dispute resolver
     *   - Seller is not on dispute resolver's seller allow list
     *   - Dispute resolver does not accept fees in the exchange token
     *   - Buyer cancel penalty is greater than price
     * - Condition includes invalid combination of parameters
     * - When agent id is non zero:
     *   - If Agent does not exist
     *   - If the sum of agent fee amount and protocol fee amount is greater than the offer fee limit
     *
     * @param _offer - the fully populated struct with offer id set to 0x0 and voided set to false
     * @param _offerDates - the fully populated offer dates struct
     * @param _offerDurations - the fully populated offer durations struct
     * @param _disputeResolverId - the id of chosen dispute resolver (can be 0)
     * @param _condition - the fully populated condition struct
     * @param _agentId - the id of agent
     */
    function createOfferWithCondition(
        Offer memory _offer,
        OfferDates calldata _offerDates,
        OfferDurations calldata _offerDurations,
        uint256 _disputeResolverId,
        Condition calldata _condition,
        uint256 _agentId
    ) public override offersNotPaused groupsNotPaused orchestrationNotPaused nonReentrant {
        // Create offer and update structs values to represent true state
        createOfferInternal(_offer, _offerDates, _offerDurations, _disputeResolverId, _agentId);

        // Construct new group
        // - group id is 0, and it is ignored
        // - note that _offer fields are updated during createOfferInternal, so they represent correct values
        Group memory _group;
        _group.sellerId = _offer.sellerId;
        _group.offerIds = new uint256[](1);
        _group.offerIds[0] = _offer.id;

        // Create group and update structs values to represent true state
        createGroupInternal(_group, _condition);
    }

    /**
     * @notice Takes an offer and group ID, creates an offer and adds it to the existing group with given id.
     *
     * Emits an OfferCreated and a GroupUpdated event if successful.
     *
     * Reverts if:
     * - The offers region of protocol is paused
     * - The groups region of protocol is paused
     * - The orchestration region of protocol is paused
     * - In offer struct:
     *   - Caller is not an operator
     *   - Valid from date is greater than valid until date
     *   - Valid until date is not in the future
     *   - Both voucher expiration date and voucher expiration period are defined
     *   - Neither voucher expiration date nor voucher expiration period are defined
     *   - Voucher redeemable period is fixed, but it ends before it starts
     *   - Voucher redeemable period is fixed, but it ends before offer expires
     *   - Dispute period is less than minimum dispute period
     *   - Resolution period is set to zero or above the maximum resolution period
     *   - Voided is set to true
     *   - Available quantity is set to zero
     *   - Dispute resolver wallet is not registered, except for absolute zero offers with unspecified dispute resolver
     *   - Dispute resolver is not active, except for absolute zero offers with unspecified dispute resolver
     *   - Seller is not on dispute resolver's seller allow list
     *   - Dispute resolver does not accept fees in the exchange token
     *   - Buyer cancel penalty is greater than price
     * - When adding to the group if:
     *   - Group does not exists
     *   - Caller is not the operator of the group
     *   - Current number of offers plus number of offers added exceeds maximum allowed number per group
     * - When agent id is non zero:
     *   - If Agent does not exist
     *   - If the sum of agent fee amount and protocol fee amount is greater than the offer fee limit
     *
     * @param _offer - the fully populated struct with offer id set to 0x0 and voided set to false
     * @param _offerDates - the fully populated offer dates struct
     * @param _offerDurations - the fully populated offer durations struct
     * @param _disputeResolverId - the id of chosen dispute resolver (can be 0)
     * @param _groupId - id of the group, to which offer will be added
     * @param _agentId - the id of agent
     */
    function createOfferAddToGroup(
        Offer memory _offer,
        OfferDates calldata _offerDates,
        OfferDurations calldata _offerDurations,
        uint256 _disputeResolverId,
        uint256 _groupId,
        uint256 _agentId
    ) external override offersNotPaused groupsNotPaused orchestrationNotPaused nonReentrant {
        // Create offer and update structs values to represent true state
        createOfferInternal(_offer, _offerDates, _offerDurations, _disputeResolverId, _agentId);

        // Create an array with offer ids and add it to the group
        uint256[] memory _offerIds = new uint256[](1);
        _offerIds[0] = _offer.id;
        addOffersToGroupInternal(_groupId, _offerIds);
    }

    /**
     * @notice Takes an offer and a twin, creates an offer, creates a twin, then creates a bundle with that offer and the given twin.
     *
     * Emits an OfferCreated, a TwinCreated and a BundleCreated event if successful.
     *
     * Reverts if:
     * - The offers region of protocol is paused
     * - The twins region of protocol is paused
     * - The bundles region of protocol is paused
     * - The orchestration region of protocol is paused
     * - In offer struct:
     *   - Caller is not an operator
     *   - Valid from date is greater than valid until date
     *   - Valid until date is not in the future
     *   - Both voucher expiration date and voucher expiration period are defined
     *   - Neither voucher expiration date nor voucher expiration period are defined
     *   - Voucher redeemable period is fixed, but it ends before it starts
     *   - Voucher redeemable period is fixed, but it ends before offer expires
     *   - Dispute period is less than minimum dispute period
     *   - Resolution period is set to zero or above the maximum resolution period
     *   - Voided is set to true
     *   - Available quantity is set to zero
     *   - Dispute resolver wallet is not registered, except for absolute zero offers with unspecified dispute resolver
     *   - Dispute resolver is not active, except for absolute zero offers with unspecified dispute resolver
     *   - Seller is not on dispute resolver's seller allow list
     *   - Dispute resolver does not accept fees in the exchange token
     *   - Buyer cancel penalty is greater than price
     * - When creating twin if
     *   - Not approved to transfer the seller's token
     *   - SupplyAvailable is zero
     *   - Twin is NonFungibleToken and amount was set
     *   - Twin is NonFungibleToken and end of range would overflow
     *   - Twin is NonFungibleToken with unlimited supply and starting token id is too high
     *   - Twin is NonFungibleToken and range is already being used in another twin of the seller
     *   - Twin is FungibleToken or MultiToken and amount was not set
     * - When agent id is non zero:
     *   - If Agent does not exist
     *   - If the sum of agent fee amount and protocol fee amount is greater than the offer fee limit
     *
     * @param _offer - the fully populated struct with offer id set to 0x0 and voided set to false
     * @param _offerDates - the fully populated offer dates struct
     * @param _offerDurations - the fully populated offer durations struct
     * @param _disputeResolverId - the id of chosen dispute resolver (can be 0)
     * @param _twin - the fully populated twin struct
     * @param _agentId - the id of agent
     */
    function createOfferAndTwinWithBundle(
        Offer memory _offer,
        OfferDates calldata _offerDates,
        OfferDurations calldata _offerDurations,
        uint256 _disputeResolverId,
        Twin memory _twin,
        uint256 _agentId
    ) public override offersNotPaused twinsNotPaused bundlesNotPaused orchestrationNotPaused nonReentrant {
        // Create offer and update structs values to represent true state
        createOfferInternal(_offer, _offerDates, _offerDurations, _disputeResolverId, _agentId);

        // Create twin and pack everything into a bundle
        createTwinAndBundleAfterOffer(_twin, _offer.id, _offer.sellerId);
    }

    /**
     * @notice Takes an offer, a condition and a twin, creates an offer, then creates a group with that offer and the given condition.
     * It then creates a twin, then creates a bundle with that offer and the given twin.
     *
     * Emits an OfferCreated, a GroupCreated, a TwinCreated and a BundleCreated event if successful.
     *
     * Reverts if:
     * - The offers region of protocol is paused
     * - The groups region of protocol is paused
     * - The twins region of protocol is paused
     * - The bundles region of protocol is paused
     * - The orchestration region of protocol is paused
     * - In offer struct:
     *   - Caller is not an operator
     *   - Valid from date is greater than valid until date
     *   - Valid until date is not in the future
     *   - Both voucher expiration date and voucher expiration period are defined
     *   - Neither voucher expiration date nor voucher expiration period are defined
     *   - Voucher redeemable period is fixed, but it ends before it starts
     *   - Voucher redeemable period is fixed, but it ends before offer expires
     *   - Dispute period is less than minimum dispute period
     *   - Resolution period is set to zero or above the maximum resolution period
     *   - Voided is set to true
     *   - Available quantity is set to zero
     *   - Dispute resolver wallet is not registered, except for absolute zero offers with unspecified dispute resolver
     *   - Dispute resolver is not active, except for absolute zero offers with unspecified dispute resolver
     *   - Seller is not on dispute resolver's seller allow list
     *   - Dispute resolver does not accept fees in the exchange token
     *   - Buyer cancel penalty is greater than price
     * - Condition includes invalid combination of parameters
     * - When creating twin if
     *   - Not approved to transfer the seller's token
     *   - SupplyAvailable is zero
     *   - Twin is NonFungibleToken and amount was set
     *   - Twin is NonFungibleToken and end of range would overflow
     *   - Twin is NonFungibleToken with unlimited supply and starting token id is too high
     *   - Twin is NonFungibleToken and range is already being used in another twin of the seller
     *   - Twin is FungibleToken or MultiToken and amount was not set
     * - When agent id is non zero:
     *   - If Agent does not exist
     *   - If the sum of agent fee amount and protocol fee amount is greater than the offer fee limit
     *
     * @dev No reentrancy guard here since already implemented by called functions. If added here, they would clash.
     *
     * @param _offer - the fully populated struct with offer id set to 0x0 and voided set to false
     * @param _offerDates - the fully populated offer dates struct
     * @param _offerDurations - the fully populated offer durations struct
     * @param _disputeResolverId - the id of chosen dispute resolver (can be 0)
     * @param _condition - the fully populated condition struct
     * @param _twin - the fully populated twin struct
     * @param _agentId - the id of agent
     */
    function createOfferWithConditionAndTwinAndBundle(
        Offer memory _offer,
        OfferDates calldata _offerDates,
        OfferDurations calldata _offerDurations,
        uint256 _disputeResolverId,
        Condition calldata _condition,
        Twin memory _twin,
        uint256 _agentId
    ) public override twinsNotPaused bundlesNotPaused {
        // Create offer with condition first
        createOfferWithCondition(_offer, _offerDates, _offerDurations, _disputeResolverId, _condition, _agentId);
        // Create twin and pack everything into a bundle
        createTwinAndBundleAfterOffer(_twin, _offer.id, _offer.sellerId);
    }

    /**
     * @notice Takes a seller, an offer, a condition and an optional auth token. Creates a seller, creates an offer,
     * then creates a group with that offer and the given condition.
     *
     * Limitation of the method:
     * If chosen dispute resolver has seller allow list, this method will not succeed, since seller that will be created
     * cannot be on that list. To avoid the failure you can
     * - Choose a dispute resolver without seller allow list
     * - Make an absolute zero offer without and dispute resolver specified
     * - First create a seller {AccountHandler.createSeller}, make sure that dispute resolver adds seller to its allow list
     *   and then continue with the offer creation
     *
     * Emits a SellerCreated, an OfferCreated and a GroupCreated event if successful.
     *
     * Reverts if:
     * - The sellers region of protocol is paused
     * - The offers region of protocol is paused
     * - The groups region of protocol is paused
     * - The orchestration region of protocol is paused
     * - Caller is not the supplied operator and clerk
     * - Caller is not the supplied admin or does not own supplied auth token
     * - Admin address is zero address and AuthTokenType == None
     * - AuthTokenType is not unique to this seller
     * - In seller struct:
     *   - Address values are zero address
     *   - Addresses are not unique to this seller
     *   - Seller is not active (if active == false)
     * - In offer struct:
     *   - Caller is not an operator
     *   - Valid from date is greater than valid until date
     *   - Valid until date is not in the future
     *   - Both voucher expiration date and voucher expiration period are defined
     *   - Neither voucher expiration date nor voucher expiration period are defined
     *   - Voucher redeemable period is fixed, but it ends before it starts
     *   - Voucher redeemable period is fixed, but it ends before offer expires
     *   - Dispute period is less than minimum dispute period
     *   - Resolution period is set to zero or above the maximum resolution period
     *   - Voided is set to true
     *   - Available quantity is set to zero
     *   - Dispute resolver wallet is not registered, except for absolute zero offers with unspecified dispute resolver
     *   - Dispute resolver is not active, except for absolute zero offers with unspecified dispute resolver
     *   - Seller is not on dispute resolver's seller allow list
     *   - Dispute resolver does not accept fees in the exchange token
     *   - Buyer cancel penalty is greater than price
     * - Condition includes invalid combination of parameters
     * - When agent id is non zero:
     *   - If Agent does not exist
     *   - If the sum of agent fee amount and protocol fee amount is greater than the offer fee limit
     *
     * @dev No reentrancy guard here since already implemented by called functions. If added here, they would clash.
     *
     * @param _seller - the fully populated seller struct
     * @param _offer - the fully populated struct with offer id set to 0x0 and voided set to false
     * @param _offerDates - the fully populated offer dates struct
     * @param _offerDurations - the fully populated offer durations struct
     * @param _disputeResolverId - the id of chosen dispute resolver (can be 0)
     * @param _condition - the fully populated condition struct
     * @param _authToken - optional AuthToken struct that specifies an AuthToken type and tokenId that the seller can use to do admin functions
     * @param _voucherInitValues - the fully populated BosonTypes.VoucherInitValues struct
     * @param _agentId - the id of agent
     */
    function createSellerAndOfferWithCondition(
        Seller memory _seller,
        Offer memory _offer,
        OfferDates calldata _offerDates,
        OfferDurations calldata _offerDurations,
        uint256 _disputeResolverId,
        Condition calldata _condition,
        AuthToken calldata _authToken,
        VoucherInitValues calldata _voucherInitValues,
        uint256 _agentId
    ) external override sellersNotPaused {
        createSellerInternal(_seller, _authToken, _voucherInitValues);
        createOfferWithCondition(_offer, _offerDates, _offerDurations, _disputeResolverId, _condition, _agentId);
    }

    /**
     * @notice Takes a seller, an offer, a twin, and an optional auth token. Creates a seller, creates an offer, creates a twin,
     * then creates a bundle with that offer and the given twin.
     *
     * Limitation of the method:
     * If chosen dispute resolver has seller allow list, this method will not succeed, since seller that will be created
     * cannot be on that list. To avoid the failure you can
     * - Choose a dispute resolver without seller allow list
     * - Make an absolute zero offer without and dispute resolver specified
     * - First create a seller {AccountHandler.createSeller}, make sure that dispute resolver adds seller to its allow list
     *   and then continue with the offer creation
     *
     * Emits a SellerCreated, an OfferCreated, a TwinCreated and a BundleCreated event if successful.
     *
     * Reverts if:
     * - The sellers region of protocol is paused
     * - The offers region of protocol is paused
     * - The twins region of protocol is paused
     * - The bundles region of protocol is paused
     * - The orchestration region of protocol is paused
     * - Caller is not the supplied operator and clerk
     * - Caller is not the supplied admin or does not own supplied auth token
     * - Admin address is zero address and AuthTokenType == None
     * - AuthTokenType is not unique to this seller
     * - In seller struct:
     *   - Address values are zero address
     *   - Addresses are not unique to this seller
     *   - Seller is not active (if active == false)
     * - In offer struct:
     *   - Caller is not an operator
     *   - Valid from date is greater than valid until date
     *   - Valid until date is not in the future
     *   - Both voucher expiration date and voucher expiration period are defined
     *   - Neither voucher expiration date nor voucher expiration period are defined
     *   - Voucher redeemable period is fixed, but it ends before it starts
     *   - Voucher redeemable period is fixed, but it ends before offer expires
     *   - Dispute period is less than minimum dispute period
     *   - Resolution period is set to zero or above the maximum resolution period
     *   - Voided is set to true
     *   - Available quantity is set to zero
     *   - Dispute resolver wallet is not registered, except for absolute zero offers with unspecified dispute resolver
     *   - Dispute resolver is not active, except for absolute zero offers with unspecified dispute resolver
     *   - Seller is not on dispute resolver's seller allow list
     *   - Dispute resolver does not accept fees in the exchange token
     *   - Buyer cancel penalty is greater than price
     * - When creating twin if
     *   - Not approved to transfer the seller's token
     *   - SupplyAvailable is zero
     *   - Twin is NonFungibleToken and amount was set
     *   - Twin is NonFungibleToken and end of range would overflow
     *   - Twin is NonFungibleToken with unlimited supply and starting token id is too high
     *   - Twin is NonFungibleToken and range is already being used in another twin of the seller
     *   - Twin is FungibleToken or MultiToken and amount was not set
     * - When agent id is non zero:
     *   - If Agent does not exist
     *   - If the sum of agent fee amount and protocol fee amount is greater than the offer fee limit
     *
     * @dev No reentrancy guard here since already implemented by called functions. If added here, they would clash.
     *
     * @param _seller - the fully populated seller struct
     * @param _offer - the fully populated struct with offer id set to 0x0 and voided set to false
     * @param _offerDates - the fully populated offer dates struct
     * @param _offerDurations - the fully populated offer durations struct
     * @param _disputeResolverId - the id of chosen dispute resolver (can be 0)
     * @param _twin - the fully populated twin struct
     * @param _authToken - optional AuthToken struct that specifies an AuthToken type and tokenId that the seller can use to do admin functions
     * @param _voucherInitValues - the fully populated BosonTypes.VoucherInitValues struct
     * @param _agentId - the id of agent
     */
    function createSellerAndOfferAndTwinWithBundle(
        Seller memory _seller,
        Offer memory _offer,
        OfferDates calldata _offerDates,
        OfferDurations calldata _offerDurations,
        uint256 _disputeResolverId,
        Twin memory _twin,
        AuthToken calldata _authToken,
        VoucherInitValues calldata _voucherInitValues,
        uint256 _agentId
    ) external override sellersNotPaused {
        createSellerInternal(_seller, _authToken, _voucherInitValues);
        createOfferAndTwinWithBundle(_offer, _offerDates, _offerDurations, _disputeResolverId, _twin, _agentId);
    }

    /**
     * @notice Takes a seller, an offer, a condition and a twin, and an optional auth token. Creates a seller an offer,
     * then creates a group with that offer and the given condition. It then creates a twin and a bundle with that offer and the given twin.
     *
     * Limitation of the method:
     * If chosen dispute resolver has seller allow list, this method will not succeed, since seller that will be created
     * cannot be on that list. To avoid the failure you can
     * - Choose a dispute resolver without seller allow list
     * - Make an absolute zero offer without and dispute resolver specified
     * - First create a seller {AccountHandler.createSeller}, make sure that dispute resolver adds seller to its allow list
     *   and then continue with the offer creation
     *
     * Emits an SellerCreated, OfferCreated, a GroupCreated, a TwinCreated and a BundleCreated event if successful.
     *
     * Reverts if:
     * - The sellers region of protocol is paused
     * - The offers region of protocol is paused
     * - The groups region of protocol is paused
     * - The twins region of protocol is paused
     * - The bundles region of protocol is paused
     * - The orchestration region of protocol is paused
     * - Caller is not the supplied operator and clerk
     * - Caller is not the supplied admin or does not own supplied auth token
     * - Admin address is zero address and AuthTokenType == None
     * - AuthTokenType is not unique to this seller
     * - In seller struct:
     *   - Address values are zero address
     *   - Addresses are not unique to this seller
     *   - Seller is not active (if active == false)
     * - In offer struct:
     *   - Caller is not an operator
     *   - Valid from date is greater than valid until date
     *   - Valid until date is not in the future
     *   - Both voucher expiration date and voucher expiration period are defined
     *   - Neither voucher expiration date nor voucher expiration period are defined
     *   - Voucher redeemable period is fixed, but it ends before it starts
     *   - Voucher redeemable period is fixed, but it ends before offer expires
     *   - Dispute period is less than minimum dispute period
     *   - Resolution period is set to zero or above the maximum resolution period
     *   - Voided is set to true
     *   - Available quantity is set to zero
     *   - Dispute resolver wallet is not registered, except for absolute zero offers with unspecified dispute resolver
     *   - Dispute resolver is not active, except for absolute zero offers with unspecified dispute resolver
     *   - Seller is not on dispute resolver's seller allow list
     *   - Dispute resolver does not accept fees in the exchange token
     *   - Buyer cancel penalty is greater than price
     * - Condition includes invalid combination of parameters
     * - When creating twin if
     *   - Not approved to transfer the seller's token
     *   - SupplyAvailable is zero
     *   - Twin is NonFungibleToken and amount was set
     *   - Twin is NonFungibleToken and end of range would overflow
     *   - Twin is NonFungibleToken with unlimited supply and starting token id is too high
     *   - Twin is NonFungibleToken and range is already being used in another twin of the seller
     *   - Twin is FungibleToken or MultiToken and amount was not set
     * - When agent id is non zero:
     *   - If Agent does not exist
     *   - If the sum of agent fee amount and protocol fee amount is greater than the offer fee limit
     *
     * @dev No reentrancy guard here since already implemented by called functions. If added here, they would clash.
     *
     * @param _seller - the fully populated seller struct
     * @param _offer - the fully populated struct with offer id set to 0x0 and voided set to false
     * @param _offerDates - the fully populated offer dates struct
     * @param _offerDurations - the fully populated offer durations struct
     * @param _disputeResolverId - the id of chosen dispute resolver (can be 0)
     * @param _condition - the fully populated condition struct
     * @param _twin - the fully populated twin struct
     * @param _authToken - optional AuthToken struct that specifies an AuthToken type and tokenId that the seller can use to do admin functions
     * @param _voucherInitValues - the fully populated BosonTypes.VoucherInitValues struct
     * @param _agentId - the id of agent
     */
    function createSellerAndOfferWithConditionAndTwinAndBundle(
        Seller memory _seller,
        Offer memory _offer,
        OfferDates calldata _offerDates,
        OfferDurations calldata _offerDurations,
        uint256 _disputeResolverId,
        Condition calldata _condition,
        Twin memory _twin,
        AuthToken calldata _authToken,
        VoucherInitValues calldata _voucherInitValues,
        uint256 _agentId
    ) external override sellersNotPaused {
        createSellerInternal(_seller, _authToken, _voucherInitValues);
        createOfferWithConditionAndTwinAndBundle(
            _offer,
            _offerDates,
            _offerDurations,
            _disputeResolverId,
            _condition,
            _twin,
            _agentId
        );
    }

    /**
     * @notice Takes a twin, an offerId and a sellerId. Creates a twin, then creates a bundle with that offer and the given twin.
     *
     * Emits a TwinCreated and a BundleCreated event if successful.
     *
     * Reverts if:
     * - Condition includes invalid combination of parameters
     * - When creating twin if
     *   - Not approved to transfer the seller's token
     *   - SupplyAvailable is zero
     *   - Twin is NonFungibleToken and amount was set
     *   - Twin is NonFungibleToken and end of range would overflow
     *   - Twin is NonFungibleToken with unlimited supply and starting token id is too high
     *   - Twin is NonFungibleToken and range is already being used in another twin of the seller
     *   - Twin is FungibleToken or MultiToken and amount was not set
     *
     * @param _twin - the fully populated twin struct
     * @param _offerId - offerid, obtained in previous steps
     * @param _sellerId - sellerId, obtained in previous steps
     */
    function createTwinAndBundleAfterOffer(
        Twin memory _twin,
        uint256 _offerId,
        uint256 _sellerId
    ) internal {
        // Create twin and update structs values to represent true state
        createTwinInternal(_twin);

        // Construct new bundle
        // - bundle id is 0, and it is ignored
        // - note that _twin fields are updated during createTwinInternal, so they represent correct values
        Bundle memory _bundle;
        _bundle.sellerId = _sellerId;
        _bundle.offerIds = new uint256[](1);
        _bundle.offerIds[0] = _offerId;
        _bundle.twinIds = new uint256[](1);
        _bundle.twinIds[0] = _twin.id;

        // create bundle and update structs values to represent true state
        createBundleInternal(_bundle);
    }
}
