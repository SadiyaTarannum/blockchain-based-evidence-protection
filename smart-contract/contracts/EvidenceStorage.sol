import React, { useState, useEffect } from "react";
import { BrowserProvider, Contract } from "ethers";
// Ensure CONTRACT_ABI and CONTRACT_ADDRESS are correctly defined in your constant.js
import { CONTRACT_ABI, CONTRACT_ADDRESS } from "../constant";
import CryptoJS from "crypto-js";

// Use a public IPFS gateway for fetching. Pinata's gateway is good for files pinned with Pinata.
const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/"; // Or "https://ipfs.io/ipfs/"

function ViewEvidence() {
  // State to store all loaded evidence records from the blockchain
  const [evidenceRecords, setEvidenceRecords] = useState([]); // Stores {id, ipfsHash, timestamp, submittedBy}
  // State for the currently selected evidence from the dropdown
  const [selectedEvidence, setSelectedEvidence] = useState(null); // Stores the full selected record
  // State for the AES key input by the user
  const [aesKey, setAesKey] = useState("");
  // State to show messages about the decryption process
  const [statusMessage, setStatusMessage] = useState(""); // Renamed for broader use
  // State to store the URL for the decrypted file (for display or download)
  const [decryptedFileUrl, setDecryptedFileUrl] = useState(null);
  // State to suggest a filename for download
  const [decryptedFileName, setDecryptedFileName] = useState("");
  // State to indicate loading status for initial evidence list
  const [isLoadingEvidenceList, setIsLoadingEvidenceList] = useState(true);

  // useEffect hook to fetch evidence IDs and basic info from the contract on component mount
  useEffect(() => {
    async function loadAllEvidence() {
      setIsLoadingEvidenceList(true); // Start loading
      setStatusMessage("Loading evidence list from blockchain..."); // Initial status

      try {
        if (!window.ethereum) {
          throw new Error("MetaMask or other Ethereum wallet not detected. Please install it.");
        }

        const provider = new BrowserProvider(window.ethereum);
        const network = await provider.getNetwork();
        console.log("Connected to network:", network.name, "(Chain ID:", network.chainId + ")");
        console.log("Contract Address:", CONTRACT_ADDRESS);
        console.log("Contract ABI (first 2 entries):", CONTRACT_ABI.slice(0, 2)); // Log partial ABI for sanity check

        // Create a contract instance for read-only operations
        const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

        // Fetch the total count of evidence
        // IMPORTANT: The error "could not decode result data (value="0x")" usually happens here.
        // It means the contract.evidenceCount() call returned an empty or unreadable value.
        // This is almost always due to incorrect CONTRACT_ADDRESS, CONTRACT_ABI, or network connection.
        let count;
        try {
          count = await contract.evidenceCount();
          // Ethers.js v6 returns BigInt for uint256. Convert to number for loop.
          count = Number(count);
          console.log("Total Evidence Count:", count);
        } catch (contractCallError) {
            console.error("Error calling evidenceCount() on contract:", contractCallError);
            if (contractCallError.code === "BAD_DATA" && contractCallError.value === "0x") {
                 throw new Error("Could not fetch evidence count. This often means the contract address or ABI is incorrect, or you're on the wrong network. Details: " + contractCallError.message);
            }
            throw contractCallError; // Re-throw other errors
        }

        const loadedRecords = [];

        // Loop through all evidence IDs to get their details
        for (let i = 0; i < count; i++) {
          try {
            const [ipfsHash, timestamp, submittedBy] = await contract.getEvidence(i);
            loadedRecords.push({
              id: i,
              ipfsHash,
              // Convert BigInt timestamp to a readable date string
              timestamp: new Date(Number(timestamp) * 1000).toLocaleString(),
              submittedBy,
            });
          } catch (getEvidenceError) {
            console.warn(`Could not load evidence ID ${i}:`, getEvidenceError);
            // Optionally, skip this record or show a specific error for it
          }
        }
        setEvidenceRecords(loadedRecords);
        setStatusMessage(loadedRecords.length > 0 ? "Evidence list loaded." : "No evidence found on the blockchain.");
      } catch (error) {
        console.error("Critical error loading evidence from blockchain:", error);
        setStatusMessage(`Error: ${error.message || "Failed to load evidence list. Check console for details."}`);
      } finally {
        setIsLoadingEvidenceList(false); // Stop loading
      }
    }
    loadAllEvidence();
  }, []); // Empty dependency array means this runs once on component mount

  // Handler for when an evidence ID is selected from the dropdown
  const handleIdSelect = (e) => {
    const selectedId = parseInt(e.target.value);
    const record = evidenceRecords.find(rec => rec.id === selectedId);
    setSelectedEvidence(record); // Store the full record for later use
    // Clear previous state when a new ID is selected
    setDecryptedFileUrl(null);
    setDecryptedFileName("");
    setStatusMessage("");
    setAesKey(""); // Clear AES key input for a new selection
  };

  // Handler for the "View Evidence" button click
  const handleView = async () => {
    if (!selectedEvidence) {
      setStatusMessage("Please select an evidence ID first.");
      return;
    }
    if (!aesKey) {
      setStatusMessage("Please provide the AES key.");
      return;
    }

    setStatusMessage("Fetching from IPFS and decrypting...");
    setDecryptedFileUrl(null); // Clear any old URL
    setDecryptedFileName("");

    try {
      // 1. Download the encrypted content from IPFS using a gateway URL
      const ipfsUrl = `${IPFS_GATEWAY}${selectedEvidence.ipfsHash}`;
      console.log("Fetching from IPFS:", ipfsUrl);
      const response = await fetch(ipfsUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch IPFS content: ${response.status} ${response.statusText}`);
      }
      const encryptedString = await response.text(); // The content is an encrypted string
      console.log("IPFS content fetched (first 50 chars):", encryptedString.substring(0, 50) + "...");

      // 2. Decrypt the content using the provided AES key
      const decrypted = CryptoJS.AES.decrypt(encryptedString, aesKey);

      // Check if decryption failed (e.g., wrong key). If sigBytes is 0, it's often a failure.
      if (decrypted.sigBytes === 0) {
        setStatusMessage("❌ Decryption failed! Incorrect AES key or corrupted data. Ensure the key is correct for this specific evidence.");
        setDecryptedFileUrl(null);
        return;
      }

      // Convert the decrypted WordArray back to a Base64 string
      const decryptedBase64 = CryptoJS.enc.Base64.stringify(decrypted);
      console.log("Content decrypted to Base64 (first 50 chars):", decryptedBase64.substring(0, 50) + "...");

      // 3. Convert the Base64 string back to a Blob for display/download
      const byteCharacters = atob(decryptedBase64); // Decode Base64 to binary string
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers); // Convert to Uint8Array

      const blob = new Blob([byteArray], { type: 'application/octet-stream' }); // Create a generic binary Blob

      // Create a URL for the Blob (for browser display/download)
      const url = URL.createObjectURL(blob);
      setDecryptedFileUrl(url);

      // Set a suggested filename for download. Ideally, you'd retrieve original name if stored.
      const suggestedFileName = `evidence_${selectedEvidence.id}_${selectedEvidence.ipfsHash.substring(0, 8)}.decrypted`;
      setDecryptedFileName(suggestedFileName);

      setStatusMessage("✅ Evidence decrypted successfully! Ready for download.");

    } catch (err) {
      console.error("Error viewing evidence:", err);
      setStatusMessage(`❌ Error viewing evidence: ${err.message || "Unknown error. Check console."}.`);
      setDecryptedFileUrl(null);
      setDecryptedFileName("");
    }
  };

  // Handler for the "Download Decrypted File" button
  const handleDownload = () => {
    if (decryptedFileUrl) {
      const a = document.createElement('a');
      a.href = decryptedFileUrl;
      a.download = decryptedFileName || 'decrypted_evidence'; // Use suggested name or generic
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(decryptedFileUrl); // Clean up the object URL after download
      setStatusMessage("File download initiated.");
    }
  };

  return (
    <div className="view-section">
      <h2>View Evidence</h2>
      <div>
        <label>Select Evidence ID:</label>
        <select
          onChange={handleIdSelect}
          value={selectedEvidence ? selectedEvidence.id : ""}
          disabled={isLoadingEvidenceList || evidenceRecords.length === 0}
        >
          <option value="">
            {isLoadingEvidenceList ? "Loading..." : (evidenceRecords.length === 0 ? "-- No Evidence Found --" : "-- Select Evidence --")}
          </option>
          {evidenceRecords.map((record) => (
            <option key={record.id} value={record.id}>
              ID: {record.id} | Submitter: {record.submittedBy.substring(0, 6)}... | {record.timestamp}
            </option>
          ))}
        </select>
      </div>
      <br />
      <div>
        <label>AES Key:</label>
        <input
          type="password"
          placeholder="Enter AES Key"
          value={aesKey}
          onChange={(e) => setAesKey(e.target.value)}
          required
        />
      </div>
      <br />
      <button onClick={handleView} disabled={!selectedEvidence || !aesKey}>
        View Evidence
      </button>

      {/* Status messages display */}
      {statusMessage && <div className="status">{statusMessage}</div>}

      {/* Decrypted content display/download section */}
      {decryptedFileUrl && (
        <div className="decrypted-content">
          <h3>Decrypted Evidence Ready!</h3>
          <button onClick={handleDownload}>
            Download Decrypted File ({decryptedFileName})
          </button>
          {/* Considerations for displaying:
            - If you know the file type (e.g., .txt, .jpg, .pdf), you could conditionally render:
              <a href={decryptedFileUrl} target="_blank" rel="noopener noreferrer">View in New Tab</a>
            - For images: <img src={decryptedFileUrl} alt="Decrypted Evidence" style={{ maxWidth: '100%' }} />
            - For PDFs: <iframe src={decryptedFileUrl} style={{ width: '100%', height: '500px', border: 'none' }}></iframe>
            - For general binary files, a download link is the safest and most common approach.
          */}
        </div>
      )}
    </div>
  );
}

export default ViewEvidence;