import { useEffect, useRef, useState } from 'react';

const CATEGORIE = [
  'Tutti',
  'Donna',
  'Uomo',
  'Pelletteria',
  'Gioielleria',
  'Orologi',
  'Profumi e make-up',
  'Casa e stile di vita',
  'Equitazione',
  'Regali',
];

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const HERO_BG = '/hero.jpg';
const LOGO_SRC = '/logo.png';

export default function App() {
  const [prodotti, setProdotti] = useState([]);
  const [categoriaAttiva, setCategoriaAttiva] = useState('Tutti');
  const [ricerca, setRicerca] = useState('');
  const [borsa, setBorsa] = useState([]);
  const [borsaAperta, setBorsaAperta] = useState(false);
  const [menuMobileAperto, setMenuMobileAperto] = useState(false);
  const [prodottoSelezionato, setProdottoSelezionato] = useState(null);
  const [ordineInviato, setOrdineInviato] = useState(false);
  const [ordini, setOrdini] = useState([]);
  const [ordiniAperti, setOrdiniAperti] = useState(false);

  const [paypalConfig, setPaypalConfig] = useState({ liveSandbox: false, clientId: null });
  const [sdkPronto, setSdkPronto] = useState(false);
  const [paypalAperta, setPaypalAperta] = useState(false);
  const [paypalOrder, setPaypalOrder] = useState(null);
  const [paypalInCorso, setPaypalInCorso] = useState(false);
  const [paypalErrore, setPaypalErrore] = useState('');

  const paypalButtonsRef = useRef(null);
  const borsaRef = useRef([]);
  borsaRef.current = borsa;

  const caricaProdotti = async (cat = categoriaAttiva, query = ricerca) => {
    try {
      const params = new URLSearchParams();
      if (cat && cat !== 'Tutti') params.set('categoria', cat);
      if (query.trim()) params.set('q', query.trim());

      const res = await fetch(`${API_URL}/api/prodotti?${params.toString()}`);
      const data = await res.json();
      setProdotti(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Errore caricamento prodotti:', err);
    }
  };

  const caricaBorsa = async () => {
    try {
      const res = await fetch(`${API_URL}/api/borsa`);
      const data = await res.json();
      setBorsa(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Errore caricamento borsa:', err);
    }
  };

  const caricaOrdini = async () => {
    try {
      const res = await fetch(`${API_URL}/api/ordini`);
      const data = await res.json();
      setOrdini(Array.isArray(data) ? [...data].reverse() : []);
    } catch (err) {
      console.error('Errore caricamento ordini:', err);
    }
  };

  const caricaConfigPayPal = async () => {
    try {
      const res = await fetch(`${API_URL}/api/paypal/config`);
      if (!res.ok) return;
      const cfg = await res.json();
      setPaypalConfig({
        liveSandbox: Boolean(cfg.liveSandbox),
        clientId: cfg.clientId || null,
      });
    } catch (err) {
      console.error('Errore lettura configurazione PayPal:', err);
    }
  };

  useEffect(() => {
    caricaProdotti();
    caricaBorsa();
    caricaOrdini();
    caricaConfigPayPal();
  }, []);

  useEffect(() => {
    if (!paypalConfig.clientId) {
      setSdkPronto(false);
      return;
    }

    if (window.paypal && window.paypal.Buttons) {
      setSdkPronto(true);
      return;
    }

    const scriptId = 'paypal-js-sdk';
    const esistente = document.getElementById(scriptId);
    if (esistente) {
      esistente.addEventListener('load', () => setSdkPronto(true));
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
      paypalConfig.clientId
    )}&currency=EUR`;
    script.async = true;
    script.onload = () => setSdkPronto(true);
    script.onerror = () => {
      console.error('Impossibile caricare il PayPal JS SDK');
      setSdkPronto(false);
    };
    document.body.appendChild(script);
  }, [paypalConfig.clientId]);

  const gestisciCategoria = (cat) => {
    setCategoriaAttiva(cat);
    caricaProdotti(cat, ricerca);
  };

  const gestisciRicerca = (e) => {
    const valore = e.target.value;
    setRicerca(valore);
    caricaProdotti(categoriaAttiva, valore);
  };

  const aggiungiAllaBorsa = async (prodottoId) => {
    try {
      const res = await fetch(`${API_URL}/api/borsa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prodottoId }),
      });
      const aggiornata = await res.json();
      setBorsa(Array.isArray(aggiornata) ? aggiornata : []);
      setOrdineInviato(false);
      setBorsaAperta(true);
    } catch (err) {
      console.error('Errore aggiunta borsa:', err);
    }
  };

  const aggiornaQuantita = async (id, delta) => {
    try {
      const res = await fetch(`${API_URL}/api/borsa/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta }),
      });
      const aggiornata = await res.json();
      setBorsa(Array.isArray(aggiornata) ? aggiornata : []);
    } catch (err) {
      console.error('Errore aggiornamento quantità:', err);
    }
  };

  const rimuoviDallaBorsa = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/borsa/${id}`, {
        method: 'DELETE',
      });
      const aggiornata = await res.json();
      setBorsa(Array.isArray(aggiornata) ? aggiornata : []);
    } catch (err) {
      console.error('Errore rimozione borsa:', err);
    }
  };

  const catturaOrdineSulBackend = async (orderID, simulated = false) => {
    const res = await fetch(`${API_URL}/api/paypal/capture-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderID,
        simulated,
        articoli: borsaRef.current,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.errore || 'Pagamento non completato');
    }

    setBorsa([]);
    setOrdineInviato(true);
    setPaypalAperta(false);
    setPaypalOrder(null);
    await caricaOrdini();
  };

  const avviaPagamentoPayPal = async () => {
    if (borsa.length === 0) return;
    setPaypalErrore('');
    setPaypalInCorso(true);
    setPaypalAperta(true);

    try {
      const res = await fetch(`${API_URL}/api/paypal/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articoli: borsa }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.errore || 'Impossibile avviare il pagamento PayPal');
      }

      setPaypalOrder(data);
    } catch (err) {
      console.error('Errore avvio PayPal:', err);
      setPaypalErrore(err.message || 'Errore durante la creazione dell’ordine PayPal');
    } finally {
      setPaypalInCorso(false);
    }
  };

  const completaPagamentoPayPalDemo = async () => {
    if (!paypalOrder) return;
    setPaypalErrore('');
    setPaypalInCorso(true);

    try {
      await catturaOrdineSulBackend(paypalOrder.id, Boolean(paypalOrder.simulated));
    } catch (err) {
      console.error('Errore conferma PayPal:', err);
      setPaypalErrore(err.message || 'Errore durante la conferma del pagamento');
    } finally {
      setPaypalInCorso(false);
    }
  };

  useEffect(() => {
    if (
      !paypalAperta ||
      !paypalConfig.clientId ||
      !sdkPronto ||
      !window.paypal ||
      !window.paypal.Buttons ||
      !paypalButtonsRef.current
    ) {
      return;
    }

    paypalButtonsRef.current.innerHTML = '';

    window.paypal
      .Buttons({
        createOrder: async () => {
          setPaypalErrore('');
          const res = await fetch(`${API_URL}/api/paypal/create-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ articoli: borsaRef.current }),
          });
          const data = await res.json();
          if (!res.ok || !data.id) {
            throw new Error(data.errore || 'Errore creazione ordine PayPal');
          }
          setPaypalOrder(data);
          return data.id;
        },
        onApprove: async (data) => {
          setPaypalInCorso(true);
          setPaypalErrore('');
          try {
            await catturaOrdineSulBackend(data.orderID, false);
          } catch (err) {
            setPaypalErrore(err.message || 'Errore durante la cattura del pagamento');
          } finally {
            setPaypalInCorso(false);
          }
        },
        onError: (err) => {
          console.error('Errore PayPal SDK:', err);
          setPaypalErrore('Si è verificato un errore durante il pagamento con PayPal.');
        },
      })
      .render(paypalButtonsRef.current);
  }, [paypalAperta, paypalConfig.clientId, sdkPronto]);

  const totaleArticoli = borsa.reduce((acc, item) => acc + item.quantita, 0);
  const totaleEuro = borsa.reduce((acc, item) => acc + item.prezzo * item.quantita, 0);

  return (
    <div
      id="top"
      className="min-h-screen w-full overflow-x-clip bg-[#0a0d0e] text-[#f4f5f6] font-serif flex flex-col"
    >
      {/* Hero a schermo intero scalabile */}
      <section
        className="relative min-h-[540px] sm:min-h-[640px] lg:min-h-screen bg-cover bg-center flex flex-col justify-between px-4 sm:px-8 lg:px-12 py-5 sm:py-6 pb-8 sm:pb-12"
        style={{ backgroundImage: `url(${HERO_BG})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/25 to-black/75" />

        <div className="relative z-10 max-w-7xl w-full mx-auto flex flex-col gap-4 sm:gap-5">
          <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
            <div className="hidden lg:flex items-center gap-2 border-b border-white/75 pb-1.5 w-60">
              <span className="text-sm opacity-90 shrink-0">🔍</span>
              <input
                type="text"
                value={ricerca}
                onChange={gestisciRicerca}
                placeholder="Cerca"
                className="w-full min-w-0 bg-transparent text-sm text-white placeholder:text-white/85 focus:outline-none"
              />
            </div>

            <a
              href="#top"
              className="col-start-2 flex items-center justify-center shrink-0"
            >
              <img
                src={LOGO_SRC}
                alt="Davide Shop - Clothing & Style"
                className="h-11 sm:h-14 lg:h-16 w-auto max-w-[130px] sm:max-w-[190px] object-contain brightness-0 invert"
              />
            </a>

            {/* Pulsante hamburger classico a 3 linee in alto a destra su mobile e tablet */}
            <div className="col-start-3 flex lg:hidden items-center justify-end shrink-0">
              <button
                type="button"
                aria-label="Apri menu"
                onClick={() => setMenuMobileAperto(true)}
                className="border border-white/50 p-2 sm:p-2.5 text-white hover:bg-white hover:text-black transition cursor-pointer flex flex-col justify-center items-center gap-1"
              >
                <span className="block w-4 sm:w-5 h-[1.5px] bg-current" />
                <span className="block w-4 sm:w-5 h-[1.5px] bg-current" />
                <span className="block w-4 sm:w-5 h-[1.5px] bg-current" />
              </button>
            </div>

            {/* Pulsanti Ordini e Borsa su desktop */}
            <div className="hidden lg:flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  caricaOrdini();
                  setOrdiniAperti(true);
                }}
                className="border border-white/50 px-3.5 py-1.5 text-xs tracking-widest uppercase whitespace-nowrap hover:bg-white hover:text-black transition cursor-pointer"
              >
                Ordini ({ordini.length})
              </button>

              <button
                type="button"
                onClick={() => setBorsaAperta(true)}
                className="border border-white/50 px-3.5 py-1.5 text-xs tracking-widest uppercase whitespace-nowrap hover:bg-white hover:text-black transition cursor-pointer"
              >
                Borsa ({totaleArticoli})
              </button>
            </div>
          </header>

          {/* Voci del menu visibili solo da desktop (lg+) */}
          <nav className="hidden lg:flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-1 max-w-4xl mx-auto w-full">
            {CATEGORIE.slice(1).map((cat) => {
              const attiva = categoriaAttiva === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => gestisciCategoria(attiva ? 'Tutti' : cat)}
                  className={`text-xs tracking-[0.14em] pb-1 whitespace-nowrap shrink-0 transition cursor-pointer ${
                    attiva
                      ? 'text-white border-b border-white'
                      : 'text-white/85 hover:text-white'
                  }`}
                >
                  {cat.toUpperCase()}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="relative z-10 text-center mb-1 sm:mb-4 px-2">
          <h1 className="italic font-normal text-3xl sm:text-5xl lg:text-6xl tracking-wide leading-tight drop-shadow mb-3.5 sm:mb-5">
            L&apos;inverno sarà una fiaba
          </h1>
          <a
            href="#collezione"
            className="inline-block text-[10px] sm:text-xs tracking-[0.16em] sm:tracking-[0.18em] uppercase whitespace-nowrap border-b border-white pb-1 hover:opacity-80 transition"
          >
            SCOPRI LA COLLEZIONE
          </a>
        </div>
      </section>

      {/* Menu Mobile / Tablet */}
      {menuMobileAperto && (
        <div
          onClick={() => setMenuMobileAperto(false)}
          className="fixed inset-0 bg-black/85 z-50 flex flex-col justify-between p-5 sm:p-7 overflow-y-auto lg:hidden"
        >
          <div onClick={(e) => e.stopPropagation()} className="flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-[#232f33] pb-4">
              <img
                src={LOGO_SRC}
                alt="Davide Shop - Clothing & Style"
                className="h-10 w-auto object-contain brightness-0 invert"
              />
              <button
                type="button"
                onClick={() => setMenuMobileAperto(false)}
                className="text-lg text-white/80 hover:text-white px-2 py-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-2 border-b border-white/50 pb-2">
              <span className="text-sm opacity-90 shrink-0">🔍</span>
              <input
                type="text"
                value={ricerca}
                onChange={gestisciRicerca}
                placeholder="Cerca nella collezione"
                className="w-full min-w-0 bg-transparent text-sm text-white placeholder:text-white/75 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-2">
              {CATEGORIE.map((cat) => {
                const attiva = categoriaAttiva === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      gestisciCategoria(cat);
                      setMenuMobileAperto(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 text-xs tracking-[0.16em] uppercase border transition cursor-pointer ${
                      attiva
                        ? 'bg-[#f4f5f6] text-[#0d1112] border-[#f4f5f6]'
                        : 'bg-[#141b1d] text-[#d6dde0] border-[#232f33]'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            onClick={(e) => e.stopPropagation()}
            className="grid grid-cols-2 gap-3 pt-6 mt-6 border-t border-[#232f33]"
          >
            <button
              type="button"
              onClick={() => {
                setMenuMobileAperto(false);
                caricaOrdini();
                setOrdiniAperti(true);
              }}
              className="border border-white/50 py-3 text-xs tracking-widest uppercase text-center hover:bg-white hover:text-black transition cursor-pointer"
            >
              Ordini ({ordini.length})
            </button>

            <button
              type="button"
              onClick={() => {
                setMenuMobileAperto(false);
                setBorsaAperta(true);
              }}
              className="border border-white/50 py-3 text-xs tracking-widest uppercase text-center hover:bg-white hover:text-black transition cursor-pointer"
            >
              Borsa ({totaleArticoli})
            </button>
          </div>
        </div>
      )}

      {/* Catalogo prodotti */}
      <main
        id="collezione"
        className="w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-10 sm:py-14 pb-16 sm:pb-20 flex-1"
      >
        <div className="hidden lg:flex flex-wrap gap-2.5 mb-8">
          {CATEGORIE.map((cat) => {
            const attiva = categoriaAttiva === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => gestisciCategoria(cat)}
                className={`px-3.5 py-2 text-sm border transition cursor-pointer ${
                  attiva
                    ? 'bg-[#f4f5f6] text-[#0d1112] border-[#f4f5f6]'
                    : 'bg-[#182022] text-[#d6dde0] border-[#2b383c] hover:border-white/50'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {prodotti.length === 0 ? (
          <p className="text-center text-sm sm:text-base text-[#9cb0b6] py-14 sm:py-16">
            Nessun articolo trovato per i filtri selezionati.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {prodotti.map((item) => (
              <article
                key={item.id}
                className="bg-[#141b1d] border border-[#232f33] flex flex-col overflow-hidden group"
              >
                <div
                  onClick={() => setProdottoSelezionato(item)}
                  className="overflow-hidden cursor-pointer"
                >
                  <img
                    src={item.immagine}
                    alt={item.titolo}
                    className="w-full h-52 sm:h-60 lg:h-64 object-cover group-hover:scale-105 transition duration-500"
                  />
                </div>
                <div className="p-4 sm:p-5 flex flex-col gap-2 sm:gap-2.5 flex-1">
                  <span className="text-[10px] sm:text-[11px] uppercase tracking-[0.14em] text-[#9cb0b6]">
                    {item.categoria}
                  </span>
                  <h2
                    onClick={() => setProdottoSelezionato(item)}
                    className="text-base sm:text-lg font-normal hover:underline cursor-pointer"
                  >
                    {item.titolo}
                  </h2>
                  <p className="text-xs sm:text-sm text-[#b9c7cc] leading-relaxed">
                    {item.descrizione}
                  </p>
                  <div className="mt-auto pt-3 sm:pt-4 flex flex-wrap items-center justify-between gap-2.5">
                    <strong className="text-sm sm:text-base font-normal whitespace-nowrap">
                      € {Number(item.prezzo).toLocaleString('it-IT')}
                    </strong>
                    <button
                      type="button"
                      onClick={() => aggiungiAllaBorsa(item.id)}
                      className="bg-[#f4f5f6] text-[#0d1112] px-3 sm:px-3.5 py-1.5 sm:py-2 text-[10px] sm:text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white transition cursor-pointer"
                    >
                      Aggiungi alla borsa
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* Footer editoriale + barra inferiore */}
      <footer className="border-t border-[#232f33] bg-[#0a0d0e] px-4 sm:px-8 lg:px-12 pt-10 sm:pt-12 pb-8 sm:pb-10">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 items-center gap-6 sm:gap-8 pb-8 border-b border-[#192225]">
          <div className="flex flex-col items-center md:items-start gap-2 text-center md:text-left">
            <a href="#top" className="inline-flex items-center">
              <img
                src={LOGO_SRC}
                alt="Davide Shop - Clothing & Style"
                className="h-10 sm:h-12 w-auto max-w-[160px] object-contain brightness-0 invert"
              />
            </a>
            <p className="text-[11px] sm:text-xs tracking-[0.16em] uppercase text-[#9cb0b6]">
              Davide Shop · Clothing &amp; Style
            </p>
            <p className="text-xs text-[#7d9096] max-w-xs">
              Collezione invernale, capi sartoriali e accessori selezionati con cura.
            </p>
          </div>

          <nav
            aria-label="Navigazione footer"
            className="flex flex-wrap items-center justify-center gap-x-4 sm:gap-x-6 gap-y-2 text-[11px] sm:text-xs tracking-[0.14em] sm:tracking-[0.16em] uppercase text-[#c7d4d8]"
          >
            <a href="#top" className="whitespace-nowrap hover:text-white transition">
              Torna su
            </a>
            <a href="#collezione" className="whitespace-nowrap hover:text-white transition">
              Collezione
            </a>
            <button
              type="button"
              onClick={() => {
                caricaOrdini();
                setOrdiniAperti(true);
              }}
              className="whitespace-nowrap hover:text-white uppercase tracking-[0.14em] sm:tracking-[0.16em] transition cursor-pointer"
            >
              Storico ordini ({ordini.length})
            </button>
          </nav>

          <div className="flex flex-col items-center md:items-end gap-1.5 text-xs text-[#7d9096] text-center md:text-right">
            <span className="text-[#a4b5ba]">
              Pagamenti sicuri · PayPal Sandbox &amp; Demo
            </span>
            <span>© 2026 Davide Shop. Tutti i diritti riservati.</span>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-6 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 text-[10px] sm:text-[11px] tracking-[0.14em] uppercase text-[#6d7f85] text-center sm:text-left">
          <span>Atelier Inverno · Edizione Limitata</span>
          <span>Davide Shop — Clothing &amp; Style</span>
        </div>
      </footer>

      {/* Modale dettaglio prodotto */}
      {prodottoSelezionato && (
        <div
          onClick={() => setProdottoSelezionato(null)}
          className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#141b1d] border border-[#2b383c] max-w-2xl w-full max-h-[90vh] overflow-y-auto grid grid-cols-1 md:grid-cols-2"
          >
            <img
              src={prodottoSelezionato.immagine}
              alt={prodottoSelezionato.titolo}
              className="w-full h-56 sm:h-72 md:h-full object-cover"
            />
            <div className="p-4 sm:p-6 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] uppercase tracking-[0.14em] text-[#9cb0b6]">
                    {prodottoSelezionato.categoria}
                  </span>
                  <button
                    type="button"
                    onClick={() => setProdottoSelezionato(null)}
                    className="text-white/70 hover:text-white cursor-pointer px-1"
                  >
                    ✕
                  </button>
                </div>
                <h2 className="text-xl sm:text-2xl font-normal mb-2.5 sm:mb-3">
                  {prodottoSelezionato.titolo}
                </h2>
                <p className="text-xs sm:text-sm text-[#b9c7cc] leading-relaxed">
                  {prodottoSelezionato.descrizione}
                </p>
              </div>

              <div className="pt-3 sm:pt-4 border-t border-[#232f33] flex flex-wrap items-center justify-between gap-3">
                <strong className="text-base sm:text-lg font-normal whitespace-nowrap">
                  € {Number(prodottoSelezionato.prezzo).toLocaleString('it-IT')}
                </strong>
                <button
                  type="button"
                  onClick={() => {
                    aggiungiAllaBorsa(prodottoSelezionato.id);
                    setProdottoSelezionato(null);
                  }}
                  className="bg-[#f4f5f6] text-[#0d1112] px-3.5 sm:px-4 py-2 text-[11px] sm:text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white transition cursor-pointer"
                >
                  Aggiungi alla borsa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drawer Borsa / Carrello */}
      {borsaAperta && (
        <aside className="fixed top-0 right-0 w-full sm:max-w-sm h-dvh sm:h-screen bg-[#12181a] border-l border-[#29363a] p-4 sm:p-6 z-50 flex flex-col gap-4 sm:gap-5">
          <div className="flex items-center justify-between border-b border-[#232f33] pb-3.5 sm:pb-4">
            <h2 className="text-lg sm:text-xl font-normal">La tua borsa</h2>
            <button
              type="button"
              onClick={() => setBorsaAperta(false)}
              className="text-lg text-white/80 hover:text-white cursor-pointer px-1"
            >
              ✕
            </button>
          </div>

          {ordineInviato && (
            <div className="bg-[#1b2924] border border-[#345448] p-3 sm:p-3.5 text-xs sm:text-sm text-[#cbe7dc]">
              Pagamento completato e ordine salvato. Grazie per aver scelto Davide Shop.
            </div>
          )}

          {borsa.length === 0 ? (
            <p className="text-xs sm:text-sm text-[#a4b5ba]">La borsa è attualmente vuota.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-3 sm:gap-3.5 overflow-y-auto flex-1">
                {borsa.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-2.5 border-b border-[#232f33] pb-3"
                  >
                    <div className="min-w-0">
                      <strong className="block text-xs sm:text-sm font-normal truncate">
                        {item.titolo}
                      </strong>
                      <span className="text-[11px] sm:text-xs text-[#a4b5ba]">
                        {item.quantita} × € {Number(item.prezzo).toLocaleString('it-IT')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => aggiornaQuantita(item.id, -1)}
                        className="border border-[#485b61] px-2 py-0.5 text-xs hover:bg-white/10 cursor-pointer"
                      >
                        −
                      </button>
                      <span className="text-xs w-4 text-center">{item.quantita}</span>
                      <button
                        type="button"
                        onClick={() => aggiornaQuantita(item.id, 1)}
                        className="border border-[#485b61] px-2 py-0.5 text-xs hover:bg-white/10 cursor-pointer"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => rimuoviDallaBorsa(item.id)}
                        className="border border-[#485b61] px-2 py-1 text-xs hover:bg-white/10 cursor-pointer ml-0.5 sm:ml-1"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-auto border-t border-[#29363a] pt-4 flex flex-col gap-3">
                <div className="flex items-center justify-between text-sm sm:text-base">
                  <span>Totale</span>
                  <strong>€ {totaleEuro.toLocaleString('it-IT')}</strong>
                </div>

                <button
                  type="button"
                  onClick={avviaPagamentoPayPal}
                  className="w-full bg-[#ffc439] text-[#111827] py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-[#f5b727] transition cursor-pointer"
                >
                  Paga con PayPal
                </button>
              </div>
            </>
          )}
        </aside>
      )}

      {/* Modale Checkout PayPal */}
      {paypalAperta && (
        <div
          onClick={() => !paypalInCorso && setPaypalAperta(false)}
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#12181a] border border-[#2b383c] max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between border-b border-[#232f33] pb-3">
              <div>
                <h2 className="text-lg sm:text-xl font-normal">Checkout PayPal</h2>
                <p className="text-xs text-[#9cb0b6]">Davide Shop · Pagamento sicuro</p>
              </div>
              <button
                type="button"
                disabled={paypalInCorso}
                onClick={() => setPaypalAperta(false)}
                className="text-lg text-white/80 hover:text-white cursor-pointer disabled:opacity-40 px-1"
              >
                ✕
              </button>
            </div>

            {paypalErrore && (
              <div className="bg-[#2c191b] border border-[#6e3439] p-3 text-xs text-[#f6c5ca]">
                {paypalErrore}
              </div>
            )}

            <div className="bg-[#161e21] border border-[#232f33] p-3 sm:p-3.5 flex flex-col gap-1.5 text-xs text-[#b9c7cc]">
              {paypalOrder?.id && (
                <div className="flex justify-between gap-2">
                  <span>Riferimento ordine:</span>
                  <span className="text-white truncate">{paypalOrder.id}</span>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span>Modalità:</span>
                <span className="text-white text-right">
                  {paypalConfig.clientId && sdkPronto
                    ? 'PayPal Sandbox (SDK)'
                    : 'PayPal Demo / Locale'}
                </span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-[#232f33] text-xs sm:text-sm">
                <span>Totale da pagare:</span>
                <strong className="text-white">
                  € {totaleEuro.toLocaleString('it-IT')}
                </strong>
              </div>
            </div>

            {paypalConfig.clientId && sdkPronto ? (
              <div className="pt-1">
                <div ref={paypalButtonsRef} />
                {paypalInCorso && (
                  <p className="text-xs text-[#a4b5ba] mt-2 text-center">
                    Conferma pagamento in corso...
                  </p>
                )}
              </div>
            ) : paypalOrder ? (
              <button
                type="button"
                disabled={paypalInCorso}
                onClick={completaPagamentoPayPalDemo}
                className="w-full bg-[#ffc439] text-[#111827] py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-[#f5b727] transition cursor-pointer disabled:opacity-50"
              >
                {paypalInCorso ? 'Conferma in corso...' : 'Conferma pagamento PayPal'}
              </button>
            ) : (
              <p className="text-xs sm:text-sm text-[#a4b5ba]">
                {paypalInCorso
                  ? 'Preparazione sessione PayPal...'
                  : 'Inizializzazione pagamento...'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Modale Storico Ordini */}
      {ordiniAperti && (
        <div
          onClick={() => setOrdiniAperti(false)}
          className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#12181a] border border-[#2b383c] max-w-xl w-full max-h-[85vh] overflow-y-auto p-4 sm:p-6 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between border-b border-[#232f33] pb-3.5 sm:pb-4">
              <h2 className="text-lg sm:text-xl font-normal">Storico ordini</h2>
              <button
                type="button"
                onClick={() => setOrdiniAperti(false)}
                className="text-lg text-white/80 hover:text-white cursor-pointer px-1"
              >
                ✕
              </button>
            </div>

            {ordini.length === 0 ? (
              <p className="text-xs sm:text-sm text-[#a4b5ba]">
                Non hai ancora effettuato ordini.
              </p>
            ) : (
              <div className="flex flex-col gap-3.5 sm:gap-4">
                {ordini.map((ordine) => (
                  <div
                    key={ordine.id}
                    className="bg-[#161e21] border border-[#232f33] p-3.5 sm:p-4 flex flex-col gap-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs text-[#9cb0b6] border-b border-[#232f33] pb-2">
                      <span>Ordine #{ordine.id}</span>
                      <span>
                        {new Date(ordine.data).toLocaleString('it-IT', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>

                    {ordine.metodoPagamento && (
                      <div className="text-xs text-[#9cb0b6]">
                        Metodo: <span className="text-[#d6dde0]">{ordine.metodoPagamento}</span>
                      </div>
                    )}

                    <ul className="flex flex-col gap-1.5 text-xs sm:text-sm">
                      {ordine.articoli.map((art, idx) => (
                        <li
                          key={`${ordine.id}-${art.id}-${idx}`}
                          className="flex justify-between gap-2"
                        >
                          <span>
                            {art.quantita} × {art.titolo}
                          </span>
                          <span className="text-[#b9c7cc] whitespace-nowrap">
                            € {(art.prezzo * art.quantita).toLocaleString('it-IT')}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="pt-2 border-t border-[#232f33] flex justify-between text-xs sm:text-sm">
                      <span>Totale ordine</span>
                      <strong>€ {Number(ordine.totale).toLocaleString('it-IT')}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}