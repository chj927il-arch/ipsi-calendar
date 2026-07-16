module.exports = {
  // 대학어디가(adiga.kr) 대입일정 — 로그인 불필요, POST로 월별 HTML 조각을 받아옴
  adiga: {
    baseUrl: 'https://www.adiga.kr',
    viewPath: '/uct/cas/scheduleView.do?menuId=PCUCTCAS1000',
    ajaxPath: '/uct/cas/scheduleAjax.do',
    // 01=수시(ATR), 02=정시(FTR, 수능시험일 포함) — 실측 결과 이 둘이 핵심 "대입일정".
    // (UI의 '대학별 행사안내'/'대입 박람회·설명회' 체크박스는 searchScheduleType이 아닌
    //  별도 지역필터로 동작하는 것으로 보여 이번 범위에서는 제외)
    searchScheduleType: '01,02',
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
