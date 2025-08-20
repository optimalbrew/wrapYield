// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

/**
 * @dev This script is used to generate preimages and preimage hashes for borrowers and lenders
 * for use in HTLC contracts such as BtcCollateralLoan.sol and EtherSwap.sol
 * Each loan has a preimage selected by the borrower and one by the lender
 * 
 * Strangely, solidity "packed" encoding is not the same as python's packed.
 * instead, it is the same as python's strict.
 *
 * The corresponding python code is in misc/hasher.py
 * 
 * forge script script/preimageGenerator.sol
 * and 
 * python3 misc/hasher.py
 *
 */


import {Script, console2} from "../lib/forge-std/src/Script.sol";

contract PreimageGeneratorScript is Script {

    function hashBorrower(uint256 i) public pure returns (bytes32) {
        return sha256(abi.encodePacked("borrower", i));
    }

    function hashLender(uint256 i) public pure returns (bytes32) {
        return sha256(abi.encodePacked("lender", i));
    }

    function doubleHash(bytes32 hash) public pure returns (bytes32) {
        return sha256(abi.encodePacked(hash));
    }

    function run() public {
        vm.startBroadcast();

        for (uint256 i = 0; i <= 5; i++) {
            console2.log("=== Iteration i =", i, "===");
            
            // Borrower hashes
            bytes32 borrowerHash = hashBorrower(i);
            bytes32 borrowerDoubleHash = doubleHash(borrowerHash);
            console2.log("Borrower preimage:");
            console2.logBytes32(borrowerHash);
            console2.log("Borrower preimage hash:");
            console2.logBytes32(borrowerDoubleHash);
            
            // Lender hashes
            bytes32 lenderHash = hashLender(i);
            bytes32 lenderDoubleHash = doubleHash(lenderHash);
            console2.log("Lender preimage:");
            console2.logBytes32(lenderHash);
            console2.log("Lender preimage hash:");
            console2.logBytes32(lenderDoubleHash);
            console2.log("---");
        }

        vm.stopBroadcast();
    }
}

/**
 * Sample results:
 *  === Iteration i = 0 ===
  Borrower preimage:
  0x05e5cdc502cc641787db0383a01d4b6baec69b62b6dbf9d9d9600872bbbed741
  Borrower preimage hash:
  0x4534f8f303eb5fc7175946b1c46772fa31bca38f724c1a0be97b9b0289431ee1
  Lender preimage:
  0x38f9fa6b463f6e37f2cf7286f1f3bbf2e1fe33296f95629d9c343511f9bd35d5
  Lender preimage hash:
  0x646e58c6fbea3ac4750a2279d4b711fed954e3cb48319c630570e3143e4553e3
  ---
  === Iteration i = 1 ===
  Borrower preimage:
  0x51a1a48a303eac94c5db7948f45afd24bed8f1996123ad0b8c690941767fb7b9
  Borrower preimage hash:
  0x829ffe3be04973f31edf2e863d51eae635a66a2eafd560fc109e381ebc891d1f
  Lender preimage:
  0xc71b05891e060371963c100544a0d664942436175ab65773954e59428745cf3d
  Lender preimage hash:
  0x558faf2cc0da7f3ab3906cd341618413033e258f84d9ec792c880b6b9ae3446e
  ---
  === Iteration i = 2 ===
  Borrower preimage:
  0x3a5b245e72c11664e345472b0bbd7870af8dc1040d1a49693eee8f63779ec7fb
  Borrower preimage hash:
  0xe59bafe7950bac5fabbe1ab81cbd37843fd410baca12bf74a360a8cbdc8aea05
  Lender preimage:
  0x59c289740dda868e22ca3fb1f66ba6f42bb6a4aa99f05f062ac4f098b71d5c34
  Lender preimage hash:
  0x6b6fdc0ea086b12523653fd7e10a91ba18ecfc04185bf76289172e702d51c754
  ---
  === Iteration i = 3 ===
  Borrower preimage:
  0xe5f5c616adf2c59bde5a9fce5eca7aa5cd3c729d3ac762736b095504d84783d8
  Borrower preimage hash:
  0x076062d6cd5679fe4c3f849ab62cf7b311d8e52e0a31e66fd826b74355a3ee88
  Lender preimage:
  0xc3da67e7540306f8f6b4a049c61f94c36dac0f5c4a5b982cfdb9bcb359c5cfa8
  Lender preimage hash:
  0x5a07b440ef01bf562d5df47639b2c2023571b9a28a20e8f21ef10c6b8222bc17
  ---
  === Iteration i = 4 ===
  Borrower preimage:
  0xff415e8d9f7dee6c4c37b5395f3b23b751d61cfb8ad70a6b759701574d17a137
  Borrower preimage hash:
  0x22702ce74f52494dd099c70ee9e8690f69b4fd0ae0fc23cbe87bba0ab4f94df3
  Lender preimage:
  0x4f949257a44ff70576ef75ddb21fca28a0744690ae3c94bf1edfde011472e8d5
  Lender preimage hash:
  0x6f695d49d98ead9f78c1f0058ea87a597c82382e7f68d8fb3e7c7c6cd1213a3e
  ---
  === Iteration i = 5 ===
  Borrower preimage:
  0x279abb60f0d622f673aa7fa06c7fef1a797e4ac7b335b41f642abb75d0852fd4
  Borrower preimage hash:
  0xc6b356c4b0c2e93a8f9f7d8be4b5ece31dc4a07e709dc870cac260cbb27c3e82
  Lender preimage:
  0xf4354daf393696b19a316aaa852729df36126f93a63edb2b866a263cc8098cba
  Lender preimage hash:
  0xf4c8eaf690200fcc2a460076d2538399d76f49e0bc7840ed588579baf29dd4be
 */