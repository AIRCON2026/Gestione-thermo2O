const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());

// --- LOGICA SALVATAGGIO ---
const FILE_DB = './dati.json';

function caricaDB() {
    if (fs.existsSync(FILE_DB)) {
        return JSON.parse(fs.readFileSync(FILE_DB, 'utf8'));
    }
    return {
        inventario: {
            "prod1": { nome: "tHermo 2O 100 LT a parete WiFi", quantita: 10, ordiniClienti: [], ordiniInAttesa: [] },
            "prod2": { nome: "tHermo 2O 150 LT a parete WiFi", quantita: 10, ordiniClienti: [], ordiniInAttesa: [] },
            "prod3": { nome: "tHermo 2O 200 LT a pavimento con serpentina WiFi", quantita: 10, ordiniClienti: [], ordiniInAttesa: [] },
            "prod4": { nome: "tHermo 2O 200 LT a pavimento WiFi", quantita: 10, ordiniClienti: [], ordiniInAttesa: [] },
            "prod5": { nome: "tHermo 2O 300 LT a pavimento con serpentina WiFi", quantita: 10, ordiniClienti: [], ordiniInAttesa: [] },
            "prod6": { nome: "tHermo 2O 300 LT a pavimento WiFi", quantita: 10, ordiniClienti: [], ordiniInAttesa: [] }
        },
        databaseAgenti: { "rosario": "pass123" }
    };
}

let db = caricaDB();

function salvaDB() {
    fs.writeFileSync(FILE_DB, JSON.stringify(db, null, 2));
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/master', (req, res) => res.sendFile(path.join(__dirname, 'master.html')));

app.get('/api/inventario', (req, res) => res.json(db.inventario));
app.get('/api/master/agenti', (req, res) => res.json(db.databaseAgenti));

app.post('/api/master/agenti/salva', (req, res) => {
    const { username, password } = req.body;
    db.databaseAgenti[username.toLowerCase().trim()] = password.trim();
    salvaDB();
    io.emit('aggiorna_agenti_live', db.databaseAgenti);
    return res.json({ success: true });
});

app.post('/api/master/agenti/elimina', (req, res) => {
    delete db.databaseAgenti[req.body.username];
    salvaDB();
    io.emit('aggiorna_agenti_live', db.databaseAgenti);
    return res.json({ success: true });
});

app.post('/api/login', (req, res) => {
    const u = req.body.username?.toLowerCase().trim();
    if (db.databaseAgenti[u] && db.databaseAgenti[u] === req.body.password) return res.json({ success: true });
    return res.status(401).json({ success: false });
});

app.post('/api/master/login', (req, res) => {
    if (req.body.password === "master2026") return res.json({ success: true });
    return res.status(401).json({ success: false });
});

app.post('/api/ordine', (req, res) => {
    const { agente, cliente, modello, quantitaRichiesta } = req.body;
    const p = db.inventario[modello];
    
    // Logica ordini in attesa (il tuo file originale non li aveva, qui li ho aggiunti per sicurezza)
    if (p.quantita < quantitaRichiesta) {
        p.ordiniInAttesa.push({ cliente, quantita: quantitaRichiesta, agente, giorno: new Date().toLocaleDateString() });
        io.emit('notifica_master', { tipo: 'ATTENZIONE', messaggio: `⚠️ ${agente} in attesa: ${cliente}` });
    } else {
        p.quantita -= quantitaRichiesta;
        p.ordiniClienti.push({ cliente, quantita: quantitaRichiesta, agente, giorno: new Date().toLocaleDateString() });
        io.emit('notifica_master', { tipo: 'SUCCESSO', messaggio: `🟢 ${agente} ha venduto a ${cliente}` });
    }
    salvaDB();
    io.emit('aggiorna_magazzino', db.inventario);
    res.json({ success: true });
});

app.post('/api/master/aggiungi-scorte', (req, res) => {
    db.inventario[req.body.modello].quantita = parseInt(req.body.nuovaQuantita);
    salvaDB();
    io.emit('aggiorna_magazzino', db.inventario);
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server attivo sulla porta ' + PORT));