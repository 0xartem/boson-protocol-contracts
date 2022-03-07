// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "../domain/BosonTypes.sol";

/**
 * @title IBosonConfigHandler
 *
 * @notice Handles management of various protocol-related settings.
 *
 * The ERC-165 identifier for this interface is: 0x1753a1ce
 */
interface IBosonConfigHandler {

    /// Events
    event VoucherAddressChanged(address indexed voucher);
    event TokenAddressChanged(address indexed tokenAddress);
    event MultisigAddressChanged(address indexed multisigAddress);
    event FeePercentageChanged(uint16 indexed feePercentage);

    /**
     * @notice Sets the address of the Boson Token (ERC-20) contract.
     *
     * Emits a TokenAddressChanged event.
     *
     * @param _token - the address of the token contract
     */
    function setTokenAddress(address payable _token)
    external;

    /**
     * @notice The tokenAddress getter
     */
    function getTokenAddress()
    external
    view
    returns (address payable);

    /**
     * @notice Sets the address of the Boson Protocol multi-sig wallet.
     *
     * Emits a MultisigAddressChanged event.
     *
     * @param _multisigAddress - the address of the multi-sig wallet
     */
    function setMultisigAddress(address payable _multisigAddress)
    external;

    /**
     * @notice The multisigAddress getter
     */
    function getMultisigAddress()
    external
    view
    returns (address payable);

    /**
     * @notice Sets the address of the Voucher NFT address (proxy)
     *
     * Emits a VoucherAddressChanged event.
     *
     * @param _voucher - the address of the nft contract
     */
    function setVoucherAddress(address _voucher)
    external;

    /**
     * @notice The Voucher address getter
     */
    function getVoucherAddress()
    external
    view
    returns (address);

    /**
     * @notice Sets the protocol fee percentage.
     *
     * Emits a FeePercentageChanged event.
     *
     * @param _feePercentage - the percentage that will be taken as a fee from the net of a Boson Protocol exchange
     */
    function setFeePercentage(uint16 _feePercentage)
    external;

    /**
     * @notice The feePercentage getter
     */
    function getFeePercentage()
    external
    view
    returns (uint16);

}