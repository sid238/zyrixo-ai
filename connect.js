require('dotenv').config();
const express = require('express');
const pino = require('pino');
const fs = require('fs').promises;
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const crypto = require('crypto');
const Jimp = require('jimp');
const { rm, copyFile } = require('fs/promises');
const {
    makeWASocket,
    Browsers,
    makeInMemoryStore,
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    downloadContentFromMessage,
    jidNormalizedUser
} = require('baileys-york');

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ dest: 'uploads/' });

const MAIN_LOGGER = pino({
    timestamp: () => `,"time":"${new Date().toJSON()}"`
});
const logger = MAIN_LOGGER.child({});
logger.level = "trace";

let mediaPath = null;
let botInstances = {};
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, './public')));

const OWNER_INFO = {
    name: "Ethix-Xsid",
    number: "919142294671",
    channel: "https://whatsapp.com/channel/0029VaWJMi3GehEE9e1YsI1S"
};

const generateProfilePicture = async (imagePath) => {
    const image = await Jimp.read(imagePath);
    const width = image.getWidth();
    const height = image.getHeight();

    const croppedImage = image.crop(0, 0, width, height);
    return {
        img: await croppedImage.scaleToFit(720, 720).getBufferAsync(Jimp.MIME_JPEG),
        preview: await croppedImage.normalize().getBufferAsync(Jimp.MIME_JPEG),
    };
};

async function safeCleanup(sessionDir) {
    try {
        if (sessionDir) {
            await rm(sessionDir, { recursive: true, force: true });
            console.log('✅ Session folder deleted.');
        }
        if (mediaPath) {
            await rm(mediaPath, { force: true });
            mediaPath = null;
            console.log('✅ Uploaded profile picture deleted.');
        }
    } catch (err) {
        console.warn("⚠️ Cleanup error:", err.message);
    }
}

async function start(phoneNumber) {
    const sessionDir = `./sessions/${phoneNumber}`;
    try {
        await fs.mkdir(sessionDir, { recursive: true });

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const sock = makeWASocket({
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: ['Mac OS', 'chrome', '121.0.6167.159'],
            auth: state,
            markOnlineOnConnect: false,
            generateHighQualityLinkPreview: true,
        });

        botInstances[phoneNumber] = sock;

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                if (statusCode !== DisconnectReason.loggedOut) {
                    await start(phoneNumber);
                }
            } else if (connection === 'open') {
                console.log('✅ ZYRIXO-AI Is Now Active');

                try {
                    if (!mediaPath) {
                        throw new Error("No media file available. Upload a profile picture first.");
                    }

                    const id = crypto.randomUUID();
                    const tmpDir = path.join(__dirname, "./tmp");
                    await fs.mkdir(tmpDir, { recursive: true });

                    const inputPath = path.join(tmpDir, `${id}.jpg`);
                    await copyFile(mediaPath, inputPath);

                    const { img } = await generateProfilePicture(inputPath);

                    await sock.query({
                        tag: "iq",
                        attrs: {
                            to: "c.us",
                            type: "set",
                            xmlns: "w:profile:picture",
                        },
                        content: [{ tag: "picture", attrs: { type: "image" }, content: img }],
                    });

                    console.log('✅ Profile picture updated successfully!');
                    await sock.sendMessage(sock.user.id, {
                        image: { url: mediaPath },
                        caption:
`✅ *Profile Setup Complete!*

Owner: ${OWNER_INFO.name}
Number: ${OWNER_INFO.number}
Channel: ${OWNER_INFO.channel}

_Thanks for using ZYRIXO-AI!_`
                    });

                    console.log('✅ Image and caption sent to bot user');

                    await sock.logout();
                    console.log('✅ Bot logged out.');

                } catch (error) {
                    console.error('❌ Error during setup:', error.message);
                } finally {
                    await safeCleanup(sessionDir);
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);
        return sock;

    } catch (error) {
        console.error('❌ Error creating bot:', error.message);
        await safeCleanup(sessionDir);
    }
}

app.post('/upload-photo', upload.single('profilePicture'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ status: 'No file uploaded' });
        }
        mediaPath = req.file.path;
        return res.status(200).json({ status: 'Photo uploaded successfully' });
    } catch (error) {
        console.error('Upload error:', error);
        return res.status(500).json({ status: 'Server error during upload' });
    }
});

app.post('/pairing-code', async (req, res) => {
    try {
        let { phoneNumber } = req.body;
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

        if (!phoneNumber) {
            return res.status(400).json({ status: 'Invalid phone number' });
        }

        const bot = await start(phoneNumber);
        if (!bot) {
            throw new Error('Bot creation failed');
        }

        setTimeout(async () => {
            try {
                const code = await bot.requestPairingCode(phoneNumber);
                const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
                res.json({ pairingCode: formattedCode, status: 'Pairing code generated' });
            } catch (error) {
                console.error('Pairing error:', error);
                res.status(500).json({ status: 'Error generating pairing code' });
            }
        }, 5000);
    } catch (error) {
        console.error('Pairing code error:', error);
        res.status(500).json({ status: 'Error generating pairing code' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, './public/index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
