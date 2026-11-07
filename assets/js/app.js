const firebaseConfig = {
    apiKey: "AIzaSyAtMRKLifKb8t_WnIKah0ubhbX92yHW_9I",
    authDomain: "ahorroviaje-f883a.firebaseapp.com",
    databaseURL: "https://ahorroviaje-f883a-default-rtdb.firebaseio.com",
    projectId: "ahorroviaje-f883a",
    storageBucket: "ahorroviaje-f883a.firebasestorage.app",
    messagingSenderId: "96659901309",
    appId: "1:96659901309:web:cec772834c6f89db4a1a14"
  };

  const COINS = [100, 200, 500, 1000];
  const BILLS = [10000, 20000, 50000];
  const DB_PATH = 'ahorroViaje';

  function fmt(n){ return '$' + Math.round(n || 0).toLocaleString('es-CO'); }
  function cryptoId(){ return 'p_' + Math.random().toString(36).slice(2, 10); }

  function defaultState(){
    return {
      goalName: 'VIAJE PARA DECAMERON',
      goalAmount: 5000000,
      people: [
        { id: cryptoId(), name: 'Persona 1', counts: {} },
        { id: cryptoId(), name: 'Persona 2', counts: {} }
      ],
      history: []
    };
  }

  let state = defaultState();
  let isUserActive = false;
  let activeTimer = null;
  let saveTimer = null;
  let dbRef = null;

  function markUserActive(){
    isUserActive = true;
    clearTimeout(activeTimer);
    activeTimer = setTimeout(() => { isUserActive = false; }, 2000);
  }

  function syncToFirebase(){
    markUserActive();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if(dbRef) {
        dbRef.set(state).catch(err => {
          setStatus(false, 'No se pudo sincronizar');
          console.error(err);
        });
      }
    }, 600);
  }

  function setStatus(ok, text){
    document.getElementById('statusDot').classList.toggle('ok', ok);
    document.getElementById('statusText').textContent = text;
  }

  // Inicialización Firebase
  firebase.initializeApp(firebaseConfig);
  dbRef = firebase.database().ref(DB_PATH);
  setStatus(false, 'Conectando…');

  dbRef.on('value', snapshot => {
    const val = snapshot.val();
    if(val){
      state = val;
      state.people = state.people || [];
      state.history = state.history || [];
    } else {
      state = defaultState();
      dbRef.set(state);
    }
    setStatus(true, 'Sincronizado en vivo');
    
    // Solo redibujamos la cuadrícula si el usuario no está interactuando
    if(!isUserActive) {
      renderAll();
    }
  }, err => {
    setStatus(false, 'Sin conexión');
    console.error(err);
  });

  const goalNameEl = document.getElementById('goalName');
  const goalAmountEl = document.getElementById('goalAmount');
  const peopleGrid = document.getElementById('peopleGrid');
  const personTpl = document.getElementById('personCardTpl');
  const jarWater = document.getElementById('jarWater');
  const barFill = document.getElementById('barFill');
  const pctNum = document.getElementById('pctNum');
  const totalAhorradoEl = document.getElementById('totalAhorrado');
  const totalFaltaEl = document.getElementById('totalFalta');
  const historyWrap = document.getElementById('historyWrap');
  const historyList = document.getElementById('historyList');

  function personSubtotal(person){
    let sum = 0;
    if(!person.counts) person.counts = {};
    [...COINS, ...BILLS].forEach(d => { sum += (person.counts[d] || 0) * d; });
    return sum;
  }

  function grandTotal(){
    return (state.people || []).reduce((acc, p) => acc + personSubtotal(p), 0);
  }

  function renderPeople(){
    peopleGrid.innerHTML = '';
    if(!state.people || state.people.length === 0){
      peopleGrid.innerHTML = '<div class="empty-state">Aún no hay nadie ahorrando. Haz clic en <strong>+ Añadir persona</strong> arriba para comenzar.</div>';
      return;
    }

    state.people.forEach(person => {
      const node = personTpl.content.cloneNode(true);
      const card = node.querySelector('.person-card');
      const nameInput = node.querySelector('.person-name');
      const subtotalVal = node.querySelector('.subtotal-value');
      nameInput.value = person.name || '';

      nameInput.addEventListener('focus', markUserActive);
      nameInput.addEventListener('input', (e) => {
        person.name = e.target.value;
        syncToFirebase();
      });

      node.querySelector('.remove-person').addEventListener('click', () => {
        if(confirm(`¿Eliminar a "${person.name}" y todo su ahorro?`)){
          state.people = state.people.filter(p => p.id !== person.id);
          syncToFirebase();
          renderAll();
        }
      });

      const coinsWrap = node.querySelector('.coins-wrap');
      const billsWrap = node.querySelector('.bills-wrap');

      function buildRow(denom, isBill){
        const row = document.createElement('div');
        row.className = 'denom-row' + (isBill ? ' bill' : '');
        
        const chip = document.createElement('span');
        chip.className = 'denom-chip';
        chip.textContent = fmt(denom);

        const minus = document.createElement('button');
        minus.className = 'step-btn'; minus.type = 'button'; minus.textContent = '−';

        const qty = document.createElement('input');
        qty.type = 'number'; qty.min = '0'; qty.className = 'qty-input';
        qty.setAttribute('aria-label', `Cantidad de ${fmt(denom)}`);
        qty.value = (person.counts && person.counts[denom]) ? person.counts[denom] : 0;

        const plus = document.createElement('button');
        plus.className = 'step-btn'; plus.type = 'button'; plus.textContent = '+';

        const subtotal = document.createElement('span');
        subtotal.className = 'denom-subtotal';

        function updateVal(newVal){
          markUserActive();
          let v = parseInt(newVal, 10);
          if(isNaN(v) || v < 0) v = 0;
          
          qty.value = v;
          if(!person.counts) person.counts = {};
          person.counts[denom] = v;
          
          // Actualización instantánea sin redibujar toda la pantalla
          subtotal.textContent = fmt(v * denom);
          subtotalVal.textContent = fmt(personSubtotal(person));
          renderTotalsOnly();
          syncToFirebase();
        }

        // Seleccionar texto completo al enfocar para escribir números rápido (ej: 10)
        qty.addEventListener('focus', (e) => {
          markUserActive();
          e.target.select();
        });

        minus.addEventListener('click', () => updateVal((parseInt(qty.value, 10) || 0) - 1));
        plus.addEventListener('click', () => updateVal((parseInt(qty.value, 10) || 0) + 1));
        qty.addEventListener('input', (e) => updateVal(e.target.value));

        subtotal.textContent = fmt(((person.counts && person.counts[denom]) || 0) * denom);

        row.appendChild(chip); 
        row.appendChild(minus); 
        row.appendChild(qty); 
        row.appendChild(plus); 
        row.appendChild(subtotal);
        return row;
      }

      COINS.forEach(d => coinsWrap.appendChild(buildRow(d, false)));
      BILLS.forEach(d => billsWrap.appendChild(buildRow(d, true)));

      subtotalVal.textContent = fmt(personSubtotal(person));
      peopleGrid.appendChild(node);
    });
  }

  function renderTotalsOnly(){
    const total = grandTotal();
    const goal = parseFloat(state.goalAmount) || 0;
    const pct = goal > 0 ? Math.min(100, (total / goal) * 100) : 0;
    const falta = Math.max(0, goal - total);

    totalAhorradoEl.textContent = fmt(total);
    totalFaltaEl.textContent = goal > 0 ? fmt(falta) : '—';
    pctNum.textContent = pct.toFixed(1);
    barFill.style.width = pct + '%';
    jarWater.style.height = pct + '%';
  }

  function renderHistory(){
    if(!state.history || state.history.length === 0){
      historyWrap.style.display = 'none';
      return;
    }
    historyWrap.style.display = 'block';
    historyList.innerHTML = '';
    [...state.history].reverse().forEach(h => {
      const div = document.createElement('div');
      div.className = 'history-item';

      const content = document.createElement('div');
      const name = document.createElement('div');
      name.className = 'h-name';
      name.textContent = h.goalName || '';

      const meta = document.createElement('div');
      meta.className = 'h-meta';
      meta.textContent = `meta ${fmt(h.goalAmount)} · logrado ${fmt(h.total)} · ${h.date || ''}`;

      content.append(name, meta);
      div.appendChild(content);
      historyList.appendChild(div);
    });
  }

  function renderAll(){
    goalNameEl.value = state.goalName || '';
    goalAmountEl.value = state.goalAmount || 0;
    renderPeople();
    renderTotalsOnly();
    renderHistory();
  }

  // Eventos globales
  goalNameEl.addEventListener('focus', markUserActive);
  goalNameEl.addEventListener('input', (e) => {
    state.goalName = e.target.value;
    syncToFirebase();
  });

  goalAmountEl.addEventListener('focus', (e) => {
    markUserActive();
    e.target.select();
  });
  goalAmountEl.addEventListener('input', (e) => {
    state.goalAmount = parseFloat(e.target.value) || 0;
    renderTotalsOnly();
    syncToFirebase();
  });

  document.getElementById('addPersonBtn').addEventListener('click', () => {
    markUserActive();
    const name = prompt('Nombre de la persona:', 'Nueva Persona');
    if(name === null) return;
    if(!state.people) state.people = [];
    state.people.push({ id: cryptoId(), name: name.trim() || 'Sin Nombre', counts: {} });
    syncToFirebase();
    renderAll();
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    markUserActive();
    const total = grandTotal();
    if(!confirm('¿Guardar este avance en el historial y reiniciar el conteo a $0 para una nueva meta?')) return;
    state.history = state.history || [];
    state.history.push({
      goalName: state.goalName,
      goalAmount: state.goalAmount,
      total: total,
      date: new Date().toLocaleDateString('es-CO', { year:'numeric', month:'short', day:'numeric' })
    });
    if(state.people) {
      state.people.forEach(p => { p.counts = {}; });
    }
    syncToFirebase();
    renderAll();
  });

  renderAll();
