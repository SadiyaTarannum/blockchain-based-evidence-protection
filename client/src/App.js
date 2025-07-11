import React, { useState, useEffect } from "react";
import UploadEvidence from "./pages/UploadEvidence";
import ViewEvidence from "./pages/ViewEvidence";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from './constant';

function App() {
  const [page, setPage] = useState("upload");
  const [account, setAccount] = useState(null);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts"
        });
        setAccount(accounts[0]);
      } catch (err) {
        console.error("Wallet connection failed:", err);
      }
    } else {
      alert("🦊 Please install MetaMask!");
    }
  };

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts) => {
        setAccount(accounts[0]);
      });
    }
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #e0eafc, #cfdef3)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center"
    }}>
      <h1 style={{ marginBottom: 16 }}>Blockchain Evidence Protection System</h1>

      <div style={{ marginBottom: 12 }}>
        {account ? (
          <span>✅ Connected: {account.slice(0, 6)}...{account.slice(-4)}</span>
        ) : (
          <button onClick={connectWallet} style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "none",
            background: "#4f8cff",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer"
          }}>
            🔗 Connect Wallet
          </button>
        )}
      </div>

      <div style={{ marginBottom: 32 }}>
        <button onClick={() => setPage("upload")} style={{
          marginRight: 16,
          padding: "10px 24px",
          borderRadius: 8,
          border: "none",
          background: page === "upload" ? "#4f8cff" : "#e0eafc",
          color: page === "upload" ? "#fff" : "#333",
          fontWeight: 600,
          cursor: "pointer"
        }}>
          Upload Evidence
        </button>
        <button onClick={() => setPage("view")} style={{
          padding: "10px 24px",
          borderRadius: 8,
          border: "none",
          background: page === "view" ? "#4f8cff" : "#e0eafc",
          color: page === "view" ? "#fff" : "#333",
          fontWeight: 600,
          cursor: "pointer"
        }}>
          View Evidence
        </button>
      </div>

      <div style={{
        width: 400,
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        padding: 32
      }}>
        {page === "upload" ? <UploadEvidence account={account} /> : <ViewEvidence />}
      </div>
    </div>
  );
}

export default App;
