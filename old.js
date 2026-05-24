import express from "express";
import cors from "cors";
const app = express();

app.use(cors());

//|  ENDPOINT /api/data  |//
app.get("/api/data", async (req, res) => {
    try {
        const response = await fetch("http://panchovilla5574.ddns.net:1616/api/states", {
            headers: {
                "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiIwZjQwNmU4MmI3YTc0NWY3OGM3ZGJjNWM1ZmE2MzI5OCIsImlhdCI6MTcwNTI1NjI3MiwiZXhwIjoyMDIwNjE2MjcyfQ.y9a2ZyXFYnbvbwIV4wuklNgioPC_2y5jqM_c3CizzPA"
            }
        });
    
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        res.json({
            success: true,
            data: data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

//|  ENDPOINT /api/test  |//
app.get("/api/test", (req, res) => {
    res.json({
        success: true,
        data: "Hello world!"
    })
})

//$  SERVER INITIALIZATION  $//
const PORT = 8080;

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

