module.exports = {
  // 대학어디가(adiga.kr) 대입일정 — 로그인 불필요, POST로 월별 HTML 조각을 받아옴
  adiga: {
    baseUrl: 'https://www.adiga.kr',
    viewPath: '/uct/cas/scheduleView.do?menuId=PCUCTCAS1000',
    ajaxPath: '/uct/cas/scheduleAjax.do',
    // 01=수시(ATR), 02=정시(FTR, 수능시험일 포함), 03=대학별 행사안내(PGM), 04=대입 박람회/설명회(EXPO)
    // — adiga.kr 화면의 체크박스 3개(대입일정/대학별 행사안내/대입 박람회·설명회)가 그대로 이 4개 코드에 대응.
    searchScheduleType: '01,02,03,04',
    // 크롤 시점 기준 월 범위. 수시(9~12월)·정시(1~2월)·수능(11월) 등 한 입시 주기를 커버
    monthsBefore: 1,
    monthsAfter: 14,
  },
  // 다가오는 일정 알림 기준(며칠 전에 알릴지). 0=당일
  reminderOffsets: [7, 3, 1, 0],
  port: 3000,
  dataDir: 'public/data',
  scheduleFile: 'public/data/schedule.json',
  pushLogFile: 'public/data/push-log.json',
};
