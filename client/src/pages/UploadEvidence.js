import React, { useState } from "react";
import { BrowserProvider, Contract } from "ethers";
import { CONTRACT_ABI, CONTRACT_ADDRESS } from "../constant";
import CryptoJS from "crypto-js";
import axios from 'axios';
import '../App.css'; // OR import '..App.css'; OR import '../../App.css';

function UploadEvidence() {
  const [file, setFile] = useState(null);
  const [aesKey, setAesKey] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false); // New state for loading indicator

  const handleFileChange = (e) => setFile(e.target.files[0]);
  const handleKeyChange = (e) => setAesKey(e.target.value);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !aesKey) {
      setUploadStatus({ type: 'error', message: "Please select a file and provide an AES key." });
      return;
    }

    setIsUploading(true); // Start loading
    setUploadStatus({ type: 'info', message: "Starting upload process..." });

    try {
      setUploadStatus({ type: 'info', message: "Encrypting file..." });
      const reader = new FileReader();
      reader.onload = async () => {
        const wordArray = CryptoJS.lib.WordArray.create(reader.result);
        const encryptedString = CryptoJS.AES.encrypt(wordArray, aesKey).toString();

        setUploadStatus({ type: 'info', message: "Uploading encrypted file to IPFS (via Pinata)..." });

        const encryptedBlob = new Blob([encryptedString], { type: 'application/octet-stream' });
        const encryptedFileForUpload = new File([encryptedBlob], `${file.name}.encrypted`, { type: 'application/octet-stream' });

        const formData = new FormData();
        formData.append('file', encryptedFileForUpload);

        const pinataMetadata = JSON.stringify({
          name: `${file.name}.encrypted`,
          originalName: file.name,
        });
        formData.append('pinataMetadata', pinataMetadata);

        const pinataOptions = JSON.stringify({
          cidVersion: 0,
        });
        formData.append('pinataOptions', pinataOptions);

        try {
          const res = await axios.post(
            "https://api.pinata.cloud/pinning/pinFileToIPFS",
            formData,
            {
              maxBodyLength: Infinity,
              headers: {
                'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
                'pinata_api_key': process.env.REACT_APP_PINATA_API_KEY,
                'pinata_secret_api_key': process.env.REACT_APP_PINATA_SECRET_API_KEY,
              },
            }
          );

          const ipfsHash = res.data.IpfsHash;

          setUploadStatus({ type: 'info', message: "Submitting IPFS hash to Blockchain (MetaMask will pop up)..." });
          const provider = new BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

          // Check network before sending transaction
          const network = await provider.getNetwork();
          if (network.chainId !== BigInt(11155111)) { // Sepolia Chain ID
              setUploadStatus({ type: 'error', message: `Wrong network! Please switch MetaMask to Sepolia Test Network. Current: ${network.name}` });
              setIsUploading(false); // Stop loading
              return;
          }

          const tx = await contract.submitEvidence(ipfsHash);
          await tx.wait(); // Wait for the transaction to be mined
          setUploadStatus({ type: 'success', message: `✅ Evidence submitted successfully! IPFS Hash: ${ipfsHash}` });

          // Clear form fields
          setFile(null);
          setAesKey("");
          document.getElementById('fileInput').value = '';

        } catch (pinataOrContractError) {
          console.error("Error during Pinata upload or Blockchain submission:", pinataOrContractError);
          let errorMessage = "An error occurred during upload or blockchain submission.";
          if (pinataOrContractError.response && pinataOrContractError.response.data) {
              errorMessage = `Pinata Error: ${pinataOrContractError.response.data.error || pinataOrContractError.response.data.message}`;
          } else if (pinataOrContractError.code === 4001) {
              errorMessage = "MetaMask Tx Signature: User denied transaction signature.";
          } else if (pinataOrContractError.reason) { // Ethers.js v6 error reason
              errorMessage = `Blockchain Error: ${pinataOrContractError.reason}`;
          } else if (pinataOrContractError.message) {
              errorMessage = `Error: ${pinataOrContractError.message}`;
          }
          setUploadStatus({ type: 'error', message: `❌ ${errorMessage}` });
        }

      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error("General upload error:", err);
      setUploadStatus({ type: 'error', message: `❌ Upload failed: ${err.message || "Check console for details."}` });
    } finally {
      setIsUploading(false); // Always stop loading
    }
  };

  return (
    <div className="upload-section">
      <h2>Upload Evidence</h2>
      <form onSubmit={handleUpload}>
        <label>
          Choose File:
          <input type="file" id="fileInput" onChange={handleFileChange} required />
        </label>
        <label>
          AES Key:
          <input type="password" value={aesKey} onChange={handleKeyChange} required />
        </label>
        <button type="submit" className="btn-primary" disabled={isUploading}>
          {isUploading ? "Uploading..." : "Encrypt & Upload"}
        </button>
      </form>
      {uploadStatus && (
        <div className={`status-message ${uploadStatus.type}`}>
          {uploadStatus.message}
        </div>
      )}
    </div>
  );
}

export default UploadEvidence;