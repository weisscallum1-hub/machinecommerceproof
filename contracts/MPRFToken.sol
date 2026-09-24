// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Capped} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";

/// @title Machine Commerce Proof Utility Token
/// @notice Fixed-supply utility-token prototype. No owner, no mint function,
/// and no admin controls. Deploy only after legal review.
contract MPRFToken is ERC20, ERC20Burnable, ERC20Capped {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 ether;

    constructor(address initialRecipient)
        ERC20("Machine Commerce Proof", "MPRF")
        ERC20Capped(MAX_SUPPLY)
    {
        require(initialRecipient != address(0), "recipient=0");
        _mint(initialRecipient, MAX_SUPPLY);
    }

    // ERC20Capped requires _update to enforce the cap.
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Capped)
    {
        super._update(from, to, value);
    }
}
