/* ==========================================================================
   Body Scent - shared script
   Runs on every page; each feature starts only if its elements exist.
   - product.html : #filter-bar, #product-list
   - order.html   : #orderForm, #customerName, #contact, #items, #total, #note
   - admin.html   : #ordersTable tbody
   ========================================================================== */

var SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycby1-S4ckuGfq4T49o5NCsHsj0uLCnYS20V_h6-ZnbIrCO5zotZPW5ehhzVaKl1MN7oP/exec';

var CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ3YAyi7oamXNlm_viC9o9_1iOm7hSX-f_ZAObVvRSkCeKDLAWXPB_5agwqty1GKpgo4zwsazkcRepu/pub?gid=0&single=true&output=csv';

var MOODS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'fresh', label: 'Fresh' },
  { key: 'sweet', label: 'Sweet' },
  { key: 'confident', label: 'Confident' },
  { key: 'romance', label: 'Romance' }
];

document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('product-list')) initProductPage();
  if (document.getElementById('orderForm')) initOrderPage();
  if (document.querySelector('#ordersTable tbody')) initAdminPage();
});

/* ---------- Small helper ---------- */
function el(tag, className, text) {
  var node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* ==========================================================================
   1) product.html
   ========================================================================== */
function initProductPage() {
  var list = document.getElementById('product-list');
  var bar = document.getElementById('filter-bar');
  var products = [];
  var currentMood = 'all';

  function buildFilterBar() {
    if (!bar) return;
    bar.innerHTML = '';
    MOODS.forEach(function (m) {
      var btn = el('button', 'chip', m.label);
      btn.type = 'button';
      btn.dataset.mood = m.key;
      btn.addEventListener('click', function () {
        setMood(m.key);
      });
      bar.appendChild(btn);
    });
  }

  function setMood(mood) {
    currentMood = mood;
    if (bar) {
      Array.prototype.forEach.call(bar.querySelectorAll('.chip'), function (chip) {
        var active = chip.dataset.mood === mood;
        chip.classList.toggle('is-active', active);
        chip.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }
    render();
  }

  function orderUrl(p) {
    var itemName = p.name + (p.size ? ' ' + p.size : '');
    return (
      'order.html?item=' + encodeURIComponent(itemName) +
      '&price=' + encodeURIComponent(p.price)
    );
  }

  function buildCard(p) {
    var card = el('article', 'product-card mood-' + p.mood);

    var img = el('img', 'product-card__image');
    img.src = p.image;
    img.alt = p.name;
    img.loading = 'lazy';
    card.appendChild(img);

    var body = el('div', 'product-card__body');

    var name = el('h3', 'product-card__name');
    name.appendChild(el('span', 'mood-dot'));
    name.appendChild(document.createTextNode(p.name));
    body.appendChild(name);

    body.appendChild(el('p', 'product-card__meta', p.size ? p.size : 'โรลออน'));

    var foot = el('div', 'product-card__foot');
    var price = el('span', 'price', Number(p.price).toLocaleString('th-TH'));
    price.appendChild(el('small', '', 'บาท'));
    foot.appendChild(price);

    var buy = el('a', 'btn', 'สั่งซื้อ');
    buy.href = orderUrl(p);
    foot.appendChild(buy);

    body.appendChild(foot);
    card.appendChild(body);
    return card;
  }

  function render() {
    list.innerHTML = '';
    var shown = products.filter(function (p) {
      return currentMood === 'all' || p.mood === currentMood;
    });
    if (shown.length === 0) {
      list.appendChild(el('p', 'muted', 'ยังไม่มีสินค้าในหมวดนี้'));
      return;
    }
    shown.forEach(function (p) {
      list.appendChild(buildCard(p));
    });
  }

  function initialMood() {
    var param = new URLSearchParams(window.location.search).get('mood');
    if (!param) return 'all';
    param = param.toLowerCase();
    var valid = MOODS.some(function (m) {
      return m.key === param;
    });
    return valid ? param : 'all';
  }

  buildFilterBar();

  fetch('products.json')
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      products = data;
      setMood(initialMood());
    })
    .catch(function (error) {
      console.error(error);
      list.innerHTML = '';
      list.appendChild(el('p', 'muted', 'โหลดข้อมูลสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'));
    });
}

/* ==========================================================================
   2) order.html
   ========================================================================== */
function initOrderPage() {
  var form = document.getElementById('orderForm');
  var params = new URLSearchParams(window.location.search);

  var item = params.get('item');
  var price = params.get('price');

  var itemsField = document.getElementById('items');
  var totalField = document.getElementById('total');

  if (item && itemsField) itemsField.value = item;
  if (price && totalField) totalField.value = price;

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    var payload = {
      customerName: document.getElementById('customerName').value,
      contact: document.getElementById('contact').value,
      items: document.getElementById('items').value,
      total: document.getElementById('total').value,
      note: document.getElementById('note').value
    };

    fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    .then(() => { window.location.href = 'thankyou.html'; })
    .catch(error => {
      console.error(error);
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    });
  });
}

/* ==========================================================================
   3) admin.html
   ========================================================================== */

/* CSV parser: handles quoted fields, "" escapes, commas and line breaks inside quotes */
function parseCSV(text) {
  var rows = [];
  var row = [];
  var field = '';
  var inQuotes = false;

  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM

  for (var i = 0; i < text.length; i++) {
    var ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter(function (r) {
    return r.some(function (cell) {
      return cell.trim() !== '';
    });
  });
}

function initAdminPage() {
  var tbody = document.querySelector('#ordersTable tbody');
  var COLUMNS = 6;

  function message(text) {
    tbody.innerHTML = '';
    var tr = el('tr');
    var td = el('td', 'muted', text);
    td.colSpan = COLUMNS;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  message('กำลังโหลดข้อมูล...');

  fetch(CSV_URL)
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then(function (text) {
      var rows = parseCSV(text);

      // skip a header row if the first cell is not a date like 21/11/2026 or 11/21/2026
      if (rows.length && !/^\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4}/.test(rows[0][0].trim())) {
        rows.shift();
      }

      if (rows.length === 0) {
        message('ยังไม่มีคำสั่งซื้อ');
        return;
      }

      // rows are appended in time order, so the last row is the newest
      rows.reverse();

      tbody.innerHTML = '';
      rows.forEach(function (r) {
        var tr = el('tr');
        for (var c = 0; c < COLUMNS; c++) {
          tr.appendChild(el('td', '', r[c] !== undefined ? r[c] : ''));
        }
        tbody.appendChild(tr);
      });
    })
    .catch(function (error) {
      console.error(error);
      message('โหลดข้อมูลคำสั่งซื้อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    });
}
