const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = 4000;

const DATA_DIR = path.join(__dirname, 'data');
const BORSA_FILE = path.join(DATA_DIR, 'borsa.json');
const ORDINI_FILE = path.join(DATA_DIR, 'ordini.json');

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PAYPAL_API_BASE =
  process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';

const paypalConfigurato = Boolean(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET);

app.use(
  cors({
    origin: ['http://localhost:5173', 'http://localhost:5174'],
  })
);
app.use(express.json());

const prodotti = [
  {
    id: 1,
    titolo: 'Cappotto in Pura Lana Vergine',
    categoria: 'Donna',
    prezzo: 890,
    descrizione: 'Taglio sartoriale avvolgente con rever a lancia e bottoni in corno naturale.',
    immagine:
      'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 2,
    titolo: 'Giacca Doppiopetto Sartoriale',
    categoria: 'Uomo',
    prezzo: 740,
    descrizione: 'Lana pettinata invernale con fodera in cupro traspirante e vestibilità pulita.',
    immagine:
      'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 3,
    titolo: 'Borsa a Mano in Vitello Liscio',
    categoria: 'Pelletteria',
    prezzo: 620,
    descrizione: 'Lavorazione artigianale con finiture in metallo satinato e tracolla removibile.',
    immagine:
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 4,
    titolo: 'Collana Maglia Scultura Oro',
    categoria: 'Gioielleria',
    prezzo: 340,
    descrizione: 'Maglie ovali lucide con chiusura a moschettone regolabile.',
    immagine:
      'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 5,
    titolo: 'Segnatempo Quadrante Antracite',
    categoria: 'Orologi',
    prezzo: 1150,
    descrizione: 'Cassa in acciaio spazzolato, vetro zaffiro e cinturino in pelle opaca.',
    immagine:
      'https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 6,
    titolo: 'Extrait de Parfum Bois d’Hiver',
    categoria: 'Profumi e make-up',
    prezzo: 185,
    descrizione: 'Note di testa speziate con cuore di cedro affumicato, ambra e fava tonka.',
    immagine:
      'https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=900&q=80',
  },
  
  {
    id: 8,
    titolo: 'Stivali da Scuderia in Cuoio',
    categoria: 'Equitazione',
    prezzo: 560,
    descrizione: 'Pelle pieno fiore resistente con suola cucita e linea essenziale.',
    immagine:
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 9,
    titolo: 'Cofanetto Regalo Cashmere & Seta',
    categoria: 'Regali',
    prezzo: 290,
    descrizione: 'Sciarpa morbida in filato misto cashmere presentata in scatola rigida.',
    immagine:
      'https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 10,
    titolo: 'Abito da Sera Elegante',
    categoria: 'Donna',
    prezzo: 990,
    descrizione: 'Abito lungo in tessuto nero impreziosito da dettagli luminosi, linea elegante e spacco laterale.',
    immagine: '/images/abito-sera.png',
  },
];

async function assicuraFileJson(filePath) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, '[]', 'utf-8');
  }
}

async function leggiJson(filePath) {
  await assicuraFileJson(filePath);
  const contenuto = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(contenuto);
}

async function scriviJson(filePath, dati) {
  await assicuraFileJson(filePath);
  await fs.writeFile(filePath, JSON.stringify(dati, null, 2), 'utf-8');
}

async function getPayPalAccessToken() {
  const auth = Buffer.from(
    `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    throw new Error('Impossibile ottenere il token PayPal');
  }

  const data = await res.json();
  return data.access_token;
}

// Prodotti con filtro per categoria e ricerca testuale
app.get('/api/prodotti', (req, res) => {
  const { categoria, q } = req.query;
  let risultati = [...prodotti];

  if (categoria && categoria !== 'Tutti') {
    risultati = risultati.filter(
      (item) => item.categoria.toLowerCase() === String(categoria).toLowerCase()
    );
  }

  if (q && String(q).trim() !== '') {
    const termine = String(q).trim().toLowerCase();
    risultati = risultati.filter(
      (item) =>
        item.titolo.toLowerCase().includes(termine) ||
        item.descrizione.toLowerCase().includes(termine) ||
        item.categoria.toLowerCase().includes(termine)
    );
  }

  res.json(risultati);
});

// Borsa / Carrello persistente su borsa.json
app.get('/api/borsa', async (req, res) => {
  try {
    const borsa = await leggiJson(BORSA_FILE);
    res.json(borsa);
  } catch (err) {
    console.error('Errore lettura borsa:', err);
    res.status(500).json({ errore: 'Errore durante il recupero della borsa' });
  }
});

app.post('/api/borsa', async (req, res) => {
  try {
    const prodottoId = Number(req.body.prodottoId);
    const prodotto = prodotti.find((item) => item.id === prodottoId);

    if (!prodotto) {
      return res.status(404).json({ errore: 'Prodotto non trovato' });
    }

    const borsa = await leggiJson(BORSA_FILE);
    const esistente = borsa.find((item) => item.id === prodottoId);

    if (esistente) {
      esistente.quantita += 1;
    } else {
      borsa.push({
        id: prodotto.id,
        titolo: prodotto.titolo,
        prezzo: prodotto.prezzo,
        quantita: 1,
      });
    }

    await scriviJson(BORSA_FILE, borsa);
    res.status(201).json(borsa);
  } catch (err) {
    console.error('Errore aggiunta borsa:', err);
    res.status(500).json({ errore: 'Errore durante l’aggiunta alla borsa' });
  }
});

app.patch('/api/borsa/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const delta = Number(req.body.delta);

    if (!Number.isFinite(delta) || delta === 0) {
      return res.status(400).json({ errore: 'Valore delta non valido' });
    }

    let borsa = await leggiJson(BORSA_FILE);
    const item = borsa.find((entry) => entry.id === id);

    if (!item) {
      return res.status(404).json({ errore: 'Articolo non trovato nella borsa' });
    }

    item.quantita += delta;

    if (item.quantita <= 0) {
      borsa = borsa.filter((entry) => entry.id !== id);
    }

    await scriviJson(BORSA_FILE, borsa);
    res.json(borsa);
  } catch (err) {
    console.error('Errore aggiornamento quantità:', err);
    res.status(500).json({ errore: 'Errore durante l’aggiornamento della quantità' });
  }
});

app.delete('/api/borsa/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const borsa = await leggiJson(BORSA_FILE);
    const aggiornata = borsa.filter((entry) => entry.id !== id);

    await scriviJson(BORSA_FILE, aggiornata);
    res.json(aggiornata);
  } catch (err) {
    console.error('Errore rimozione borsa:', err);
    res.status(500).json({ errore: 'Errore durante la rimozione dalla borsa' });
  }
});

// Ordini salvati su ordini.json
app.get('/api/ordini', async (req, res) => {
  try {
    const ordini = await leggiJson(ORDINI_FILE);
    res.json(ordini);
  } catch (err) {
    console.error('Errore lettura ordini:', err);
    res.status(500).json({ errore: 'Errore durante il recupero degli ordini' });
  }
});

app.post('/api/ordini', async (req, res) => {
  try {
    const borsaSalvata = await leggiJson(BORSA_FILE);
    const articoliSorgente =
      Array.isArray(req.body.articoli) && req.body.articoli.length > 0
        ? req.body.articoli
        : borsaSalvata;

    if (!Array.isArray(articoliSorgente) || articoliSorgente.length === 0) {
      return res.status(400).json({ errore: 'La borsa è vuota' });
    }

    const articoliNormalizzati = articoliSorgente.map((item) => ({
      id: Number(item.id),
      titolo: String(item.titolo),
      prezzo: Number(item.prezzo),
      quantita: Number(item.quantita),
    }));

    const totale = articoliNormalizzati.reduce(
      (acc, item) => acc + item.prezzo * item.quantita,
      0
    );

    const nuovoOrdine = {
      id: Date.now(),
      data: new Date().toISOString(),
      articoli: articoliNormalizzati,
      totale,
    };

    const ordini = await leggiJson(ORDINI_FILE);
    ordini.push(nuovoOrdine);
    await scriviJson(ORDINI_FILE, ordini);
    await scriviJson(BORSA_FILE, []);

    res.status(201).json(nuovoOrdine);
  } catch (err) {
    console.error('Errore salvataggio ordine:', err);
    res.status(500).json({ errore: 'Errore interno del server' });
  }
});

// Configurazione PayPal
app.get('/api/paypal/config', (req, res) => {
  res.json({
    liveSandbox: paypalConfigurato,
    clientId: paypalConfigurato ? PAYPAL_CLIENT_ID : null,
  });
});

// 1) Crea ordine PayPal (reale su Sandbox se configurato, altrimenti simulato)
app.post('/api/paypal/create-order', async (req, res) => {
  try {
    const borsaSalvata = await leggiJson(BORSA_FILE);
    const articoli =
      Array.isArray(req.body.articoli) && req.body.articoli.length > 0
        ? req.body.articoli
        : borsaSalvata;

    if (!Array.isArray(articoli) || articoli.length === 0) {
      return res.status(400).json({ errore: 'La borsa è vuota' });
    }

    const totale = articoli.reduce(
      (acc, item) => acc + Number(item.prezzo) * Number(item.quantita),
      0
    );

    if (!paypalConfigurato) {
      return res.json({
        id: `PAYPAL-DEMO-${Date.now()}`,
        simulated: true,
        totale,
      });
    }

    const accessToken = await getPayPalAccessToken();
    const orderRes = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            description: 'Ordine Davide Shop',
            amount: {
              currency_code: 'EUR',
              value: totale.toFixed(2),
            },
          },
        ],
      }),
    });

    if (!orderRes.ok) {
      const errText = await orderRes.text();
      console.error('Errore create-order PayPal:', errText);
      return res.status(502).json({ errore: 'Errore creazione ordine PayPal' });
    }

    const orderData = await orderRes.json();
    res.json({ id: orderData.id, simulated: false, totale });
  } catch (err) {
    console.error('Errore PayPal create-order:', err);
    res.status(500).json({ errore: 'Errore interno durante creazione ordine PayPal' });
  }
});

// 2) Cattura / conferma pagamento PayPal e salva l'ordine in ordini.json
app.post('/api/paypal/capture-order', async (req, res) => {
  try {
    const { orderID, articoli: articoliBody, simulated } = req.body;
    const borsaSalvata = await leggiJson(BORSA_FILE);
    const articoliSorgente =
      Array.isArray(articoliBody) && articoliBody.length > 0
        ? articoliBody
        : borsaSalvata;

    if (!orderID) {
      return res.status(400).json({ errore: 'orderID mancante' });
    }

    if (!Array.isArray(articoliSorgente) || articoliSorgente.length === 0) {
      return res.status(400).json({ errore: 'Nessun articolo da registrare' });
    }

    let paypalStato = 'COMPLETED (SIMULATED)';

    if (!simulated && paypalConfigurato) {
      const accessToken = await getPayPalAccessToken();
      const captureRes = await fetch(
        `${PAYPAL_API_BASE}/v2/checkout/orders/${encodeURIComponent(orderID)}/capture`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!captureRes.ok) {
        const errText = await captureRes.text();
        console.error('Errore capture-order PayPal:', errText);
        return res.status(400).json({ errore: 'Pagamento PayPal non completato' });
      }

      const captureData = await captureRes.json();
      paypalStato = captureData.status || 'COMPLETED';
    }

    const articoliNormalizzati = articoliSorgente.map((item) => ({
      id: Number(item.id),
      titolo: String(item.titolo),
      prezzo: Number(item.prezzo),
      quantita: Number(item.quantita),
    }));

    const totale = articoliNormalizzati.reduce(
      (acc, item) => acc + item.prezzo * item.quantita,
      0
    );

    const nuovoOrdine = {
      id: Date.now(),
      data: new Date().toISOString(),
      metodoPagamento: simulated || !paypalConfigurato ? 'PayPal (Demo)' : 'PayPal Sandbox',
      paypalOrderId: orderID,
      paypalStato,
      articoli: articoliNormalizzati,
      totale,
    };

    const ordini = await leggiJson(ORDINI_FILE);
    ordini.push(nuovoOrdine);
    await scriviJson(ORDINI_FILE, ordini);
    await scriviJson(BORSA_FILE, []);

    res.status(201).json(nuovoOrdine);
  } catch (err) {
    console.error('Errore PayPal capture-order:', err);
    res.status(500).json({ errore: 'Errore interno durante la conferma PayPal' });
  }
});

app.listen(PORT, () => {
  console.log(`Server Node avviato su http://localhost:${PORT}`);
});