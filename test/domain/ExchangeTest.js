const { expect } = require("chai");
const Exchange = require("../../scripts/domain/Exchange");

/**
 *  Test the Exchange domain entity
 */
describe("Exchange", function() {

    // Suite-wide scope
    let exchange, object, promoted, clone, dehydrated, rehydrated, key, value;
    let id, offerId

    context("📋 Constructor", async function () {

        beforeEach( async function () {

            // Required constructor params
            id = "50";
            offerId = "2112";

        });

        it("Should allow creation of valid, fully populated Exchange instance", async function () {

            exchange = new Exchange(id, offerId);
            expect(exchange.idIsValid()).is.true;
            expect(exchange.offerIdIsValid()).is.true;
            expect(exchange.isValid()).is.true;

        });

    });

    context("📋 Field validations", async function () {

        beforeEach( async function () {

            // Required constructor params
            id = "99";
            offerId = "5150";

            // Create a valid exchange, then set fields in tests directly
            exchange = new Exchange(id, offerId);
            expect(exchange.isValid()).is.true;
        });

        it("Always present, id must be the string representation of a BigNumber", async function() {

            // Invalid field value
            exchange.id = "zedzdeadbaby";
            expect(exchange.idIsValid()).is.false;
            expect(exchange.isValid()).is.false;

            // Invalid field value
            exchange.id = new Date();
            expect(exchange.idIsValid()).is.false;
            expect(exchange.isValid()).is.false;

            // Invalid field value
            exchange.id = 12;
            expect(exchange.idIsValid()).is.false;
            expect(exchange.isValid()).is.false;

            // Valid field value
            exchange.id = "0";
            expect(exchange.idIsValid()).is.true;
            expect(exchange.isValid()).is.true;

            // Valid field value
            exchange.id = "126";
            expect(exchange.idIsValid()).is.true;
            expect(exchange.isValid()).is.true;

        });

        it("Always present, offerId must be the string representation of a BigNumber", async function() {

            // Invalid field value
            exchange.offerId = "zedzdeadbaby";
            expect(exchange.offerIdIsValid()).is.false;
            expect(exchange.isValid()).is.false;

            // Invalid field value
            exchange.offerId = new Date();
            expect(exchange.offerIdIsValid()).is.false;
            expect(exchange.isValid()).is.false;

            // Invalid field value
            exchange.offerId = 12;
            expect(exchange.offerIdIsValid()).is.false;
            expect(exchange.isValid()).is.false;

            // Valid field value
            exchange.offerId = "0";
            expect(exchange.offerIdIsValid()).is.true;
            expect(exchange.isValid()).is.true;

            // Valid field value
            exchange.offerId = "126";
            expect(exchange.offerIdIsValid()).is.true;
            expect(exchange.isValid()).is.true;

        });

    })

    context("📋 Utility functions", async function () {

        beforeEach( async function () {

            // Required constructor params
            id = "2";
            offerId = "90125";

            // Create a valid exchange, then set fields in tests directly
            exchange = new Exchange(id, offerId);
            expect(exchange.isValid()).is.true;

            // Get plain object
            object = {
                id,
                offerId
            }

        })

        context("👉 Static", async function () {

            it("Exchange.fromObject() should return a Exchange instance with the same values as the given plain object", async function () {

                // Promote to instance
                promoted = Exchange.fromObject(object);

                // Is a Exchange instance
                expect(promoted instanceof Exchange).is.true;

                // Key values all match
                for ([key, value] of Object.entries(exchange)) {
                    expect(JSON.stringify(promoted[key]) === JSON.stringify(value)).is.true;
                }

            });

        });

        context("👉 Instance", async function () {

            it("instance.toString() should return a JSON string representation of the Exchange instance", async function () {

                dehydrated = exchange.toString();
                rehydrated = JSON.parse(dehydrated);

                for ([key, value] of Object.entries(exchange)) {
                    expect(JSON.stringify(rehydrated[key]) === JSON.stringify(value)).is.true;
                }

            });

            it("instance.clone() should return another Exchange instance with the same property values", async function () {

                // Get plain object
                clone = exchange.clone();

                // Is an Exchange instance
                expect(clone instanceof Exchange).is.true;

                // Key values all match
                for ([key, value] of Object.entries(exchange)) {
                    expect(JSON.stringify(clone[key]) === JSON.stringify(value)).is.true;
                }

            });

            it("instance.toObject() should return a plain object representation of the Exchange instance", async function () {

                // Get plain object
                object = exchange.toObject();

                // Not an Exchange instance
                expect(object instanceof Exchange).is.false;

                // Key values all match
                for ([key, value] of Object.entries(exchange)) {
                    expect(JSON.stringify(object[key]) === JSON.stringify(value)).is.true;
                }

            });

        });

    });

});