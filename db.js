import mysql from 'mysql2/promise';

const {
  DB_HOST = 'localhost',
  DB_PORT = '3306',
  DB_NAME = 'davide_shop',
  DB_USER = 'root',
  DB_PASSWORD = '',
} = process.env;

export const pool = mysql.createPool({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const PRODOTTI_INIZIALI = [
  {
    titolo: 'Cappotto in Pura Lana Vergine',
    categoria: 'Donna',
    prezzo: 890.0,
    descrizione: 'Taglio sartoriale avvolgente con revers a lancia e bottoni in corno naturale.',
    immagine: '/prodotti/cappotto-donna.jpg',
    stock: 10,
  },
  {
    titolo: 'Giacca Doppiopetto Sartoriale',
    categoria: 'Uomo',
    prezzo: 740.0,
    descrizione: 'Lana pettinata invernale con fodera in cupro traspirante e vestibilità pulita.',
    immagine: '/prodotti/giacca-uomo.jpg',
    stock: 8,
  },
  {
    titolo: 'Candela Profumata Legni & Muschio',
    categoria: 'Casa e stile di vita',
    prezzo: 95.0,
    descrizione: 'Cera vegetale in bicchiere in vetro fumé con fragranza avvolgente per la casa.',
    immagine: '/prodotti/candela-casa.jpg',
    stock: 25,
  },
  {
    titolo: 'Stivali da Scuderia in Cuoio',
    categoria: 'Equitazione',
    prezzo: 560.0,
    descrizione: 'Pelle pieno fiore resistente con suola cucita e linea essenziale.',
    immagine: '/prodotti/stivali-equitazione.jpg',
    stock: 6,
  },
  {
    titolo: 'Cofanetto Regalo Cashmere & Seta',
    categoria: 'Regali',
    prezzo: 290.0,
    descrizione: 'Sciarpa morbida in filato misto cashmere presentata in scatola rigida.',
    immagine: '/prodotti/cofanetto-regalo.jpg',
    stock: 15,
  },
];

export async function inizializzaDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS prodotti (
      id INT AUTO_INCREMENT PRIMARY KEY,
      titolo VARCHAR(180) NOT NULL,
      categoria VARCHAR(100) NOT NULL,
      prezzo DECIMAL(10, 2) NOT NULL,
      descrizione TEXT NOT NULL,
      immagine VARCHAR(255) NOT NULL,
      stock INT NOT NULL DEFAULT 0,
      attivo BOOLEAN NOT NULL DEFAULT TRUE,
      creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ordini (
      id VARCHAR(64) PRIMARY KEY,
      riferimento_paypal VARCHAR(128) NULL,
      metodo_pagamento VARCHAR(60) NOT NULL,
      stato_pagamento VARCHAR(40) NOT NULL DEFAULT 'PAGATO',
      totale DECIMAL(10, 2) NOT NULL,
      creato_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS righe_ordine (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ordine_id VARCHAR(64) NOT NULL,
      prodotto_id INT NOT NULL,
      titolo_prodotto VARCHAR(180) NOT NULL,
      prezzo_unitario DECIMAL(10, 2) NOT NULL,
      quantita INT NOT NULL,
      CONSTRAINT fk_righe_ordine_ordine
        FOREIGN KEY (ordine_id) REFERENCES ordini(id) ON DELETE CASCADE,
      CONSTRAINT fk_righe_ordine_prodotto
        FOREIGN KEY (prodotto_id) REFERENCES prodotti(id)
    )
  `);

  const [rows] = await pool.query('SELECT COUNT(*) AS totale FROM prodotti');
  if (Number(rows[0]?.totale || 0) === 0) {
    const sqlInsert = `
      INSERT INTO prodotti (titolo, categoria, prezzo, descrizione, immagine, stock)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    for (const p of PRODOTTI_INIZIALI) {
      await pool.query(sqlInsert, [
        p.titolo,
        p.categoria,
        p.prezzo,
        p.descrizione,
        p.immagine,
        p.stock,
      ]);
    }
  }
}