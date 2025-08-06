// deploy all contracts
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.30;

import "../lib/forge-std/src/Script.sol";
import "../src/WETH.sol";
import "../src/EtherSwap.sol";
import "../src/MyVault.sol";
import "../src/BtcCollateralLoan.sol";
import "../src/LoanFactory.sol";

contract DeployScript is Script {
    function run() external {
        vm.startBroadcast();
        WETH weth = new WETH();
        console.log("Deployed WETH: ", address(weth));

        // Deploy MyVault contract
        MyVault myVault = new MyVault(weth);
        console.log("Deployed MyVault: ", address(myVault));

        // Deploy LoanFactory contract
        LoanFactory loanFactory = new LoanFactory();
        console.log("Deployed LoanFactory: ", address(loanFactory));

        // Deploy EtherSwap contract
        EtherSwap etherSwap = new EtherSwap(address(loanFactory));
        console.log("Deployed EtherSwap: ", address(etherSwap));

        // Deploy BtcCollateralLoan contract using factory
        (address etherSwapAddress, address loanAddress) = loanFactory.deployContracts(
            "0x1234567890123456789012345678901234567890123456789012345678901234", // lenderBtcPubkey (32 bytes)
            3000*180, // loanDuration
            100, // timelockLoanReq
            200, // timelockBtcEscrow  
            150, // timelockRepaymentAccept
            250  // timelockBtcCollateral
        );
        console.log("Deployed EtherSwap: ", etherSwapAddress);
        console.log("Deployed BtcCollateralLoan: ", loanAddress);

        vm.stopBroadcast();
    }
}
