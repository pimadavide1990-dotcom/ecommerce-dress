import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import crypto from 'node:crypto';

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',') : true,
    credentials: true,
  })
);
app.use(express.json());

const DB_HOST = process.env.DB_HOST || process.env.MYSQLHOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || process.env.MYSQLPORT) || 3306;
const DB_USER = process.env.DB_USER || process.env.MYSQLUSER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD ?? process.env.MYSQLPASSWORD ?? '';
const DB_NAME = process.env.DB_NAME || process.env.MYSQLDATABASE || 'davide_shop';

const PRODOTTI_INIZIALI = [
  {
    titolo: 'Cappotto Sartoriale in Lana Vergine',
    categoria: 'Donna',
    descrizione: 'Linea avvolgente con revers classici e bottoni in corno, pensato per le giornate più fredde.',
    prezzo: 690,
    immagine: '/images/abito-sera.png',
  },
  {
    titolo: 'Abito Sera in Seta e Velluto',
    categoria: 'Donna',
    descrizione: 'Silhouette fluida con dettagli luminosi, ideale per serate d’inverno e cerimonie.',
    prezzo: 840,
    immagine: '/images/abito-sera.png',
  },
  {
    titolo: 'Giacca Doppiopetto in Flanella',
    categoria: 'Uomo',
    descrizione: 'Taglio sartoriale in pura lana pettinata con fodera traspirante e vestibilità contemporanea.',
    prezzo: 620,
    immagine: '/hero.jpg',
  },
  {
    titolo: 'Borsa a Mano in Pelle Martellata',
    categoria: 'Pelletteria',
    descrizione: 'Realizzata in vitello pieno fiore con manici rinforzati, tracolla removibile e scomparti interni.',
    prezzo: 550,
    immagine: '/images/abito-sera.png',
  },
  {
    titolo: 'Orecchini Scultura con Cristalli',
    categoria: 'Gioielleria',
    descrizione: 'Finitura dorata spazzolata e pietre sfaccettate per aggiungere luce a qualsiasi look.',
    prezzo: 240,
    immagine: '/images/abito-sera.png',
  },
  {
    titolo: 'Segnatempo Classico Cassa Acciaio',
    categoria: 'Orologi',
    descrizione: 'Quadrante essenziale con movimento di precisione e cinturino in pelle opaca.',
    prezzo: 980,
    immagine: '/hero.jpg',
  },
  {
    titolo: 'Eau de Parfum Ambra & Legni',
    categoria: 'Profumi e make-up',
    descrizione: 'Fragranza avvolgente con note di ambra grigia, vaniglia scura e sandalo.',
    prezzo: 165,
    immagine: '/images/abito-sera.png',
  },
  {
    titolo: 'Plaid in Cashmere e Lana',
    categoria: 'Casa e stile di vita',
    descrizione: 'Morbidezza estrema con frange rifinite a mano per decorare il soggiorno.',
    prezzo: 320,
    immagine: '/hero.jpg',
  },
  {
    titolo: 'Giubbotto Tecnico da Equitazione',
    categoria: 'Equitazione',
    descrizione: 'Tessuto idrorepellente e antivento con zip bidirezionale e tasche protette.',
    prezzo: 430,
    immagine: '/hero.jpg',
  },
  {
    titolo: 'Cofanetto Regalo Atelier Inverno',
    categoria: 'Regali',
    descrizione: 'Selezione esclusiva di accessori e fragranza in confezione dedicata Davide Shop.',
    prezzo: 290,
    immagine: '/images/abito-sera.png',
  },
];

let pool;

async function inizializzaDatabase() {
  const adminConn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
  });

  try {
    await adminConn.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await adminConn.end();
  }

  pool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS prodotti (
      id INT AUTO_INCREMENT PRIMARY KEY,
      titolo VARCHAR(255) NOT NULL,
      categoria VARCHAR(100) NOT NULL,
      descrizione TEXT NOT NULL,
      prezzo DECIMAL(10, 2) NOT NULL,
      immagine VARCHAR(255) NOT NULL,
      creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS borsa (
      id INT AUTO_INCREMENT PRIMARY KEY,
      prodotto_id INT NOT NULL,
      quantita INT NOT NULL DEFAULT 1,
      aggiornato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_borsa_prodotto
        FOREIGN KEY (prodotto_id) REFERENCES prodotti(id)
        ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ordini (
      id INT AUTO_INCREMENT PRIMARY KEY,
      riferimento_esterno VARCHAR(120) NULL,
      metodo_pagamento VARCHAR(100) NOT NULL DEFAULT 'PayPal Demo / Locale',
      totale DECIMAL(10, 2) NOT NULL,
      data DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS righe_ordine (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ordine_id INT NOT NULL,
      prodotto_id INT NULL,
      titolo VARCHAR(255) NOT NULL,
      prezzo DECIMAL(10, 2) NOT NULL,
      quantita INT NOT NULL,
      CONSTRAINT fk_righe_ordine
        FOREIGN KEY (ordine_id) REFERENCES ordini(id)
        ON DELETE CASCADE
    )
  `);

  const [[{ count }]] = await pool.query('SELECT COUNT(*) AS count FROM prodotti');
  if (Number(count) === 0) {
    const values = PRODOTTI_INIZIALI.map((p) => [
      p.titolo,
      p.categoria,
      p.descrizione,
      p.prezzo,
      p.immagine,
    ]);
    await pool.query(
      'INSERT INTO prodotti (titolo, categoria, descrizione, prezzo, immagine) VALUES ?',
      [values]
    );
  }
}

async function getBorsaFormattata() {
  const [rows] = await pool.query(`
    SELECT
      b.id,
      b.prodotto_id AS prodottoId,
      b.quantita,
      p.titolo,
      p.categoria,
      p.immagine,
      CAST(p.prezzo AS DOUBLE) AS prezzo
    FROM borsa b
    INNER JOIN prodotti p ON p.id = b.prodotto_id
    ORDER BY b.id ASC
  `);
  return rows;
}

async function getOrdiniFormattati() {
  const [ordiniRows] = await pool.query(`
    SELECT
      id,
      riferimento_esterno,
      metodo_pagamento AS metodoPagamento,
      CAST(totale AS DOUBLE) AS totale,
      data
    FROM ordini
    ORDER BY id ASC
  `);

  if (ordiniRows.length === 0) return [];

  const [righeRows] = await pool.query(`
    SELECT
      id,
      ordine_id,
      prodotto_id AS id_prodotto,
      titolo,
      CAST(prezzo AS DOUBLE) AS prezzo,
      quantita
    FROM righe_ordine
    ORDER BY id ASC
  `);

  const righePerOrdine = new Map();
  for (const riga of righeRows) {
    if (!righePerOrdine.has(riga.ordine_id)) {
      righePerOrdine.set(riga.ordine_id, []);
    }
    righePerOrdine.get(riga.ordine_id).push({
      id: riga.id_prodotto ?? riga.id,
      titolo: riga.titolo,
      prezzo: riga.prezzo,
      quantita: riga.quantita,
    });
  }

  return ordiniRows.map((o) => ({
    id: o.id,
    riferimentoEsterno: o.riferimento_esterno,
    metodoPagamento: o.metodoPagamento,
    totale: o.totale,
    data: o.data,
    articoli: righePerOrdine.get(o.id) || [],
  }));
}

// Prodotti
app.get('/api/prodotti', async (req, res) => {
  try {
    const { categoria, q } = req.query;
    const condizioni = [];
    const params = [];

    if (categoria && categoria !== 'Tutti') {
      condizioni.push('categoria = ?');
      params.push(String(categoria));
    }

    if (q && String(q).trim()) {
      const termine = `%${String(q).trim()}%`;
      condizioni.push('(titolo LIKE ? OR descrizione LIKE ? OR categoria LIKE ?)');
      params.push(termine, termine, termine);
    }

    let sql = `
      SELECT
        id,
        titolo,
        categoria,
        descrizione,
        CAST(prezzo AS DOUBLE) AS prezzo,
        immagine
      FROM prodotti
    `;

    if (condizioni.length > 0) {
      sql += ` WHERE ${condizioni.join(' AND ')}`;
    }

    sql += ' ORDER BY id ASC';

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('Errore GET /api/prodotti:', err);
    res.status(500).json({ errore: 'Errore durante il recupero dei prodotti' });
  }
});

// Borsa
app.get('/api/borsa', async (req, res) => {
  try {
    const borsa = await getBorsaFormattata();
    res.json(borsa);
  } catch (err) {
    console.error('Errore GET /api/borsa:', err);
    res.status(500).json({ errore: 'Errore durante il recupero della borsa' });
  }
});

app.post('/api/borsa', async (req, res) => {
  try {
    const prodottoId = Number(req.body?.prodottoId);
    if (!Number.isInteger(prodottoId) || prodottoId <= 0) {
      return res.status(400).json({ errore: 'ID prodotto non valido' });
    }

    const [[prodotto]] = await pool.query('SELECT id FROM prodotti WHERE id = ?', [prodottoId]);
    if (!prodotto) {
      return res.status(404).json({ errore: 'Prodotto non trovato' });
    }

    const [[esistente]] = await pool.query(
      'SELECT id, quantita FROM borsa WHERE prodotto_id = ? LIMIT 1',
      [prodottoId]
    );

    if (esistente) {
      await pool.query('UPDATE borsa SET quantita = quantita + 1 WHERE id = ?', [esistente.id]);
    } else {
      await pool.query('INSERT INTO borsa (prodotto_id, quantita) VALUES (?, 1)', [prodottoId]);
    }

    const borsa = await getBorsaFormattata();
    res.status(201).json(borsa);
  } catch (err) {
    console.error('Errore POST /api/borsa:', err);
    res.status(500).json({ errore: 'Errore durante l’aggiunta alla borsa' });
  }
});

app.patch('/api/borsa/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const delta = Number(req.body?.delta);

    if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(delta)) {
      return res.status(400).json({ errore: 'Parametri non validi' });
    }

    const [[riga]] = await pool.query('SELECT id, quantita FROM borsa WHERE id = ?', [id]);
    if (!riga) {
      return res.status(404).json({ errore: 'Articolo non trovato nella borsa' });
    }

    const nuovaQuantita = riga.quantita + delta;
    if (nuovaQuantita <= 0) {
      await pool.query('DELETE FROM borsa WHERE id = ?', [id]);
    } else {
      await pool.query('UPDATE borsa SET quantita = ? WHERE id = ?', [nuovaQuantita, id]);
    }

    const borsa = await getBorsaFormattata();
    res.json(borsa);
  } catch (err) {
    console.error('Errore PATCH /api/borsa/:id:', err);
    res.status(500).json({ errore: 'Errore durante l’aggiornamento della quantità' });
  }
});

app.delete('/api/borsa/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ errore: 'ID non valido' });
    }

    await pool.query('DELETE FROM borsa WHERE id = ?', [id]);
    const borsa = await getBorsaFormattata();
    res.json(borsa);
  } catch (err) {
    console.error('Errore DELETE /api/borsa/:id:', err);
    res.status(500).json({ errore: 'Errore durante la rimozione dalla borsa' });
  }
});

// Storico ordini
app.get('/api/ordini', async (req, res) => {
  try {
    const ordini = await getOrdiniFormattati();
    res.json(ordini);
  } catch (err) {
    console.error('Errore GET /api/ordini:', err);
    res.status(500).json({ errore: 'Errore durante il recupero degli ordini' });
  }
});

// Configurazione e Checkout PayPal
app.get('/api/paypal/config', (req, res) => {
  const clientId = process.env.PAYPAL_CLIENT_ID || null;
  const liveSandbox = Boolean(clientId);
  res.json({ liveSandbox, clientId });
});

app.post('/api/paypal/create-order', async (req, res) => {
  try {
    const articoliInput = Array.isArray(req.body?.articoli) ? req.body.articoli : [];
    const borsaDb = articoliInput.length > 0 ? articoliInput : await getBorsaFormattata();

    if (borsaDb.length === 0) {
      return res.status(400).json({ errore: 'La borsa è vuota' });
    }

    const totale = borsaDb.reduce(
      (acc, item) => acc + Number(item.prezzo || 0) * Number(item.quantita || 1),
      0
    );

    res.json({
      id: `DS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      status: 'CREATED',
      totale: Number(totale.toFixed(2)),
      currency: 'EUR',
      simulated: !process.env.PAYPAL_CLIENT_ID,
    });
  } catch (err) {
    console.error('Errore POST /api/paypal/create-order:', err);
    res.status(500).json({ errore: 'Errore durante la creazione dell’ordine PayPal' });
  }
});

app.post('/api/paypal/capture-order', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { orderID, simulated } = req.body || {};
    const articoliInput = Array.isArray(req.body?.articoli) ? req.body.articoli : [];

    await conn.beginTransaction();

    const [borsaRows] = await conn.query(`
      SELECT
        b.prodotto_id AS id,
        b.quantita,
        p.titolo,
        CAST(p.prezzo AS DOUBLE) AS prezzo
      FROM borsa b
      INNER JOIN prodotti p ON p.id = b.prodotto_id
      ORDER BY b.id ASC
    `);

    const articoliDaSalvare =
      borsaRows.length > 0
        ? borsaRows
        : articoliInput.map((a) => ({
            id: a.prodottoId ?? a.id ?? null,
            titolo: String(a.titolo || 'Articolo'),
            prezzo: Number(a.prezzo || 0),
            quantita: Number(a.quantita || 1),
          }));

    if (articoliDaSalvare.length === 0) {
      await conn.rollback();
      return res.status(400).json({ errore: 'Nessun articolo da confermare' });
    }

    const totale = articoliDaSalvare.reduce(
      (acc, item) => acc + Number(item.prezzo || 0) * Number(item.quantita || 1),
      0
    );

    const metodoPagamento =
      simulated || !process.env.PAYPAL_CLIENT_ID
        ? 'PayPal Demo / Locale'
        : 'PayPal Sandbox (SDK)';

    const [risultatoOrdine] = await conn.query(
      `INSERT INTO ordini (riferimento_esterno, metodo_pagamento, totale, data)
       VALUES (?, ?, ?, NOW())`,
      [orderID || null, metodoPagamento, Number(totale.toFixed(2))]
    );

    const ordineId = risultatoOrdine.insertId;

    for (const art of articoliDaSalvare) {
      await conn.query(
        `INSERT INTO righe_ordine (ordine_id, prodotto_id, titolo, prezzo, quantita)
         VALUES (?, ?, ?, ?, ?)`,
        [
          ordineId,
          Number.isInteger(Number(art.id)) ? Number(art.id) : null,
          String(art.titolo || 'Articolo'),
          Number(art.prezzo || 0),
          Number(art.quantita || 1),
        ]
      );
    }

    await conn.query('DELETE FROM borsa');
    await conn.commit();

    res.json({
      ok: true,
      ordineId,
      orderID: orderID || null,
      totale: Number(totale.toFixed(2)),
    });
  } catch (err) {
    await conn.rollback();
    console.error('Errore POST /api/paypal/capture-order:', err);
    res.status(500).json({ errore: 'Errore durante il salvataggio dell’ordine' });
  } finally {
    conn.release();
  }
});

inizializzaDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server Node avviato su http://localhost:${PORT} (MySQL: ${DB_NAME})`);
    });
  })
  .catch((err) => {
    console.error('Errore inizializzazione database MySQL:', err);
    process.exit(1);
  });