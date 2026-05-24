import fs from 'fs'


function write(text){
    fs.writeFile('history.txt', text, {flag: "a+"}, err => {
        if (err) {
            return err;
        }
    });
}

function read() {
    try {
        const data = fs.readFileSync('history.txt', 'utf8');
        return data;
    } catch (err) {
        console.error(err);
    }
}
write(String(Math.random()))
