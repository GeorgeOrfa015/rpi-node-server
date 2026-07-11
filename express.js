import express from 'express';
import fs from 'fs/promises';
import cors from "cors";
import multer from 'multer';
import sharp from 'sharp';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PORT = 8080;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors())



// // Test Endpoint
// app.get('/', (req, res) => {
//     res.json({ message: 'Hello, World!' });
// });



// Status Endpoint
const startDate = new Date().getTime();
app.get('/status', (req, res)=> {
    res.json({ 
        online: true, 
        startTS: startDate, 
        uptime: new Date().getTime() - startDate,
    })
});



// Bus History Entries Endpoint
app.get('/history', async (req, res) => {
    try {
        const n = req.query.n || 1;
        const content = await fs.readFile('buscardhistory.txt', 'utf8');
        let data;
        let length;
        if (n == "all") {
            data = content.trim().split('\n')
            length = content.trim().split('\n').length
        }else{
            data = content.trim().split('\n').slice(-parseInt(n));
            length = content.trim().split('\n').slice(-parseInt(n)).length
        }
        res.json({ data, length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



// Develop Film Photo Endpoint
app.post('/tools/photo/film', upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded (field name must be "image")' });
    }

    try {
        // flip + invert first
        const inverted = await sharp(req.file.buffer)
            .negate({ alpha: false })
            .toBuffer();

        // get raw pixel data to build per-channel histograms
        const { data, info } = await sharp(inverted)
            .raw()
            .toBuffer({ resolveWithObject: true });

        const { width, height, channels } = info;
        const pixelCount = width * height;

        const colorChannels = Math.min(channels, 3);
        const histograms = Array.from({ length: colorChannels }, () => new Array(256).fill(0));

        for (let i = 0; i < data.length; i += channels) {
            for (let c = 0; c < colorChannels; c++) {
                histograms[c][data[i + c]]++;
            }
        }

        const lowCut = pixelCount * 0.01;
        const highCut = pixelCount * 0.99;

        const bounds = histograms.map(hist => {
            let cumulative = 0;
            let lo = 0, hi = 255;
            for (let v = 0; v < 256; v++) {
                cumulative += hist[v];
                if (cumulative >= lowCut) { lo = v; break; }
            }
            cumulative = 0;
            for (let v = 255; v >= 0; v--) {
                cumulative += hist[v];
                if (cumulative >= (pixelCount - highCut)) { hi = v; break; }
            }
            return { lo, hi };
        });
        console.log('stretch bounds:', bounds);

        // --- manual per-channel stretch (replaces .linear(a, b)) ---
        const stretched = Buffer.from(data);
        for (let i = 0; i < data.length; i += channels) {
            for (let c = 0; c < colorChannels; c++) {
                const { lo, hi } = bounds[c];
                const val = ((data[i + c] - lo) / ((hi - lo) || 1)) * 255;
                stretched[i + c] = Math.min(255, Math.max(0, val));
            }
        }

        const output = await sharp(stretched, { raw: { width, height, channels } })
            .modulate({ saturation: 1.15, brightness: 1.05 })
            .linear(1.05, 0)
            .jpeg({ quality: 95 })
            .toBuffer();
        // --- end replacement ---

        res.set('Content-Type', 'image/jpeg');
        res.send(output);
    } catch (err) {
        console.error('develop-negative error:', err);
        res.status(500).json({ error: 'Failed to process image' });
    }
});




// Server Initialization
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});



//! ↑ SERVER SETUP - ENDPOINTS ↑ !//
//>---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------<//
//! ↓ FUNCTIONS ↓ !//



//* Pulls data from the irakleio.buscard.gr API
async function requestDataFromBusAPI() {
    // https://irakleio.buscard.gr/card/RemainingDays/046C31EA7E7384  /CARD/ CB212600100014332
    const response = await fetch("https://irakleio.buscard.gr/card/RemainingDays/CB212600100014332");
    if (!response.ok) {
        console.error('Request failed:', response.status, response.statusText);
        return false
    }else{
        const data = await response.json()
        return data
    }
    
}


//* Reads bus card file and checks differences to log changes
async function busCardCheckDiff(){
    requestDataFromBusAPI().then(async (data) => {
        let productIndex = 0
        if (data.product0 != null) {
            if (data.product0.status == 15) {
                productIndex = 0
            }
        }
        if (data.product1 != null) {
            if (data.product1.status == 15) {
                productIndex = 1
            }
        }
        if (data.product2 != null) {
            if (data.product2.status == 15) {
                productIndex = 2
            }
        }

        let remoteRoute = data["product"+productIndex].usageTime +" | "+ data["product"+productIndex].usageRoute

        let localRoute = await readTxt("buscardhistory.txt")

        if (localRoute != remoteRoute) {
            writeTxt(remoteRoute+"\n", 'buscardhistory.txt')
            notify(remoteRoute, 'Bus Card Validation', `shortcuts://run-shortcut?name=${encodeURIComponent("Save Bus Route")}&input=text&text=${encodeURIComponent(remoteRoute)}`, "Bus", 3)
        }

        setTimeout(busCardCheckDiff, 5*60*1000)
    })
}



//! STANDALONE FUNCTIONS !//

//* Sends a push notification to my phone via the ntfy.sh API
async function notify(text, title, click, topic, priority) {
    try {
        const response = await fetch('https://ntfy.sh/GeorgeOrfa015-'+topic, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Title': title,
                'Click': click,
                'Priority': priority
            },
            body: text
        });
        return await response.json();
    } catch (err) {
        console.error(`[notify] Failed to send "${title}":`, err.message);
        return null;
    }
}


//* Reads a text file
async function readTxt(file) {
    try {
        const data = await fs.readFile(file, 'utf8');
        const lines = data.trim().split('\n');
        return lines[lines.length - 1];
    } catch (err) {
        console.error(err);
        return false
    }
}


//* Writes to a text file
function writeTxt(text, file){
    fs.writeFile(file, text, {flag: "a+"}, err => {
        if (err) {
            return err;
        }
    });
}


//* 


//! FUNCTION INITIALIZATION !//
notify("Server Started", "NodeJS Server Status", "", "Test", 1)
busCardCheckDiff()
