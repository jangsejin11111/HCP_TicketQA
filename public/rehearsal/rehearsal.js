const chapters = [
  ['계단식 논에서', 'qa-ch1'], ['묘지산에서', 'myojisan'], ['임도에서', 'imdo'],
  ['동굴에서', 'donggul'], ['터널에서', 'tunnel'], ['고속도로에서', 'highway'],
  ['계류장에서', 'gyeryu'], ['폐공장에서', 'pyegong'], ['매립지에서', 'maeripji'],
  ['도시에서', 'dosi'], ['컨테이너에서', 'container'], ['항구에서', 'hanggu'],
  ['바다에서', 'bada'], ['얼음섬에서', 'eoleum'], ['작은 얼음섬에서', 'jakeun']
];
const checkpoints = [
  ['4장 · 동굴 안', 'donggul-cave'], ['4장 · 조명 구간', 'donggul-light'],
  ['7장 · 계류장 앞', 'gyeryu-near'], ['8장 · 폐공장 내부', 'pyegong-in'],
  ['9장 · 도주 구간', 'maeripji-run'], ['10장 · 창문', 'dosi-window'],
  ['10장 · 트럭', 'dosi-truck'], ['12장 · 항구 줄서기', 'hanggu-queue']
];
const href = hash => '/?rehearsal=1#' + hash;
for (const [index, [name, hash]] of chapters.entries()) {
  const li = document.createElement('li'), a = document.createElement('a');
  a.href = href(hash); a.className = 'card'; a.dataset.chapter = index + 1;
  const number = document.createElement('span'); number.className = 'num'; number.textContent = `${String(index + 1).padStart(2, '0')}장`;
  const title = document.createElement('span'); title.className = 'name'; title.textContent = name;
  const go = document.createElement('span'); go.className = 'go'; go.textContent = '이 장부터 시작 →';
  a.append(number, title, go); li.append(a); document.querySelector('#chapters').append(li);
}
for (const [name, hash] of checkpoints) {
  const a = document.createElement('a'); a.href = href(hash); a.textContent = name;
  document.querySelector('#checkpoints').append(a);
}
