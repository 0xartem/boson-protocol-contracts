// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import { IBosonOfferHandler } from "../../interfaces/handlers/IBosonOfferHandler.sol";
import { DiamondLib } from "../../diamond/DiamondLib.sol";
import { OfferBase } from "../bases/OfferBase.sol";

/**
 * @title OfferHandlerFacet
 *
 * @notice Handles offers within the protocol
 */
contract OfferHandlerFacet is IBosonOfferHandler, OfferBase {
    /**
     * @notice Facet Initializer
     */
    function initialize() public onlyUnInitialized(type(IBosonOfferHandler).interfaceId) {
        DiamondLib.addSupportedInterface(type(IBosonOfferHandler).interfaceId);
    }

    /**
     * @notice Creates an offer.
     *
     * Emits an OfferCreated event if successful.
     *
     * Reverts if:
     * - Caller is not an operator
     * - Valid from date is greater than valid until date
     * - Valid until date is not in the future
     * - Both voucher expiration date and voucher expiraton period are defined
     * - Neither of voucher expiration date and voucher expiraton period are defined
     * - Voucher redeemable period is fixed, but it ends before it starts
     * - Voucher redeemable period is fixed, but it ends before offer expires
     * - Fulfillment period is set to zero
     * - Resolution period is set to zero
     * - Voided is set to true
     * - Available quantity is set to zero
     * - Dispute resolver wallet is not registered, except for absolute zero offers with unspecified dispute resolver
     * - Dispute resolver is not active, except for absolute zero offers with unspecified dispute resolver
     * - Dispute resolver does not accept fees in the exchange token
     * - Buyer cancel penalty is greater than price
     * - When agent id is non zero:
     *   - If Agent does not exist
     *   - If the sum of Agent fee amount and protocol fee amount is greater than the offer fee limit
     *
     * @param _offer - the fully populated struct with offer id set to 0x0 and voided set to false
     * @param _offerDates - the fully populated offer dates struct
     * @param _offerDurations - the fully populated offer durations struct
     * @param _disputeResolverId - the id of chosen dispute resolver (can be 0)
     * @param _agentId - the id of agent
     */
    function createOffer(
        Offer memory _offer,
        OfferDates calldata _offerDates,
        OfferDurations calldata _offerDurations,
        uint256 _disputeResolverId,
        uint256 _agentId
    ) external override {
        createOfferInternal(_offer, _offerDates, _offerDurations, _disputeResolverId, _agentId);
    }

    /**
     * @notice Creates a batch of offers.
     *
     * Emits an OfferCreated event for every offer if successful.
     *
     * Reverts if:
     * - Number of offers exceeds maximum allowed number per batch
     * - Number of elements in offers, offerDates and offerDurations do not match
     * - for any offer:
     *   - Caller is not an operator
     *   - Valid from date is greater than valid until date
     *   - Valid until date is not in the future
     *   - Both voucher expiration date and voucher expiraton period are defined
     *   - Neither of voucher expiration date and voucher expiraton period are defined
     *   - Voucher redeemable period is fixed, but it ends before it starts
     *   - Voucher redeemable period is fixed, but it ends before offer expires
     *   - Fulfillment period is set to zero
     *   - Resolution period is set to zero
     *   - Voided is set to true
     *   - Available quantity is set to zero
     *   - Dispute resolver wallet is not registered, except for absolute zero offers with unspecified dispute resolver with unspecified dispute resolver
     *   - Dispute resolver is not active, except for absolute zero offers with unspecified dispute resolver
     *   - Dispute resolver does not accept fees in the exchange token
     *   - Buyer cancel penalty is greater than price
     * - When agent ids are non zero:
     *   - If Agent does not exist
     *   - If the sum of Agent fee amount and protocol fee amount is greater than the offer fee limit
     *
     * @param _offers - the array of fully populated Offer structs with offer id set to 0x0 and voided set to false
     * @param _offerDates - the array of fully populated offer dates structs
     * @param _offerDurations - the array of fully populated offer durations structs
     * @param _disputeResolverIds - the array of ids of chosen dispute resolvers (can be 0)
     * @param _agentIds - the array of ids of agents
     */
    function createOfferBatch(
        Offer[] calldata _offers,
        OfferDates[] calldata _offerDates,
        OfferDurations[] calldata _offerDurations,
        uint256[] calldata _disputeResolverIds,
        uint256[] calldata _agentIds
    ) external override {
        // limit maximum number of offers to avoid running into block gas limit in a loop
        require(_offers.length <= protocolLimits().maxOffersPerBatch, TOO_MANY_OFFERS);
        // number of offer dates structs, offer durations structs and _disputeResolverIds must match the number of offers
        require(
            _offers.length == _offerDates.length &&
                _offers.length == _offerDurations.length &&
                _offers.length == _disputeResolverIds.length &&
                _offers.length == _agentIds.length,
            ARRAY_LENGTH_MISMATCH
        );

        for (uint256 i = 0; i < _offers.length; i++) {
            // create offer and update structs values to represent true state
            createOfferInternal(_offers[i], _offerDates[i], _offerDurations[i], _disputeResolverIds[i], _agentIds[i]);
        }
    }

    /**
     * @notice Voids a given offer.
     *
     * Emits an OfferVoided event if successful.
     *
     * Note:
     * Existing exchanges are not affected.
     * No further vouchers can be issued against a voided offer.
     *
     * Reverts if:
     * - Offer ID is invalid
     * - Caller is not the operator of the offer
     * - Offer has already been voided
     *
     * @param _offerId - the id of the offer to check
     */
    function voidOffer(uint256 _offerId) public override {
        // Get offer, make sure the caller is the operator
        Offer storage offer = getValidOffer(_offerId);

        // Void the offer
        offer.voided = true;

        // Notify listeners of state change
        emit OfferVoided(_offerId, offer.sellerId, msgSender());
    }

    /**
     * @notice  Voids a batch of offers.
     *
     * Emits an OfferVoided event for every offer if successful.
     *
     * Note:
     * Existing exchanges are not affected.
     * No further vouchers can be issued against a voided offer.
     *
     * Reverts if, for any offer:
     * - Number of offers exceeds maximum allowed number per batch
     * - Offer ID is invalid
     * - Caller is not the operator of the offer
     * - Offer has already been voided
     *
     * @param _offerIds - the id of the offer to check
     */
    function voidOfferBatch(uint256[] calldata _offerIds) external override {
        // limit maximum number of offers to avoid running into block gas limit in a loop
        require(_offerIds.length <= protocolLimits().maxOffersPerBatch, TOO_MANY_OFFERS);
        for (uint256 i = 0; i < _offerIds.length; i++) {
            voidOffer(_offerIds[i]);
        }
    }

    /**
     * @notice Sets new valid until date
     *
     * Emits an OfferExtended event if successful.
     *
     * Reverts if:
     * - Offer does not exist
     * - Caller is not the operator of the offer
     * - New valid until date is before existing valid until dates
     * - Offer has voucherRedeemableUntil set and new valid until date is greater than that
     *
     *  @param _offerId - the id of the offer to check
     *  @param _validUntilDate - new valid until date
     */
    function extendOffer(uint256 _offerId, uint256 _validUntilDate) public override {
        // Make sure the caller is the operator, offer exists and is not voided
        Offer storage offer = getValidOffer(_offerId);

        // Fetch the offer dates
        OfferDates storage offerDates = fetchOfferDates(_offerId);

        // New valid until date must be greater than existing one
        require(offerDates.validUntil < _validUntilDate, OFFER_PERIOD_INVALID);

        // If voucherRedeemableUntil is set, _validUntilDate must be less or equal than that
        if (offerDates.voucherRedeemableUntil > 0) {
            require(_validUntilDate <= offerDates.voucherRedeemableUntil, OFFER_PERIOD_INVALID);
        }

        // Update the valid until property
        offerDates.validUntil = _validUntilDate;

        // Notify watchers of state change
        emit OfferExtended(_offerId, offer.sellerId, _validUntilDate, msgSender());
    }

    /**
     * @notice Sets new valid until date
     *
     * Emits an OfferExtended event if successful.
     *
     * Reverts if:
     * - Number of offers exceeds maximum allowed number per batch
     * - For any of the offers:
     *   - Offer does not exist
     *   - Caller is not the operator of the offer
     *   - New valid until date is before existing valid until dates
     *   - Offer has voucherRedeemableUntil set and new valid until date is greater than that
     *
     *  @param _offerIds - list of ids of the offers to extemd
     *  @param _validUntilDate - new valid until date
     */
    function extendOfferBatch(uint256[] calldata _offerIds, uint256 _validUntilDate) external override {
        // limit maximum number of offers to avoid running into block gas limit in a loop
        require(_offerIds.length <= protocolLimits().maxOffersPerBatch, TOO_MANY_OFFERS);
        for (uint256 i = 0; i < _offerIds.length; i++) {
            extendOffer(_offerIds[i], _validUntilDate);
        }
    }

    /**
     * @notice Gets the details about a given offer.
     *
     * @param _offerId - the id of the offer to check
     * @return exists - the offer was found
     * @return offer - the offer details. See {BosonTypes.Offer}
     * @return offerDates - the offer dates details. See {BosonTypes.OfferDates}
     * @return offerDurations - the offer durations details. See {BosonTypes.OfferDurations}
     * @return disputeResolutionTerms - the details about the dispute resolution terms. See {BosonTypes.DisputeResolutionTerms}
     * @return offerFees - the offer fees details. See {BosonTypes.OfferFees}
     */
    function getOffer(uint256 _offerId)
        external
        view
        override
        returns (
            bool exists,
            Offer memory offer,
            OfferDates memory offerDates,
            OfferDurations memory offerDurations,
            DisputeResolutionTerms memory disputeResolutionTerms,
            OfferFees memory offerFees
        )
    {
        (exists, offer) = fetchOffer(_offerId);
        if (exists) {
            offerDates = fetchOfferDates(_offerId);
            offerDurations = fetchOfferDurations(_offerId);
            disputeResolutionTerms = fetchDisputeResolutionTerms(_offerId);
            offerFees = fetchOfferFees(_offerId);
        }
    }

    /**
     * @notice Gets the next offer id.
     *
     * Does not increment the counter.
     *
     * @return nextOfferId - the next offer id
     */
    function getNextOfferId() public view override returns (uint256 nextOfferId) {
        nextOfferId = protocolCounters().nextOfferId;
    }

    /**
     * @notice Tells if offer is voided or not
     *
     * @param _offerId - the id of the offer to check
     * @return exists - the offer was found
     * @return offerVoided - true if voided, false otherwise
     */
    function isOfferVoided(uint256 _offerId) public view override returns (bool exists, bool offerVoided) {
        Offer memory offer;
        (exists, offer) = fetchOffer(_offerId);
        offerVoided = offer.voided;
    }

    /**
     * @notice Gets the agent id for a given offer id.
     *
     * @param _offerId - the offer Id.
     * @return exists - whether the agent Id exists
     * @return agentId - the agent Id.
     */
    function getAgentIdByOffer(uint256 _offerId) external view override returns (bool exists, uint256 agentId) {
        return fetchAgentIdByOffer(_offerId);
    }
}
