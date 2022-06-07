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
            uint256 supplyAvailable; // ERC-1155 / ERC-20
            uint256[] supplyIds;     // ERC-721
            uint256 tokenId;         // ERC-1155
            address tokenAddress;    // all
            TokenType tokenType
        }
    */

  constructor(id, sellerId, supplyAvailable, supplyIds, tokenId, tokenAddress, tokenType) {
    this.id = id;
    this.sellerId = sellerId;
    this.supplyAvailable = supplyAvailable;
    this.supplyIds = supplyIds || [];
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
    const { id, sellerId, supplyAvailable, supplyIds, tokenId, tokenAddress, tokenType } = o;
    return new Twin(id, sellerId, supplyAvailable, supplyIds, tokenId, tokenAddress, tokenType);
  }

  /**
   * Get a new Twin instance from a returned struct representation
   * @param struct
   * @returns {*}
   */
  static fromStruct(struct) {
    let id, sellerId, supplyAvailable, supplyIds, tokenId, tokenAddress, tokenType;

    // destructure struct
    [id, sellerId, supplyAvailable, supplyIds, tokenId, tokenAddress, tokenType] = struct;

    return Twin.fromObject({
      id: id.toString(),
      sellerId: sellerId.toString(),
      supplyAvailable: supplyAvailable.toString(),
      supplyIds: supplyIds ? supplyIds.map((supplyId) => supplyId.toString()) : [],
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
    return [
      this.id,
      this.sellerId,
      this.supplyAvailable,
      this.supplyIds,
      this.tokenId,
      this.tokenAddress,
      this.tokenType,
    ];
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
   * Is this Twin instance's supplyAvailable field valid?
   * Must be a string representation of a big number
   * @returns {boolean}
   */
  supplyAvailableIsValid() {
    let valid = false;
    let { supplyAvailable } = this;
    try {
      valid = typeof supplyAvailable === "string" && typeof ethers.BigNumber.from(supplyAvailable) === "object";
    } catch (e) {}
    return valid;
  }

  /**
   * Is this Twin instance's supplyIds field valid?
   * Must be an array, and if members are present, they must be string representations of BigNumbers
   * @returns {boolean}
   */
  supplyIdsIsValid() {
    let valid = false;
    let { supplyIds } = this;
    let validateMembers = (ok, supplyId) =>
      ok && typeof supplyId === "string" && typeof ethers.BigNumber.from(supplyId) === "object";
    try {
      valid = Array.isArray(supplyIds) && (supplyIds.length === 0 || supplyIds.reduce(validateMembers, true));
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
      this.supplyAvailableIsValid() &&
      this.supplyIdsIsValid() &&
      this.tokenIdIsValid() &&
      this.tokenAddressIsValid() &&
      this.tokenTypeIsValid()
    );
  }
}

// Export
module.exports = Twin;
