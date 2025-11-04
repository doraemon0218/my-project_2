// 天理駅の座標（奈良県天理市）
const TENRI_STATION = {
  lat: 34.5967,
  lng: 135.8333
};

// データURL
const SPEED_DATA_URL = "./data/平均歩行速度.csv";

let map;
let stationMarker = null;
let reachableCircle = null;
let speedData = {};

// 地図の初期化
function initMap() {
  map = L.map('map').setView([TENRI_STATION.lat, TENRI_STATION.lng], 14);
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);
  
  // 天理駅マーカーを追加
  stationMarker = L.marker([TENRI_STATION.lat, TENRI_STATION.lng], {
    icon: L.divIcon({
      className: 'station-marker',
      html: '<div style="background: #ef4444; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;">🚇</div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    })
  }).addTo(map);
  
  stationMarker.bindPopup('<strong>天理駅</strong><br>奈良県天理市');
}

// CSV読み込み
async function loadCSV(url) {
  const text = await fetch(url).then(r => r.text());
  const { data } = Papa.parse(text.trim(), { header: true, skipEmptyLines: true });
  return data;
}

// 速度データを読み込み
async function loadSpeedData() {
  try {
    const speedDataArray = await loadCSV(SPEED_DATA_URL);
    
    // 速度データをオブジェクトに変換
    speedDataArray.forEach(row => {
      const key = `${row.年齢区分}_${row.活動種別}`;
      speedData[key] = {
        '5': parseFloat(row['5分(km)']) || 0,
        '10': parseFloat(row['10分(km)']) || 0,
        '15': parseFloat(row['15分(km)']) || 0
      };
    });
    
    // 初期表示
    updateCircle();
  } catch (error) {
    console.error('データ読み込みエラー:', error);
    alert('速度データの読み込みに失敗しました');
  }
}

// 体調による係数を取得（0-100% → 移動速度係数）
function getConditionMultiplier(conditionValue) {
  // 体調が悪いほど移動速度が低下
  // 0% → 0.5倍、50% → 0.75倍、100% → 1.0倍（線形補間）
  return 0.5 + (conditionValue / 100) * 0.5;
}

// 体調の表示を更新
function updateConditionDisplay(value) {
  const conditionValue = document.getElementById('conditionValue');
  const dots = ['dot1', 'dot2', 'dot3', 'dot4', 'dot5'];
  
  let conditionText, conditionClass;
  if (value >= 80) {
    conditionText = `良好 (${value}%)`;
    conditionClass = 'good';
  } else if (value >= 50) {
    conditionText = `普通 (${value}%)`;
    conditionClass = 'normal';
  } else {
    conditionText = `悪い (${value}%)`;
    conditionClass = 'bad';
  }
  
  conditionValue.textContent = conditionText;
  
  // ドットの表示を更新
  dots.forEach((dotId, index) => {
    const dot = document.getElementById(dotId);
    dot.className = 'condition-dot';
    const threshold = (index + 1) * 20;
    if (value >= threshold) {
      dot.classList.add('active', conditionClass);
    }
  });
}

// 到達可能範囲の円を更新
function updateCircle() {
  const age = document.getElementById('ageSelect').value;
  const transport = document.getElementById('transportSelect').value;
  const time = document.getElementById('timeSelect').value;
  const conditionValue = parseInt(document.getElementById('conditionSlider').value);
  
  // 基本距離を取得
  const speedKey = `${age}_${transport}`;
  const baseDistance = speedData[speedKey]?.[time] || 0;
  
  // 体調による係数を適用
  const conditionMultiplier = getConditionMultiplier(conditionValue);
  const adjustedDistance = baseDistance * conditionMultiplier;
  
  // 既存の円を削除
  if (reachableCircle) {
    map.removeLayer(reachableCircle);
  }
  
  // 新しい円を追加
  if (adjustedDistance > 0) {
    const radiusMeters = adjustedDistance * 1000; // km to m
    
    reachableCircle = L.circle([TENRI_STATION.lat, TENRI_STATION.lng], {
      radius: radiusMeters,
      color: '#667eea',
      fillColor: '#667eea',
      fillOpacity: 0.2,
      weight: 3,
      opacity: 0.8
    }).addTo(map);
    
    // 結果を表示
    const area = Math.PI * adjustedDistance * adjustedDistance; // km²
    
    document.getElementById('distanceValue').textContent = `${adjustedDistance.toFixed(2)} km`;
    document.getElementById('radiusValue').textContent = `${Math.round(radiusMeters)} m`;
    document.getElementById('areaValue').textContent = `${area.toFixed(2)} km²`;
    
    // 円が表示されるようにズーム調整（初回のみ）
    if (!map.getBounds().contains(reachableCircle.getBounds())) {
      map.fitBounds(reachableCircle.getBounds(), { padding: [50, 50] });
    }
  } else {
    document.getElementById('distanceValue').textContent = '- km';
    document.getElementById('radiusValue').textContent = '- m';
    document.getElementById('areaValue').textContent = '- km²';
  }
}

// イベントリスナー設定
function setupEventListeners() {
  // 年齢選択
  document.getElementById('ageSelect').addEventListener('change', updateCircle);
  
  // 移動手段選択
  document.getElementById('transportSelect').addEventListener('change', updateCircle);
  
  // 避難時間選択
  document.getElementById('timeSelect').addEventListener('change', updateCircle);
  
  // 体調スライダー
  const conditionSlider = document.getElementById('conditionSlider');
  conditionSlider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    updateConditionDisplay(value);
    updateCircle();
  });
  
  // 初期表示
  updateConditionDisplay(parseInt(conditionSlider.value));
}

// メイン処理
async function main() {
  initMap();
  await loadSpeedData();
  setupEventListeners();
}

main().catch(console.error);
