const days = [
  { date: "12 Sep", region: { en: "Chengdu · Qingcheng", zh: "成都 · 青城山" }, title: { en: "Welcome to Chengdu", zh: "抵达成都" }, desc: { en: "The first three guests arrive in Chengdu. Private airport meet-and-greet and transfer to Six Senses Qingcheng Mountain, followed by time to settle into the resort.", zh: "首批3位客人抵达成都，专人接机后前往六善青城山，入住并自由休息。" }, aside: { en: "First arrival wave", zh: "首批客人抵达" }, meta: { en: "Private airport transfer", zh: "私人接机" } },
  { date: "13 Sep", region: { en: "Qingcheng", zh: "青城山" }, title: { en: "Red Panda Field Experience", zh: "小熊猫志愿者体验" }, desc: { en: "Three guests join the Red Panda Forest Park programme: habitat care, supervised feeding and a keeper-led field adventure in a naturalistic setting. The remainder of the group arrives in Chengdu and transfers to Six Senses.", zh: "3位客人参加小熊猫森林公园志愿者项目，包括栖息地整理、在饲养员指导下喂食，并进入仿野生环境观察小熊猫日常。其余客人当天抵达成都并前往六善。" }, aside: { en: "Up to 3–4 hours", zh: "约3–4小时" }, meta: { en: "Split programme · Group reunion", zh: "分组活动 · 全团汇合" } },
  { date: "14 Sep", region: { en: "Wolong", zh: "卧龙" }, title: { en: "Giant Panda Keeper Programme", zh: "大熊猫饲养员体验" }, desc: { en: "A half-day keeper-style experience at Wolong Panda Base. Observe feeding routines, prepare bamboo and panda cake, learn about stool analysis and watch the year's young cubs at play. Activities follow the base's animal-welfare rules.", zh: "前往卧龙熊猫基地参加半日饲养员体验：观察喂养流程、准备竹子及窝窝头、了解粪便分析，并观看当年幼崽活动。所有环节以基地动物福利规定为准。" }, aside: { en: "Up to 6 hours", zh: "最长约6小时" }, meta: { en: "Full-group experience", zh: "全团活动" } },
  { date: "15 Sep", region: { en: "Chengdu → Dali", zh: "成都 → 大理" }, title: { en: "Fly to Dali", zh: "飞往大理" }, desc: { en: "Drive approximately two hours to Chengdu Tianfu Airport. Fly Air China CA2555 from TFU Terminal 2 at 13:35, arriving in Dali at 15:05. Private transfer to MUXI Dali · Huoshan Resort and check in.", zh: "驱车约2小时前往成都天府国际机场，乘坐国航CA2555（TFU T2 13:35起飞，15:05抵达大理）。专车前往木夕大里·伙山度假酒店入住。" }, aside: { en: "CA2555 · 13:35–15:05", zh: "CA2555 · 13:35–15:05" }, meta: { en: "Flight day", zh: "国内航班日" } },
  { date: "16 Sep", region: { en: "Dali", zh: "大理" }, title: { en: "Xizhou Village, Beyond the Crowds", zh: "喜洲古镇深度游" }, desc: { en: "Explore quieter corners of Xizhou, visiting traditional Bai houses and learning how merchant families shaped the village. Taste local Bai snacks and experience the texture of everyday life beyond the main tourist streets.", zh: "避开主要旅游动线，探访喜洲传统白族民居，了解商帮家族如何塑造古镇，并品尝白族特色小吃，感受主街之外的日常生活。" }, aside: { en: "Bai culture & local flavours", zh: "白族文化与地方风味" }, meta: { en: "Private guided visit", zh: "私人向导陪同" } },
  { date: "17 Sep", region: { en: "Dali · Cangshan", zh: "大理 · 苍山" }, title: { en: "Cangshan High Country & Jizhao Nunnery", zh: "苍山缆车与寂照庵" }, desc: { en: "Ride the Cangshan cable car into the high country for expansive views over Erhai Lake. Descend for a quiet Zen afternoon tea at Jizhao Nunnery, set among forest and flowers on the mountain slope.", zh: "乘坐苍山索道进入高山景观带，俯瞰洱海。下山后前往隐于林花之间的寂照庵，享用一场安静的禅意下午茶。" }, aside: { en: "Cable car operations weather-dependent", zh: "索道运营视天气而定" }, meta: { en: "Mountain day", zh: "高山体验" } },
  { date: "18 Sep", region: { en: "Dali → Lijiang", zh: "大理 → 丽江" }, title: { en: "Erhai Scenic Drive & Onward to Amandayan", zh: "洱海景观车游 · 前往安缦" }, desc: { en: "A private chauffeur-driven route around Erhai Lake, pausing at quieter viewpoints and making a light visit to Shuanglang. Continue by road to Lijiang and arrive at Amandayan in the late afternoon.", zh: "由私人司机带领环洱海景观车游，停靠小众观景点并轻游双廊，随后驱车前往丽江，于傍晚抵达大研安缦。" }, aside: { en: "Scenic drive + intercity transfer", zh: "环湖车游 + 城际转移" }, meta: { en: "Dali to Lijiang by road", zh: "大理陆路前往丽江" } },
  { date: "19 Sep", region: { en: "Lijiang", zh: "丽江" }, title: { en: "Dayan Market at Dawn, Baisha & Jade Lake", zh: "晨访大研市集 · 白沙与玉湖" }, desc: { en: "Begin with Amandayan's complimentary early-morning Dayan market walk, before the old city fully wakes. Continue to Baisha Ancient Town for Naxi heritage and onward to Jade Lake Village beneath Jade Dragon Snow Mountain.", zh: "清晨参加安缦赠送的大研市集漫步，在古城完全苏醒前感受本地生活。随后前往白沙古镇了解纳西文化，再探访玉龙雪山脚下的玉湖村。" }, aside: { en: "Complimentary Aman experience", zh: "安缦赠送体验" }, meta: { en: "Early start recommended", zh: "建议早起" } },
  { date: "20 Sep", region: { en: "Tiger Leaping Gorge", zh: "虎跳峡" }, title: { en: "Middle Gorge Guided Hike", zh: "虎跳峡中段徒步" }, desc: { en: "A guided medium-route hike through the middle section of Tiger Leaping Gorge. The trail reveals the Jinsha River far below, sheer mountain walls and the dramatic scale of one of the world's deepest gorges.", zh: "在徒步向导陪同下完成虎跳峡中段中等难度路线。沿途俯瞰金沙江，穿行于陡峭山壁之间，感受世界级峡谷的宏大尺度。" }, aside: { en: "Approximately 5 hours", zh: "约5小时" }, meta: { en: "Medium hiking route", zh: "中等难度徒步" } },
  { date: "21 Sep", region: { en: "Jade Dragon Snow Mountain", zh: "玉龙雪山" }, title: { en: "Snow Mountain, Blue Moon Valley & Impression Lijiang", zh: "玉龙雪山 · 蓝月谷 · 印象丽江" }, desc: { en: "Ascend Jade Dragon Snow Mountain by cable car, then explore the turquoise waters of Blue Moon Valley. Conclude with Impression Lijiang, viewed with VIP access against the mountain backdrop.", zh: "乘索道登上玉龙雪山，随后游览碧蓝的蓝月谷。最后以VIP席位观看《印象丽江》，雪山即是天然舞台背景。" }, aside: { en: "VIP show access", zh: "演出VIP席位" }, meta: { en: "High-altitude day", zh: "高海拔活动日" } },
  { date: "22 Sep", region: { en: "Lijiang → Chengdu", zh: "丽江 → 成都" }, title: { en: "Return to Chengdu", zh: "返回成都" }, desc: { en: "Transfer to Lijiang Sanyi Airport for Air China CA2568, departing at 15:50 and arriving at Chengdu Tianfu Terminal 2 at 17:20. Private transfer to The Upper House Chengdu and check in.", zh: "专车前往丽江三义机场，乘坐国航CA2568（15:50起飞，17:20抵达成都天府T2）。接机后入住成都博舍。" }, aside: { en: "CA2568 · 15:50–17:20", zh: "CA2568 · 15:50–17:20" }, meta: { en: "Flight day", zh: "国内航班日" } },
  { date: "23 Sep", region: { en: "Chengdu", zh: "成都" }, title: { en: "Optional Baby Panda Morning & Urban Chengdu", zh: "可选幼年熊猫晨间体验 · 成都城市漫游" }, desc: { en: "Optionally visit Chengdu Research Base in the morning for a keeper-interpreted look at young pandas; there is no hugging or holding component. Later, explore Chengdu's creative side around Dongjiao Memory and the neighbourhood life of Yulin Road.", zh: "早上可选前往成都大熊猫繁育研究基地，在讲解中观察幼年熊猫；不包含拥抱或抱持环节。下午探索东郊记忆与玉林路，了解成都的创意文化与街区生活。" }, aside: { en: "Optional morning experience", zh: "可选晨间体验" }, meta: { en: "City culture", zh: "城市文化" } },
  { date: "24 Sep", region: { en: "Chengdu", zh: "成都" }, title: { en: "First Departure Wave", zh: "首批客人离境" }, desc: { en: "Private airport transfers are arranged for guests departing on 24 September. Guests remaining in Chengdu enjoy a flexible day at leisure around Taikoo Li, the hotel or a final local meal.", zh: "为9月24日离境的客人安排私人送机。继续留宿的客人可在太古里、酒店或本地餐厅自由安排轻松的一天。" }, aside: { en: "Departure transfers as required", zh: "按航班安排送机" }, meta: { en: "Flexible schedule", zh: "弹性安排" } },
  { date: "25 Sep", region: { en: "Chengdu", zh: "成都" }, title: { en: "Final Departures", zh: "最后一批客人返程" }, desc: { en: "Breakfast at leisure, check out and private airport transfer for the remaining guests. The fourteen-day Southwest China journey concludes.", zh: "从容享用早餐后退房，为剩余客人安排私人送机，十四天川滇西南旅程圆满结束。" }, aside: { en: "Journey concludes", zh: "行程结束" }, meta: { en: "Private airport transfer", zh: "私人送机" } }
];

let currentLang = "en";
const timeline = document.getElementById("timeline");

function renderDays() {
  timeline.innerHTML = days.map((day, index) => `
    <article class="day-card reveal">
      <div class="day-marker">
        <div class="day-number">D${index + 1}</div>
        <div class="day-date">${day.date}</div>
      </div>
      <div class="day-panel">
        <div>
          <div class="day-region">${day.region[currentLang]}</div>
          <h3 class="day-title">${day.title[currentLang]}</h3>
          <p class="day-description">${day.desc[currentLang]}</p>
        </div>
        <aside class="day-aside"><strong>${day.aside[currentLang]}</strong><span>${day.meta[currentLang]}</span></aside>
      </div>
    </article>
  `).join("");
  observeReveals();
}

function switchLanguage(lang) {
  currentLang = lang;
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  document.title = lang === "zh"
    ? "川滇西南14天私人旅程 | Narelia Luxury"
    : "Southwest China · 14-Day Private Journey | Narelia Luxury";
  document.querySelectorAll("[data-en][data-zh]").forEach((element) => {
    const next = element.dataset[lang];
    if (next) element.innerHTML = next;
  });
  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.classList.toggle("active", button.dataset.lang === lang);
  });
  renderDays();
}

document.querySelectorAll("[data-lang]").forEach((button) => {
  button.addEventListener("click", () => switchLanguage(button.dataset.lang));
});

const nav = document.getElementById("siteNav");
window.addEventListener("scroll", () => nav.classList.toggle("scrolled", window.scrollY > 70), { passive: true });

let revealObserver;
function observeReveals() {
  if (revealObserver) revealObserver.disconnect();
  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.09, rootMargin: "0px 0px -30px" });
  document.querySelectorAll(".reveal:not(.visible)").forEach((element) => revealObserver.observe(element));
}

renderDays();
observeReveals();
