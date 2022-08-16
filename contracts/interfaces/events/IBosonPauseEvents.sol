// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import { BosonTypes } from "../../domain/BosonTypes.sol";

/**
 * @title IBosonPauseEvents
 *
 * @notice Events related to pausing of the protocol
 */
interface IBosonPauseEvents {
    event ProtocolPaused(BosonTypes.PausableRegion[] regions, address executedBy);
    event ProtocolUnpaused(address executedBy);
}
