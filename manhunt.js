import express from 'express';

const clientData = new Map();

let gameStarted = false

export default function createTestModule(wss, clients) {
    const router = express.Router();

    //! ↓ ENDPOINTS ↓ !//

    router.get('/manhunt/ping', (req, res) => {
        res.json({ pong: true });
    });

    router.post('/manhunt/register', (req, res) => {
        let data = req.body;
        if (!hasUser(data.username)) {

            addUser(data.username, {"role": data.role, lastPingTS: 0})

            res.status(200).json({"registrationState":"success","reason":""})
            console.log(data.username, "REGISTERED as", data.role)
        }else{
            res.status(409).json({"registrationState":"failed","reason":"User already registered"});
        }
    });

    router.post('/manhunt/switchRole', (req, res) => {
        let data = req.body;
        if (hasUser(data.username)) {
            if (getUser(data.username).role == "hunter") {
                updateUser(data.username, {role: "runner"})
                console.log(data.username, "switched to runner")
            }else{
                updateUser(data.username, {role: "hunter"})
                console.log(data.username, "switched to hunter")
            }
            res.status(200).json({"newRole": getUser(data.username).role})
            if (gameStarted) {
                let flag = true
                for (const [user, dataL] of clientData) {
                    if (dataL.role == "runner") {
                        flag = false
                    }
                }
                if (flag) {
                    endGame(true);
                }
            }
        }
    })

    router.get('/manhunt/registerCheck/:username', (req, res) => {
        const { username } = req.params;
        if (!hasUser(username)) {
            res.json({registered: false})
        }else{
            res.json({registered: true})
        }
    })

    router.get('/manhunt/remove/:username', (req, res) => {
        const { username } = req.params;
        if (hasUser(username)) {
            removeUser(username)
            res.json({removed: true, reason: ""})
        }else{
            res.json({removed: false, reason: "User not found."})
        }
    })


    router.get('/manhunt/start', (req, res)=>{
        start();
        res.json({started: true})
    })

    router.get('/manhunt/state', (req, res)=>{
        res.json({started: gameStarted})
    })

    router.get('/manhunt/userData/:username', (req, res) => {
        const { username } = req.params;
        res.json(getUser(username))
    })

    router.get('/manhunt/playerlist', (req, res) => {
        res.json({"users": listUsers()})
    })

    router.post('/manhunt/locationPing', (req, res) => {
        let data = req.body;
        if (hasUser(data.username)) {
            updateUser(data.username, {lastPingTS: new Date().getTime(), location: data.location})
            notifyMH(`Tap this notification to open in google maps\nhttps://www.google.com/maps/search/?api=1&query=${data.location}`, `${data.username} HAS UPDATED THEIR LOCATION`, `https://www.google.com/maps/search/?api=1&query=${data.location}`, "ALL", 3);
            res.status(200).json({"locationPingStatus":"success"})
            console.log("Player "+data.username+" sent location "+data.location)
        }else{
            res.status(400).json({"locationPingStatus":"failed"})
        }
    })

    router.get('/manhunt/nextPingTS', (req, res) => {
        res.json({"nextPingTS": nextPingTS});
    })

    router.get('/manhunt/reset', (req, res) => {
        endGame(false);
        res.json({"reset": true});
    })

    //window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${long}`).focus();
    //! ↓ WEBSOCKET ↓ !//

    wss.on('connection', (ws, req) => {
        ws.on("message", (data) => {
            const clientInfo = clients.get(ws);
            if (clientInfo.mode == "manhunt") {
                console.log("MANHUNT", data.toString())
            }
        })
    });


    return router;
}

function addUser(username, data = {}) {
    if (clientData.has(username)) {
        throw new Error('User already registered');
    }
    clientData.set(username, { username, ...data });
}

function removeUser(username) {
    console.log(username + " removed")
    return clientData.delete(username); // returns true/false — useful for "did it exist?"
}

function updateUser(username, changes) {
    const user = clientData.get(username);
    if (!user) return false;
    Object.assign(user, changes);
    return true;
}

function getUser(username) {
    return clientData.get(username);
}

function hasUser(username) {
    return clientData.has(username);
}

function listUsers() {
    return Array.from(clientData.values());
}








let pingTimeout


let delayList = [10, 10, 10, 5, 5, 5, 2.5, 2.5, 2.5, 2.5, 1]
let delayIndex = 0;
let startingDate;
let nextPingTS;
function start() {
    startingDate = new Date().getTime();
    console.log("GAME START")
    let huntersTXT = ""
    let runnersTXT = ""
    for (const [ user, data ] of clientData) {
        if (data.role == "hunter") {
            huntersTXT += user+' '
        }else{
            runnersTXT += user+' '
        }
    }  
    

    gameStarted = true;
    notifyMH(`Hunters: ${huntersTXT}\nRunners: ${runnersTXT}`, "THE GAME HAS STARTED!", "https://georgeorfa015.github.io/indev/manhunt.html", "ALL", 3);
    pingTimeout = setTimeout(timer, delayList[delayIndex]*60*1000);
    nextPingTS = new Date().getTime() + delayList[delayIndex]*60*1000
    delayIndex += 1;
}

let lastPingTS;
let reminderTimeout;
function timer() {
    console.log("PING "+delayIndex)
    let allHunters = true;
    for (const [user, data] of clientData) {
        if (data.role == "runner") {
            allHunters = false;
        }
    }
    if (allHunters) {
        endGame(true);
    }else{
        notifyMH("The runners' locations will appear above this message for PING "+delayIndex, "PING "+delayIndex, "", "ALL", 1);
        for (const [user, data] of clientData) {
            if (data.role == "runner") {
                notifyMH("Please send your location via the website.", "PING TIME!","https://georgeorfa015.github.io/indev/manhunt.html", user, 4);
            }
        }
        lastPingTS = new Date().getTime();
        pingTimeout = setTimeout(timer, delayList[delayIndex]*60*1000);
        reminderTimeout = setTimeout(reminder, delayList[delayIndex]*60*1000*(60/100));
        nextPingTS = new Date().getTime() + delayList[delayIndex]*60*1000
        delayIndex+=1
        if (delayIndex >= delayList.length-1) {
            delayIndex = delayList.length-1
        }
    }
}

function reminder() {
    if (gameStarted) {

        let allHunters = true;
        for (const [user, data] of clientData) {
            if (data.role == "runner") {
                allHunters = false;
            }
        }
        if(!allHunters) {
            for (const [user, data] of clientData) {
                if (data.role == "runner") {
                    if (data.lastPingTS < lastPingTS) {
                        notifyMH("Please send your location via the website immediately!", "YOU'RE TAKING TOO LONG!","https://georgeorfa015.github.io/indev/manhunt.html", user, 5);
                    }
                }
            }
        }
    }
}




async function notifyMH(text, title, click, topic, priority) {
    try {
        const response = await fetch('https://ntfy.sh/GO15MH-'+topic, {
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

function endGame(notify) {
    console.log("GAME ENDED")
    clearTimeout(pingTimeout);
    clearTimeout(reminderTimeout);
    if (notify) notifyMH("Thanks for playing!", "THE GAME HAS ENDED.", "", "ALL", 3)
    clientData.clear();
    gameStarted = false;
    delayIndex = 0;
}