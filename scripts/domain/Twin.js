const ethers = require("ethers");
const eip55 = require("eip55");
const TokenType = require("./TokenType");

/**
 * Boson Protocol Domain Entity: Twin
 *
 * See: {BosonTypes.Twin}
 */
class Twin {
  /*
        struct Twin {
            uint256 id;
            uint256 sellerId;
            uint256 amount; // ERC-1155 / ERC-20
            uint256 supplyAvailable; // ERC-721 (the last token id of the ERC-721 available range)
            uint256 tokenId; // ERC-1155 / ERC-721 (must be initialized with the initial pointer position of the ERC-721 ids available range)
            address tokenAddress;  // all
            TokenType tokenType
        }
    */

  constructor(id, sellerId, amount, supplyAvailable, tokenId, tokenAddress, tokenType) {
    this.id = id;
    this.sellerId = sellerId;
    this.amount = amount;
    this.supplyAvailable = supplyAvailable;
    this.tokenId = tokenId;
    this.tokenAddress = tokenAddress;
    this.tokenType = tokenType;
  }

  /**
   * Get a new Twin instance from a pojo representation
   * @param o
   * @returns {Twin}
   */
  static fromObject(o) {
    const { id, sellerId, amount, supplyAvailable, tokenId, tokenAddress, tokenType } = o;
    return new Twin(id, sellerId, amount, supplyAvailable, tokenId, tokenAddress, tokenType);
  }

  /**
   * Get a new Twin instance from a returned struct representation
   * @param struct
   * @returns {*}
   */
  static fromStruct(struct) {
    let id, sellerId, amount, supplyAvailable, tokenId, tokenAddress, tokenType;

    // destructure struct
    [id, sellerId, amount, supplyAvailable, tokenId, tokenAddress, tokenType] = struct;

    return Twin.fromObject({
      id: id.toString(),
      sellerId: sellerId.toString(),
      amount: amount.toString(),
      supplyAvailable: supplyAvailable ? supplyAvailable.toString() : "",
      tokenId: tokenId ? tokenId.toString() : "",
      tokenAddress,
      tokenType,
    });
  }

  /**
   * Get a database representation of this Twin instance
   * @returns {object}
   */
  toObject() {
    return JSON.parse(this.toString());
  }

  /**
   * Get a string representation of this Twin instance
   * @returns {string}
   */
  toString() {
    return JSON.stringify(this);
  }

  /**
   * Get a struct representation of this Twin instance
   * @returns {string}
   */
  toStruct() {
    return [this.id, this.sellerId, this.amount, this.supplyAvailable, this.tokenId, this.tokenAddress, this.tokenType];
  }

  /**
   * Clone this Twin
   * @returns {Twin}
   */
  clone() {
    return Twin.fromObject(this.toObject());
  }

  /**
   * Is this Twin instance's id field valid?
   * Must be a string representation of a big number
   * @returns {boolean}
   */
  idIsValid() {
    let valid = false;
    let { id } = this;
    try {
      valid = typeof id === "string" && typeof ethers.BigNumber.from(id) === "object";
    } catch (e) {}
    return valid;
  }

  /**
   * Is this Twin instance's sellerId field valid?
   * Must be a string representation of a big number
   * @returns {boolean}
   */
  sellerIdIsValid() {
    let valid = false;
    let { sellerId } = this;
    try {
      valid = typeof sellerId === "string" && typeof ethers.BigNumber.from(sellerId) === "object";
    } catch (e) {}
    return valid;
  }

  /**
   * Is this Twin instance's amount field valid?
   * Must be a string representation of a big number
   * @returns {boolean}
   */
  amountIsValid() {
    let valid = false;
    let { amount } = this;
    try {
      valid = typeof amount === "string" && typeof ethers.BigNumber.from(amount) === "object";
    } catch (e) {}
    return valid;
  }

  /**
   * Is this Twin instance's supplyAvailable field valid?
   * Must be an empty string or a string representation of a big number
   * @returns {boolean}
   */
  supplyAvailableIsValid() {
    let valid = false;
    let { supplyAvailable } = this;
    try {
      valid =
        typeof supplyAvailable === "string" &&
        (supplyAvailable === "" || typeof ethers.BigNumber.from(supplyAvailable) === "object");
    } catch (e) {}
    return valid;
  }

  /**
   * Is this Twin instance's tokenId field valid?
   * Must be an empty string or a string representation of a big number
   * @returns {boolean}
   */
  tokenIdIsValid() {
    let valid = false;
    let { tokenId } = this;
    try {
      valid = typeof tokenId === "string" && (tokenId === "" || typeof ethers.BigNumber.from(tokenId) === "object");
    } catch (e) {}
    return valid;
  }

  /**
   * Is this Twin instance's tokenAddress field valid?
   * Must be a eip55 compliant Ethereum address
   * @returns {boolean}
   */
  tokenAddressIsValid() {
    let valid = false;
    let { tokenAddress } = this;
    try {
      valid = eip55.verify(eip55.encode(tokenAddress));
    } catch (e) {}
    return valid;
  }

  /**
   * Is this Twin instance's tokenType field valid?
   * @returns {boolean}
   */
  tokenTypeIsValid() {
    let valid = false;
    let { tokenType } = this;
    try {
      valid = TokenType.Types.includes(tokenType);
    } catch (e) {}
    return valid;
  }

  /**
   * Is this Twin instance valid?
   * @returns {boolean}
   */
  isValid() {
    return (
      this.idIsValid() &&
      this.sellerIdIsValid() &&
      this.amountIsValid() &&
      this.supplyAvailableIsValid() &&
      this.tokenIdIsValid() &&
      this.tokenAddressIsValid() &&
      this.tokenTypeIsValid()
    );
  }
}

// Export
module.exports = Twin;
