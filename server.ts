import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import multer from "multer";
import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode";
import { Boom } from "@hapi/boom";

const app = express();
const PORT = 3000;
app.use(express.json());

// Setup static uploads folder
const uploadsDir = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

// Multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Upload endpoint
app.post("/api/upload", upload.single("image"), (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ imageUrl });
});

// WhatsApp State
let sock: any = null;
let qrCode: string | null = null;
let connectionStatus: "connecting" | "connected" | "disconnected" = "disconnected";

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        printQRInTerminal: false,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS('Desktop'),
    });

    sock.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log("WhatsApp QR Received");
            qrCode = await QRCode.toDataURL(qr);
            connectionStatus = "disconnected"; 
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('WhatsApp connection closed:', lastDisconnect?.error?.message || lastDisconnect?.error);
            connectionStatus = "disconnected";
            qrCode = null; 
            if (shouldReconnect) {
                console.log('Reconnecting WhatsApp...');
                connectToWhatsApp();
            }
        } else if (connection === 'connecting') {
            connectionStatus = "connecting";
            console.log('WhatsApp connecting...');
        } else if (connection === 'open') {
            qrCode = null;
            connectionStatus = "connected";
            console.log('WhatsApp connection opened successfully');
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

// Start WhatsApp
connectToWhatsApp();

// API Routes
app.get("/api/whatsapp/status", (req, res) => {
    res.json({ status: connectionStatus, qr: qrCode, user: sock?.user || null });
});

app.post("/api/whatsapp/logout", async (req, res) => {
    try {
        if (sock) {
            await sock.logout();
            // Delete auth folder
            if (fs.existsSync('baileys_auth')) {
                fs.rmSync('baileys_auth', { recursive: true, force: true });
            }
            connectionStatus = "disconnected";
            qrCode = null;
            sock = null;
            connectToWhatsApp(); // Restart for new QR
            res.json({ success: true });
        } else {
            res.json({ success: true });
        }
    } catch (e) {
        console.error("Logout error:", e);
        res.status(500).json({ error: "Failed to logout" });
    }
});

app.post("/api/notify-order", async (req, res) => {
    const { order, targetNumber } = req.body;
    
    if (connectionStatus !== 'connected' || !sock) {
        console.error("Order notification failed: WhatsApp not connected");
        return res.status(400).json({ error: "WhatsApp not connected. Please go to Admin and scan QR." });
    }

    try {
        const message = `🚗 *NEW CPM ORDER RECEIVED*\n\n` +
            `*ITEM:* ${order.productName}\n` +
            `*PRICE:* ₹${order.totalAmount}\n` +
            `--------------------------\n` +
            `*CUSTOMER:* ${order.customerName}\n` +
            `*PHONE:* ${order.customerPhone}\n` +
            `*INFO:* ${order.address}\n\n` +
            `*METHOD:* Cash on Delivery\n` +
            `--------------------------\n` +
            `_Reply to this message to coordinate delivery._`;

        // Robust JID formatting
        let cleanNumber = targetNumber.toString().replace(/\D/g, '');
        if (cleanNumber.length < 10) {
            throw new Error("Invalid phone number length");
        }
        
        let jid = cleanNumber.includes('@s.whatsapp.net') ? cleanNumber : `${cleanNumber}@s.whatsapp.net`;
        
        console.log(`Sending WhatsApp message to ${jid}...`);
        await sock.sendMessage(jid, { text: message });
        console.log("WhatsApp message sent successfully");
        res.json({ success: true });
    } catch (error: any) {
        console.error("Failed to send WA message:", error.message || error);
        res.status(500).json({ error: "Failed to send notification: " + (error.message || "Unknown error") });
    }
});

async function startServer() {
    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), "dist");
        app.use(express.static(distPath));
        app.get("*", (req, res) => {
            res.sendFile(path.join(distPath, "index.html"));
        });
    }

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer();
