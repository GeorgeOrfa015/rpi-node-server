import express from 'express';
import fs from 'fs/promises';
import cors from "cors";

const app = express();
const PORT = 8080;


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.json({ message: 'Hello, World!' });
});

app.get('/history', async (req, res) => {
    try {
        const n = parseInt(req.query.n) || 1;
        const content = await fs.readFile('history.txt', 'utf8');
        const lines = content.trim().split('\n').slice(-n);
        res.json({ lines });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});




async function requestDataFromServer() {
    // https://irakleio.buscard.gr/card/RemainingDays/CB212600100014332
    const response = await fetch("https://irakleio.buscard.gr/en/card/RemainingDays/CB212600100014332");
    if (!response.ok) {
        console.error('Request failed:', response.status, response.statusText);
        return false
    }else{
        const data = await response.json()
        return data
    }
    
}



async function readLastRoute() {
    try {
        const data = await fs.readFile('history.txt', 'utf8');
        const lines = data.trim().split('\n');
        return lines[lines.length - 1];
    } catch (err) {
        console.error(err);
    }
}

function write(text){
    fs.writeFile('history.txt', text, {flag: "a+"}, err => {
        if (err) {
            return err;
        }
    });
}

async function checkDiff(){
    requestDataFromServer().then(async (data) => {
        console.log(data)
        let productIndex = 0
        if (data.product0 != null) {
            if (data.product0.status != 15) {
                productIndex = 0
            }
        }
        if (data.product1 != null) {
            if (data.product1.status != 15) {
                productIndex = 1
            }
        }
        if (data.product2 != null) {
            if (data.product2.status != 15) {
                productIndex = 2
            }
        }
        console.log(productIndex)

        let remoteRoute = data["product"+productIndex].usageTime +" | "+ data["product"+productIndex].usageRoute
        console.log(remoteRoute)

        let localRoute = await readLastRoute()
        console.log(localRoute)

        if (localRoute != remoteRoute) {
            write(remoteRoute+"\n")
            notify(remoteRoute)
        }

        setTimeout(checkDiff, 5*60*1000)
    })
}
checkDiff()
async function notify(text) {
    const response = await fetch('https://ntfy.sh/GeorgeOrfa015-Test', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Title': 'Bus Card Validation',
            'Click': `shortcuts://run-shortcut?name=${encodeURIComponent("Save Bus Route")}&input=text&text=${encodeURIComponent(text)}`
        },
        body: text
    });
    return await response.json();
}