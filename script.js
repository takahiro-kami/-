const REGIONS = {
  kanto: { start: 1, end: 151 },
  johto: { start: 152, end: 251 },
  hoenn: { start: 252, end: 386 },
  sinnoh: { start: 387, end: 493 },
  unova: { start: 494, end: 649 },
  kalos: { start: 650, end: 721 },
  alola: { start: 722, end: 809 },
  galar: { start: 810, end: 905 },
  paldea: { start: 906, end: 1025 }
};

const pokemonGrid = document.getElementById('pokemonGrid');
const loading = document.getElementById('loading');
const searchInput = document.getElementById('searchInput');
const regionSelect = document.getElementById('regionSelect');
const detailModal = document.getElementById('detailModal');
const modalBody = document.getElementById('modalBody');
const closeModal = document.getElementById('closeModal');

let loadedPokemon = {};
let currentList = [];
let favorites = JSON.parse(localStorage.getItem('poke_favs') || '[]');

const typeNamesJa = {
  grass: 'くさ', fire: 'ほのお', water: 'みず', bug: 'むし',
  normal: 'ノーマル', poison: 'どく', electric: 'でんき', ground: 'じめん',
  fairy: 'フェアリー', fighting: 'かくとう', psychic: 'エスパー',
  rock: 'いわ', ghost: 'ゴースト', ice: 'こおり', dragon: 'ドラゴン',
  dark: 'あく', steel: 'はがね', flying: 'ひこう'
};

const statNamesJa = {
  hp: 'HP',
  attack: 'こうげき',
  defense: 'ぼうぎょ',
  'special-attack': 'とくこう',
  'special-defense': 'とくぼう',
  speed: 'すばやさ'
};

function translateFormName(rawName) {
  if (!rawName || rawName.trim() === '') return '通常';
  
  const name = rawName.toLowerCase().replace(/_/g, '-').trim();
  
  if (name === 'normal' || name === 'ordinary' || name === 'standard' || name === 'altered') {
    return '通常';
  }

  const dictionary = [
    { key: 'heat', val: 'ヒート' },
    { key: 'wash', val: 'ウォッシュ' },
    { key: 'frost', val: 'フロスト' },
    { key: 'fan', val: 'スピン' },
    { key: 'spin', val: 'スピン' },
    { key: 'mow', val: 'カット' },
    { key: 'mega-x', val: 'メガX' },
    { key: 'mega-y', val: 'メガY' },
    { key: 'mega', val: 'メガ' },
    { key: 'gmax', val: 'キョダイ' },
    { key: 'alola', val: 'アローラ' },
    { key: 'galar', val: 'ガラル' },
    { key: 'hisui', val: 'ヒスイ' },
    { key: 'paldea', val: 'パルデア' },
    { key: 'origin', val: 'オリジン' },
    { key: 'therian', val: 'れいじゅう' },
    { key: 'incarnate', val: 'けしん' },
    { key: 'sky', val: 'スカイ' },
    { key: 'land', val: 'ランド' },
    { key: 'sunny', val: 'たいよう' },
    { key: 'rainy', val: 'あままし' },
    { key: 'snowy', val: 'ゆきがくれ' },
    { key: 'attack', val: 'アタック' },
    { key: 'defense', val: 'ディフェンス' },
    { key: 'speed', val: 'スピード' },
    { key: 'primal', val: 'ゲンシカイキ' },
    { key: 'dusk', val: 'たそがれ' },
    { key: 'dawn', val: 'たそがれ' },
    { key: 'midnight', val: 'まよなか' },
    { key: 'midday', val: 'まひる' }
  ];

  for (const item of dictionary) {
    if (name.includes(item.key)) {
      return item.val;
    }
  }

  return '通常';
}

// 進捗度（プログレスバー）を更新する関数
function updateProgress() {
  const currentRegion = regionSelect.value;
  const progressText = document.getElementById('progressText');
  const progressBar = document.getElementById('progressBar');

  if (!progressText || !progressBar) return;

  if (currentRegion === 'favorites') {
    const totalFavs = favorites.length;
    progressText.textContent = `お気に入り登録数: ${totalFavs} 匹`;
    progressBar.style.width = totalFavs > 0 ? '100%' : '0%';
    return;
  }

  const { start, end } = REGIONS[currentRegion];
  const totalInRegion = (end - start) + 1;
  
  // 現在選択中の地方で「お気に入り（獲得済み）」に登録されている数をカウント
  let caughtInRegion = 0;
  for (let id = start; id <= end; id++) {
    if (favorites.includes(id)) {
      caughtInRegion++;
    }
  }

  const percentage = Math.round((caughtInRegion / totalInRegion) * 100);
  const regionNamesJa = {
    kanto: 'カントー地方', johto: 'ジョウト地方', hoenn: 'ホウエン地方',
    sinnoh: 'シンオウ地方', unova: 'イッシュ地方', kalos: 'カロス地方',
    alola: 'アローラ地方', galar: 'ガラル地方', paldea: 'パルデア地方'
  };

  const regionName = regionNamesJa[currentRegion] || '選択地域';
  progressText.textContent = `${regionName}: ${caughtInRegion} / ${totalInRegion} 匹 (${percentage}%)`;
  progressBar.style.width = `${percentage}%`;
}

async function loadRegion(regionKey) {
  loading.style.display = 'block';
  pokemonGrid.innerHTML = '';

  if (regionKey === 'favorites') {
    const favIds = favorites.sort((a, b) => a - b);
    const promises = favIds.map(id => fetchSinglePokemon(id));
    currentList = await Promise.all(promises);
  } else {
    const { start, end } = REGIONS[regionKey];
    const promises = [];
    for (let i = start; i <= end; i++) {
      promises.push(fetchSinglePokemon(i));
    }
    currentList = await Promise.all(promises);
  }

  loading.style.display = 'none';
  filterAndRender();
}

async function fetchSinglePokemon(id) {
  if (loadedPokemon[id]) return loadedPokemon[id];

  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    const data = await res.json();

    const speciesRes = await fetch(data.species.url);
    const speciesData = await speciesRes.json();

    const jaObj = speciesData.names.find(
      n => n.language.name === 'ja-Hrkt' || n.language.name === 'ja'
    );

    const abilities = await Promise.all(
      data.abilities.map(async (a) => {
        try {
          const abRes = await fetch(a.ability.url);
          const abData = await abRes.json();
          const abJa = abData.names.find(
            n => n.language.name === 'ja-Hrkt' || n.language.name === 'ja'
          );
          return {
            name: abJa ? abJa.name : a.ability.name,
            is_hidden: a.is_hidden
          };
        } catch {
          return { name: a.ability.name, is_hidden: a.is_hidden };
        }
      })
    );

    const pokemon = {
      id: data.id,
      name: jaObj ? jaObj.name : data.name,
      image: data.sprites.front_default || data.sprites.other?.['official-artwork']?.front_default || '',
      shinyImage: data.sprites.front_shiny || data.sprites.other?.['official-artwork']?.front_shiny || '',
      types: data.types.map(t => t.type.name),
      height: data.height / 10,
      weight: data.weight / 10,
      stats: data.stats,
      abilities: abilities,
      varieties: speciesData.varieties,
      evolutionChainUrl: speciesData.evolution_chain?.url
    };

    loadedPokemon[id] = pokemon;
    return pokemon;
  } catch (e) {
    console.error(`ID: ${id} の取得に失敗しました`, e);
    return { id, name: `No.${id}`, image: '', types: [], height: 0, weight: 0, stats: [], abilities: [], varieties: [] };
  }
}

// 色違い画像と通常画像を切り替えるグローバル関数
window.toggleShiny = (normalUrl, shinyUrl) => {
  const imgElem = document.getElementById('modalPokemonImg');
  const btnElem = document.getElementById('shinyToggleBtn');
  if (!imgElem || !btnElem) return;

  const isShiny = btnElem.classList.contains('active');
  if (isShiny) {
    imgElem.src = normalUrl;
    btnElem.classList.remove('active');
    btnElem.textContent = '✨ 色違い表示';
  } else {
    imgElem.src = shinyUrl || normalUrl;
    btnElem.classList.add('active');
    btnElem.textContent = '✨ 通常色に戻す';
  }
};

// 進化チェーンデータを再帰的に解析して配列化する関数
function parseEvolutionChain(chainNode, result = []) {
  const speciesUrl = chainNode.species.url;
  const idMatch = speciesUrl.match(/\/pokemon-species\/(\d+)\//);
  const id = idMatch ? parseInt(idMatch[1], 10) : null;

  result.push({
    id: id,
    name: chainNode.species.name,
    evolvesTo: chainNode.evolves_to.map(next => parseEvolutionChain(next, []))
  });

  return result;
}

// 進化チャートのHTMLを動的生成
async function renderEvolutionChain(evolutionChainUrl, currentId) {
  if (!evolutionChainUrl) return '';

  try {
    const res = await fetch(evolutionChainUrl);
    const data = await res.json();
    const parsed = parseEvolutionChain(data.chain);

    // リスト構造を水平フローのHTMLに変換
    let html = '<div class="evolution-section"><div class="evolution-title">しんかルート</div><div class="evolution-container">';

    async function buildNodesHTML(nodes) {
      let segment = '';
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (!node[0]) continue;
        const target = node[0];

        if (target.id) {
          const pokeData = await fetchSinglePokemon(target.id);
          const isCurrent = target.id === currentId;

          segment += `
            <div class="evo-node ${isCurrent ? 'current' : ''}" onclick="goToPokemon(${target.id})">
              <img src="${pokeData.image}" alt="${pokeData.name}">
              <span class="evo-name">${pokeData.name}</span>
            </div>
          `;

          if (target.evolvesTo && target.evolvesTo.length > 0) {
            segment += '<span class="evo-arrow">➔</span>';
            segment += await buildNodesHTML(target.evolvesTo);
          }
        }
      }
      return segment;
    }

    html += await buildNodesHTML([parsed]);
    html += '</div></div>';
    return html;
  } catch (e) {
    console.error('進化データの取得に失敗:', e);
    return '';
  }
}

window.goToPokemon = async (id) => {
  const pokemon = await fetchSinglePokemon(id);
  if (pokemon) showDetail(pokemon);
};

function toggleFavorite(e, id) {
  e.stopPropagation();
  if (favorites.includes(id)) {
    favorites = favorites.filter(favId => favId !== id);
  } else {
    favorites.push(id);
  }
  localStorage.setItem('poke_favs', JSON.stringify(favorites));

  if (regionSelect.value === 'favorites') {
    loadRegion('favorites');
  } else {
    filterAndRender();
  }
}

function filterAndRender() {
  updateProgress();
  const query = searchInput.value.trim().toLowerCase();
  const filtered = currentList.filter(p => 
    p.name.includes(query) || String(p.id).includes(query)
  );
  renderCards(filtered);
}

function renderCards(list) {
  pokemonGrid.innerHTML = '';
  if (list.length === 0) {
    pokemonGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #888; padding: 20px;">該当するポケモンが見つかりません</div>';
    return;
  }

  list.forEach(pokemon => {
    const isFav = favorites.includes(pokemon.id);
    const card = document.createElement('div');
    card.className = 'card';
    card.onclick = () => showDetail(pokemon);

    const typesHTML = pokemon.types.map(type => {
      const typeJa = typeNamesJa[type] || type;
      return `<span class="type-badge type-${type}">${typeJa}</span>`;
    }).join('');

    card.innerHTML = `
      <span class="id">#${String(pokemon.id).padStart(3, '0')}</span>
      <span class="fav-star ${isFav ? 'active' : ''}" onclick="toggleFavorite(event, ${pokemon.id})">★</span>
      <img src="${pokemon.image}" alt="${pokemon.name}">
      <div class="name">${pokemon.name}</div>
      <div class="types">${typesHTML}</div>
    `;

    pokemonGrid.appendChild(card);
  });
}

async function showDetail(pokemon, formUrl = null) {
  let activeData = pokemon;
  let displayName = pokemon.name;

  if (formUrl) {
    const res = await fetch(formUrl);
    const data = await res.json();
    
    let formKey = data.name.replace(`${pokemon.id}`, '').replace(pokemon.name.toLowerCase(), '').replace('-', ' ').trim();
    let translatedForm = translateFormName(formKey);

    if (translatedForm !== '通常') {
      displayName = `${translatedForm}${pokemon.name}`;
    }

    const abilities = await Promise.all(
      data.abilities.map(async (a) => {
        try {
          const abRes = await fetch(a.ability.url);
          const abData = await abRes.json();
          const abJa = abData.names.find(
            n => n.language.name === 'ja-Hrkt' || n.language.name === 'ja'
          );
          return {
            name: abJa ? abJa.name : a.ability.name,
            is_hidden: a.is_hidden
          };
        } catch {
          return { name: a.ability.name, is_hidden: a.is_hidden };
        }
      })
    );

    activeData = {
      name: displayName,
      image: data.sprites.front_default || data.sprites.other?.['official-artwork']?.front_default || pokemon.image,
      shinyImage: data.sprites.front_shiny || data.sprites.other?.['official-artwork']?.front_shiny || pokemon.shinyImage,
      types: data.types.map(t => t.type.name),
      height: data.height / 10,
      weight: data.weight / 10,
      stats: data.stats,
      abilities: abilities
    };
  }

  const typesHTML = activeData.types.map(type => {
    const typeJa = typeNamesJa[type] || type;
    return `<span class="type-badge type-${type}">${typeJa}</span>`;
  }).join('');

  let formButtonsHTML = '';
  if (pokemon.varieties && pokemon.varieties.length > 1) {
    formButtonsHTML = '<div class="form-buttons">' + pokemon.varieties.map(v => {
      let label = '通常';
      if (!v.is_default) {
        let rawLabel = v.pokemon.name.replace(`${pokemon.id}`, '').replace(pokemon.name.toLowerCase(), '').replace(/-/g, ' ').trim();
        label = translateFormName(rawLabel);
      }
      const isActive = (formUrl === v.pokemon.url) || (!formUrl && v.is_default);
      return `<button class="form-btn ${isActive ? 'active' : ''}" onclick="changeForm(${pokemon.id}, '${v.pokemon.url}')">${label}</button>`;
    }).join('') + '</div>';
  }

  const abilitiesHTML = activeData.abilities.map(a => 
    `${a.name}${a.is_hidden ? ' <small style="color:#ef5350;">(夢)</small>' : ''}`
  ).join(', ');

  const statsHTML = activeData.stats.map(s => {
    const statName = statNamesJa[s.stat.name] || s.stat.name;
    return `<div class="stat-row"><span>${statName}:</span><span>${s.base_stat}</span></div>`;
  }).join('');

  // 進化チャートの取得
  const evoHTML = await renderEvolutionChain(pokemon.evolutionChainUrl, pokemon.id);

  const shinyBtnHTML = activeData.shinyImage 
  ? `<button id="shinyToggleBtn" class="shiny-btn" onclick="toggleShiny('${activeData.image}', '${activeData.shinyImage}')">✨ 色違い表示</button>`
  : '';
  modalBody.innerHTML = `
  <h2 style="margin-bottom: 5px;">${displayName}</h2>
  <p style="color:#888; font-size:0.8rem;">#${String(pokemon.id).padStart(3, '0')}</p>
  
  <div class="modal-image-container">
    <img id="modalPokemonImg" src="${activeData.image}" style="width:120px; height:120px;">
    ${shinyBtnHTML}
  </div>

  ${formButtonsHTML}
  <div class="types" style="margin-bottom: 15px;">${typesHTML}</div>
  <div class="stat-row"><span>たかさ:</span><span>${activeData.height} m</span></div>
  <div class="stat-row"><span>おもさ:</span><span>${activeData.weight} kg</span></div>
  ${statsHTML}
  <div class="stat-row" style="margin-top: 10px;"><span>とくせい:</span><span>${abilitiesHTML}</span></div>
  ${evoHTML}
`;
  detailModal.style.display = 'flex';
}

window.changeForm = (pokemonId, url) => {
  const pokemon = loadedPokemon[pokemonId];
  if (pokemon) showDetail(pokemon, url);
};

closeModal.onclick = () => detailModal.style.display = 'none';
window.onclick = (e) => { if (e.target === detailModal) detailModal.style.display = 'none'; };

regionSelect.addEventListener('change', (e) => loadRegion(e.target.value));

searchInput.addEventListener('input', () => {
  filterAndRender();
});

loadRegion('kanto');