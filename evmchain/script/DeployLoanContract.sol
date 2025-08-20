// deploy all contracts
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.30;

import "../lib/forge-std/src/Script.sol";
import "../src/EtherSwap.sol";
import "../src/BtcCollateralLoan.sol";

contract DeployScript is Script {
    function run() external {
        vm.startBroadcast();        
        // actual pubkeyvalidity is not checked
        string memory lenderBtcPubkey = "1234567890123456789012345678901234567890123456789012345678901234";
        //print the length of the lenderBtcPubkey
        //console.log("Lender BTC pubkey length: ", bytes(lenderBtcPubkey).length);
        
        //deploy btc collateral loan
        BtcCollateralLoan loan = new BtcCollateralLoan(
            lenderBtcPubkey,
            3000*180,
            100,
            200,
            150,
            250
        );
        console.log("Deployed BtcCollateralLoan: ", address(loan));
        
        //deploy ether swap
        EtherSwap etherSwap = new EtherSwap(address(loan));
        console.log("Deployed EtherSwap: ", address(etherSwap));

        //update loan with ether swap address
        loan.setEtherSwapAddress(address(etherSwap));
        console.log("Updated BtcCollateralLoan with EtherSwap address: ", address(etherSwap));

        //transfer ownership to lender , here msg.sender is assumed the lender as well
        loan.transferOwnership(msg.sender);
        console.log("Transferred ownership to lender: ", msg.sender);

        // Print the addresses to the console for the frontend to use e.g. Wagmi dapp environment variables
        //concat strings to avoid space after =
        console.log(string.concat("NEXT_PUBLIC_ETHER_SWAP_ADDRESS=", vm.toString(address(etherSwap))));
        console.log(string.concat("NEXT_PUBLIC_BTC_COLLATERAL_LOAN_ADDRESS=", vm.toString(address(loan))));

        vm.stopBroadcast();
    }
}
