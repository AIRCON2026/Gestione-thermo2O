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
        return JSON.parse(fs.readFileSync(FILE_DB, 'utf8'));
    }
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

// Rotte
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/master', (req, res) => res.sendFile(path.join(__dirname, 'master.html')));
app.get('/api/inventario', (req, res) => res.json(db.inventario));
app.get('/api/master/agenti', (req, res) => res.json(db.databaseAgenti));

// API Storico per Agente
app.get('/api/storico', (req, res) => {
    const agenteRichiedente = req.query.agente;
    let storicoFiltrato = [];
    for (const key in db.inventario) {
        const prod = db.inventario[key];
        const ordiniAgente = prod.ordiniClienti
            .filter(o => o.agente === agenteRichiedente)
            .map(o => ({
                data: o.timestamp,
                cliente: o.cliente,
                nomeProdotto: prod.nome
            }));
        storicoFiltrato = storicoFiltrato.concat(ordiniAgente);
    }
    storicoFiltrato.sort((a, b) => b.data - a.data);
    res.json(storicoFiltrato);
});

// Login
app.post('/api/login', (req, res) => {
    const u = req.body.username?.toLowerCase().trim();
    if (db.databaseAgenti[u] && db.databaseAgenti[u] === req.body.password) return res.json({ success: true });
    return res.status(401).json({ success: false });
});

app.post('/api/master/login', (req, res) => {
    if (req.body.password === "master2026") return res.json({ success: true });
    return res.status(401).json({ success: false });
});

// GESTIONE ORDINI
app.post('/api/ordine', (req, res) => {
    const { agente, cliente, modello, quantitaRichiesta } = req.body;
    const p = db.inventario[modello];
    
    if (p && p.quantita >= quantitaRichiesta) {
        p.quantita -= quantitaRichiesta;
        const now = new Date();
        const nuovoOrdine = {
            id: Date.now().toString(),
            cliente,
            quantita: quantitaRichiesta,
            agente,
            giorno: now.toLocaleDateString('it-IT'),
            ora: now.toLocaleTimeString('it-IT'),
            timestamp: now.getTime(),
            spedito: false
        };
        
        p.ordiniClienti.push(nuovoOrdine);
        salvaDB();
        
        io.emit('notifica_master', { tipo: 'SUCCESSO', messaggio: `🟢 ${agente} ha venduto ${quantitaRichiesta} pz a ${cliente}` });
        io.emit('aggiorna_magazzino', db.inventario);
        return res.json({ success: true });
    }
    return res.status(400).json({ errore: "PRODOTTO_NON_DISPONIBILE" });
});

// ELIMINAZIONE ORDINE CON RIPRISTINO SCORTE
app.post('/api/master/elimina-ordine', (req, res) => {
    const { modello, ordineId, password } = req.body;

    if (password !== "master2026") {
        return res.status(401).json({ errore: "Password errata" });
    }

    const p = db.inventario[modello];
    if (p) {
        const index = p.ordiniClienti.findIndex(o => o.id === ordineId);
        if (index !== -1) {
            const quantitaDaRipristinare = p.ordiniClienti[index].quantita;
            p.quantita += quantitaDaRipristinare;
            p.ordiniClienti.splice(index, 1);
            salvaDB();
            io.emit('aggiorna_magazzino', db.inventario);
            return res.json({ success: true });
        }
    }
    res.status(400).json({ errore: "Ordine non trovato" });
});

// GESTIONE STATO SPEDITO
app.post('/api/master/stato-spedizione', (req, res) => {
    const { modello, ordineId, spedito } = req.body;
    const p = db.inventario[modello];
    if (p) {
        const ordine = p.ordiniClienti.find(o => o.id === ordineId);
        if (ordine) {
            ordine.spedito = spedito;
            salvaDB();
            io.emit('aggiorna_magazzino', db.inventario);
            return res.json({ success: true });
        }
    }
    res.status(400).json({ success: false });
});

// Altre API Master
app.post('/api/master/agenti/salva', (req, res) => {
    db.databaseAgenti[req.body.username.toLowerCase().trim()] = req.body.password.trim();
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

app.post('/api/master/aggiungi-scorte', (req, res) => {
    db.inventario[req.body.modello].quantita = parseInt(req.body.nuovaQuantita);
    salvaDB();
    io.emit('aggiorna_magazzino', db.inventario);
    res.json({ success: true });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log('Server attivo sulla porta ' + PORT));
