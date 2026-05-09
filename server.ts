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
            console.log("New QR Generated");
            qrCode = await QRCode.toDataURL(qr);
            connectionStatus = "disconnected"; // Ensure we show QR when not connected
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            connectionStatus = "disconnected";
            qrCode = null; // Clear QR on close unless new one comes
            console.log('connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'connecting') {
            connectionStatus = "connecting";
        } else if (connection === 'open') {
            qrCode = null;
            connectionStatus = "connected";
            console.log('opened connection');
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

// Start WhatsApp
connectToWhatsApp();

// API Routes
app.get("/api/whatsapp/status", (req, res) => {
    res.json({ status: connectionStatus, qr: qrCode });
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
            connectToWhatsApp(); // Restart for new QR
            res.json({ success: true });
        }
    } catch (e) {
        res.status(500).json({ error: "Failed to logout" });
    }
});

app.post("/api/notify-order", async (req, res) => {
    const { order, targetNumber } = req.body;
    if (connectionStatus !== 'connected' || !sock) {
        return res.status(400).json({ error: "WhatsApp not connected" });
    }

    try {
        const message = `🚗 *New CPM Order!*\n\n` +
            `*Product:* ${order.productName}\n` +
            `*Customer:* ${order.customerName}\n` +
            `*Phone:* ${order.customerPhone}\n` +
            `*Address:* ${order.address}\n` +
            `*Price:* ₹${order.totalAmount}\n` +
            `*Method:* Cash on Delivery\n\n` +
            `Please confirm this order soon.`;

        // Format number: remove + and ensure valid format (e.g. 919876543210@s.whatsapp.net)
        let cleanNumber = targetNumber.replace(/\D/g, '');
        if (!cleanNumber.endsWith('@s.whatsapp.net')) {
            cleanNumber += '@s.whatsapp.net';
        }

        await sock.sendMessage(cleanNumber, { text: message });
        res.json({ success: true });
    } catch (error) {
        console.error("Failed to send WA message:", error);
        res.status(500).json({ error: "Failed to send notification" });
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
