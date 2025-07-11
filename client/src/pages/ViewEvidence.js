import '../App.css'; // OR import '..App.css'; OR import '../../App.css';
import React, { useState, useEffect } from "react";
import { BrowserProvider, Contract } from "ethers";
import { CONTRACT_ABI, CONTRACT_ADDRESS } from "../constant";
import CryptoJS from "crypto-js";

const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/"; // Or "https://ipfs.io/ipfs/"

function ViewEvidence() {
  const [evidenceRecords, setEvidenceRecords] = useState([]);
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [aesKey, setAesKey] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [decryptedFileUrl, setDecryptedFileUrl] = useState(null);
  const [decryptedFileName, setDecryptedFileName] = useState("");
  const [isLoadingEvidenceList, setIsLoadingEvidenceList] = useState(true);
  const [isViewing, setIsViewing] = useState(false); // New state for loading indicator

  useEffect(() => {
    async function loadAllEvidence() {
      setIsLoadingEvidenceList(true);
      setStatusMessage({ type: 'info', message: "Loading evidence list from blockchain..." });

      try {
        if (!window.ethereum) {
          throw new Error("MetaMask or other Ethereum wallet not detected. Please install it.");
        }

        const provider = new BrowserProvider(window.ethereum);
        const network = await provider.getNetwork();
        console.log("Connected to network:", network.name, "(Chain ID:", network.chainId + ")");
        console.log("Contract Address:", CONTRACT_ADDRESS);

        const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

        let count;
        try {
          count = await contract.evidenceCount();
          count = Number(count);
          console.log("Total Evidence Count:", count);
        } catch (contractCallError) {
            console.error("Error calling evidenceCount() on contract:", contractCallError);
            if (contractCallError.code === "BAD_DATA" && contractCallError.value === "0x") {
                 throw new Error("Could not fetch evidence count. This often means the contract address or ABI is incorrect, or you're on the wrong network. Details: " + contractCallError.message);
            }
            throw contractCallError;
        }

        const loadedRecords = [];
        for (let i = 0; i < count; i++) {
          try {
            const [ipfsHash, timestamp, submittedBy] = await contract.getEvidence(i + 1);
            loadedRecords.push({
              id: i + 1,
              ipfsHash,
              timestamp: new Date(Number(timestamp) * 1000).toLocaleString(),
              submittedBy,
            });
          } catch (getEvidenceError) {
            console.warn(`Could not load evidence ID ${i + 1}:`, getEvidenceError);
          }
        }
        setEvidenceRecords(loadedRecords);
        setStatusMessage(loadedRecords.length > 0
            ? { type: 'success', message: "Evidence list loaded." }
            : { type: 'info', message: "No evidence found on the blockchain." });
      } catch (error) {
        console.error("Critical error loading evidence from blockchain:", error);
        setStatusMessage({ type: 'error', message: `Error: ${error.message || "Failed to load evidence list. Check console for details."}` });
      } finally {
        setIsLoadingEvidenceList(false);
      }
    }
    loadAllEvidence();
  }, []);

  const handleIdSelect = (e) => {
    const selectedId = parseInt(e.target.value);
    const record = evidenceRecords.find(rec => rec.id === selectedId);
    setSelectedEvidence(record);
    setDecryptedFileUrl(null);
    setDecryptedFileName("");
    setStatusMessage(""); // Clear general status message
    setAesKey("");
  };

  const handleView = async () => {
    if (!selectedEvidence) {
      setStatusMessage({ type: 'error', message: "Please select an evidence ID first." });
      return;
    }
    if (!aesKey) {
      setStatusMessage({ type: 'error', message: "Please provide the AES key." });
      return;
    }

    setIsViewing(true); // Start loading
    setStatusMessage({ type: 'info', message: "Fetching from IPFS and decrypting..." });
    setDecryptedFileUrl(null);
    setDecryptedFileName("");

    try {
      const ipfsUrl = `${IPFS_GATEWAY}${selectedEvidence.ipfsHash}`;
      console.log("Attempting to fetch from IPFS:", ipfsUrl);
      const response = await fetch(ipfsUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch IPFS content: ${response.status} ${response.statusText}`);
      }
      const encryptedString = await response.text();
      console.log("IPFS content fetched (first 100 chars):", encryptedString.substring(0, 100) + "...");
      console.log("Full encrypted string length:", encryptedString.length);

      console.log("AES Key used (do NOT share this with anyone!):", aesKey);
      const decrypted = CryptoJS.AES.decrypt(encryptedString, aesKey);

      console.log("Decrypted WordArray sigBytes:", decrypted.sigBytes);
      if (decrypted.sigBytes === 0) {
        setStatusMessage({ type: 'error', message: "❌ Decryption failed! Incorrect AES key or corrupted data. Ensure the key is correct for this specific evidence." });
        setDecryptedFileUrl(null);
        return;
      }

      const decryptedBase64 = CryptoJS.enc.Base64.stringify(decrypted);
      console.log("Decrypted Base64 (first 100 chars):", decryptedBase64.substring(0, 100) + "...");
      console.log("Full decrypted Base64 length:", decryptedBase64.length);

      const byteCharacters = atob(decryptedBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      console.log("Decrypted Byte Array length:", byteArray.length);

      const blob = new Blob([byteArray], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      setDecryptedFileUrl(url);

      const suggestedFileName = `evidence_${selectedEvidence.id}_${selectedEvidence.ipfsHash.substring(0, 8)}.decrypted`;
      setDecryptedFileName(suggestedFileName);

      setStatusMessage({ type: 'success', message: "✅ Evidence decrypted successfully! Ready for download." });

    } catch (err) {
      console.error("Error viewing evidence:", err);
      setStatusMessage({ type: 'error', message: `❌ Error viewing evidence: ${err.message || "Unknown error. Check console"}.` });
      setDecryptedFileUrl(null);
      setDecryptedFileName("");
    } finally {
      setIsViewing(false); // Always stop loading
    }
  };

  const handleDownload = () => {
    if (decryptedFileUrl) {
      const a = document.createElement('a');
      a.href = decryptedFileUrl;
      a.download = decryptedFileName || 'decrypted_evidence';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(decryptedFileUrl);
      setStatusMessage({ type: 'info', message: "File download initiated. Remember to add the correct file extension!" });
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
      <button onClick={handleView} className="btn-primary" disabled={!selectedEvidence || !aesKey || isViewing}>
        {isViewing ? "Viewing..." : "View Evidence"}
      </button>

      {statusMessage && (
        <div className={`status-message ${statusMessage.type}`}>
          {statusMessage.message}
        </div>
      )}

      {decryptedFileUrl && (
        <div className="decrypted-content">
          <h3>Decrypted Evidence Ready!</h3>
          <button onClick={handleDownload} className="btn-primary">
            Download Decrypted File ({decryptedFileName})
          </button>
        </div>
      )}
    </div>
  );
}

export default ViewEvidence;