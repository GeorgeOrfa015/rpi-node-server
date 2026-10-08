import 'dotenv/config';
import imapflow, { ImapFlow } from 'imapflow';
import { Router } from 'express';
let counts = {folders: []}; // filled by your IMAP polling code

async function fetchMail() {
    
    const c = new ImapFlow({
        host: 'mailhost.csd.uoc.gr',
        port: 993,
        secure: true,
        auth: {
            user: "csd6255@csd.uoc.gr",
            pass: process.env.MAIL_PASS
        }
    })
    await c.connect();
    counts = {folders: []}
    for (const box of await c.list()) {
        const s = await c.status(box.path, {messages: true, unseen: true});
        counts.folders.push({
            name: box.path,
            unread: s.unseen,
            messages: s.messages
        })
    }
    counts.lastFetch = new Date().getTime()
    await c.logout();
    console.log("Fetched UoC Mail")
}
setInterval(fetchMail, 10*60*1000)
fetchMail()




const router = Router();


router.get('/folders', (req, res) => {
    res.json(counts);
});

export default router;