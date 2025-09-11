/**
 * Signature verification utilities for the BTC Yield Protocol
 */

export interface SignatureData {
  sig_borrower: string;
  tx_hex: string;
  input_amount: number;
  escrow_address_script: string;
  tapleaf_script_hex: string;
  escrow_is_odd: boolean;
  [key: string]: any; // Allow additional properties
}

export interface VerificationRequest {
  signature_data: SignatureData;
  borrower_pubkey: string;
}

export interface VerificationResponse {
  success: boolean;
  data: {
    is_valid: boolean;
    borrower_pubkey: string;
    message: string;
  };
  error: string | null;
  message: string;
}

/**
 * Verify a borrower's signature using the Backend API (which proxies to Python API)
 */
export async function verifyBorrowerSignature(
  signatureData: SignatureData,
  borrowerPubkey: string,
  apiUrl: string = 'http://localhost:3002'
): Promise<VerificationResponse> {
  try {
    const response = await fetch(`${apiUrl}/api/signature-verification/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        signatureData,
        borrowerPubkey
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: VerificationResponse = await response.json();
    return result;
  } catch (error) {
    console.error('Error verifying signature:', error);
    throw new Error(`Failed to verify signature: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate a borrower signature using the Backend API (which proxies to Python API)
 * Note: This function is not currently used in the frontend
 */
export async function generateBorrowerSignature(
  loanData: {
    loan_id: string;
    escrow_txid: string;
    escrow_vout: number;
    borrower_pubkey: string;
    lender_pubkey: string;
    preimage_hash_borrower: string;
    preimage_hash_lender: string;
    borrower_timelock: number;
    lender_timelock: number;
    collateral_amount: string;
    origination_fee: string;
    borrower_private_key: string;
  },
  apiUrl: string = 'http://localhost:3002'
): Promise<{ signature_file_path: string }> {
  try {
    const response = await fetch(`${apiUrl}/api/signature-verification/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ loanData }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error generating signature:', error);
    throw new Error(`Failed to generate signature: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Load signature data from a file path (for testing purposes)
 */
export async function loadSignatureData(
  signatureFilePath: string,
  apiUrl: string = 'http://localhost:8001'
): Promise<SignatureData> {
  try {
    // In a real implementation, you might need to fetch this from the file system
    // For now, we'll assume the signature data is passed directly
    throw new Error('loadSignatureData not implemented - signature data should be passed directly');
  } catch (error) {
    console.error('Error loading signature data:', error);
    throw new Error(`Failed to load signature data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
