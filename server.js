const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static(__dirname));

const FILE_DB = './dati.json';

function caricaDB() {
    if (fs.existsSync(FILE_DB)) {
        try {
            return JSON.parse(fs.readFileSync(FILE_DB, 'utf8'));
        } catch (e) { console.error("Errore lettura DB"); }
    }
    // Struttura iniziale completa
    return {
        inventario: {
            "prod1": { nome: "tHermo 2O 100 LT a parete WiFi", quantita: 10, ordiniClienti: [] },
            "prod2": { nome: "tHermo 2O 150 LT a parete WiFi", quantita: 10, ordiniClienti: [] },
            "prod3": { nome: "tHermo 2O 200 LT a pavimento con serpentina WiFi", quantita: 10, ordiniClienti: [] },
            "prod4": { nome: "tHermo 2O 200 LT a pavimento WiFi", quantita: 10, ordiniClienti: [] },
            "prod5": { nome: "tHermo 2O 300 LT a pavimento con serpentina WiFi", quantita: 10, ordiniClienti: [] },
            "prod6": { nome: "tHermo 2O 300 LT a pavimento WiFi", quantita: 10, ordiniClienti: [] }
        },
        databaseAgenti: { "rosario": "pass123" }
    };
}

let db = caricaDB();

function salvaDB() {
    fs.writeFileSync(FILE_DB, JSON.stringify(db, null, 2));
}

// --- ROTTE ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/master', (req, res) => res.sendFile(path.join(__dirname, 'master.html')));
app.get('/api/inventario', (req, res) => res.json(db.inventario));

// API ORDINE (Corretta per gestire spedizione e orario)
app.post('/api/ordine', (req, res) => {
    const { agente, cliente, modello, quantitaRichiesta } = req.body;
    const p = db.inventario[modello];
    
    if (p) {
        const nuovoOrdine = {
            cliente,
            quantita: quantitaRichiesta,
            agente,
            orario: new Date().toLocaleString('it-IT'),
            spedito: false
        };
        
        p.ordiniClienti.push(nuovoOrdine);
        salvaDB();
        io.emit('aggiorna_magazzino', db.inventario);
        return res.json({ success: true });
    }
    res.status(400).json({ success: false });
});

// API PER SEGNARE COME SPEDITO
app.post('/api/master/spedito', (req, res) => {
    const { modello, index } = req.body;
    if (db.inventario[modello] && db.inventario[modello].ordiniClienti[index]) {
        db.inventario[modello].ordiniClienti[index].spedito = true;
        salvaDB();
        io.emit('aggiorna_magazzino', db.inventario);
        return res.json({ success: true });
    }
    res.status(400).json({ success: false });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log('Server attivo sulla porta ' + PORT));
