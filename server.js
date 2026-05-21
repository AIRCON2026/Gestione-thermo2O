const express = require('express');
const fs = require('fs');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname));
app.use(express.json());

const DB_FILE = 'dati.json';

// Funzione per leggere i dati dal file
function leggiDB() {
    if (!fs.existsSync(DB_FILE)) return { ordini: [] };
    const data = fs.readFileSync(DB_FILE);
    return JSON.parse(data);
}

// Funzione per salvare i dati sul file
function salvaDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Rotta principale
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));
app.get('/master', (req, res) => res.sendFile(__dirname + '/master.html'));

// Gestione socket
io.on('connection', (socket) => {
    // Quando arriva un nuovo ordine
    socket.on('nuovoOrdine', (ordine) => {
        const db = leggiDB();
        // Aggiungiamo l'orario preciso qui
        ordine.orario = new Date().toLocaleString('it-IT');
        ordine.spedito = false; 
        db.ordini.push(ordine);
        salvaDB(db);
        io.emit('aggiornaLista', db.ordini);
    });

    // Quando clicchi su "Spedito"
    socket.on('segnaSpedito', (index) => {
        const db = leggiDB();
        if (db.ordini[index]) {
            db.ordini[index].spedito = true;
            salvaDB(db);
            io.emit('aggiornaLista', db.ordini);
        }
    });

    // Caricamento iniziale
    socket.on('richiediDati', () => {
        socket.emit('aggiornaLista', leggiDB().ordini);
    });
});

const PORT = process.env.PORT || 10000;
http.listen(PORT, () => console.log('Server attivo sulla porta ' + PORT));
