// Multi-country travel data. Each destination carries its phrasebook (5 scenario
// categories), a local cheat sheet, the language used for speech/AI translation,
// and its currency + a default TWD rate. Phrase pronunciation is a friendly
// approximation for a Chinese speaker, not strict IPA. Adding a country = adding
// one entry here; the UI is fully destination-driven.

import {
  Hand, Car, UtensilsCrossed, ShoppingBag, Siren,
  Phone, Coins, Plug, Droplets, HandHeart,
  type LucideIcon,
} from 'lucide-vue-next'

export interface PhraseItem {
  zh: string
  /** Native script — what TTS speaks. */
  native: string
  /** Friendly romanized pronunciation (for Vietnamese, a rough phonetic hint). */
  pron: string
}

export interface PhraseCategory {
  key: string
  label: string
  icon: LucideIcon
  hint: string
  items: PhraseItem[]
}

export interface CheatItem {
  icon: LucideIcon
  label: string
  value: string
}

export interface Currency {
  code: string
  symbol: string
  /** TWD per 1 unit of this currency (editable in the UI). */
  defaultRate: number
}

export interface Destination {
  id: string
  country: string
  city: string
  flag: string
  blurb: string
  /** Google TTS language code (tl). */
  ttsLang: 'th' | 'ja' | 'ko' | 'vi' | 'zh-TW'
  /** Target language name for the AI translator's system prompt. */
  translateLangName: string
  currency: Currency
  /** City coordinates + IANA timezone, for weather and local time. */
  lat: number
  lon: number
  timezone: string
  categories: PhraseCategory[]
  cheatSheet: CheatItem[]
}

// ---------------------------------------------------------------------------
// Thailand · Bangkok
// ---------------------------------------------------------------------------
const thailand: Destination = {
  id: 'thailand',
  country: '泰國',
  city: '曼谷 Bangkok',
  flag: '🇹🇭',
  blurb: '泰語句尾加 ครับ(男)/ค่ะ(女) 更禮貌。',
  ttsLang: 'th',
  translateLangName: 'Thai',
  currency: { code: 'THB', symbol: '฿', defaultRate: 0.92 },
  lat: 13.7563, lon: 100.5018, timezone: 'Asia/Bangkok',
  categories: [
    {
      key: 'basics', label: '基本問候', icon: Hand, hint: '萬用客套話。',
      items: [
        { zh: '你好', native: 'สวัสดีครับ', pron: 'sà-wàt-dii khráp' },
        { zh: '謝謝', native: 'ขอบคุณครับ', pron: 'khàwp-khun khráp' },
        { zh: '不好意思 / 對不起', native: 'ขอโทษครับ', pron: 'khǎw-thôot khráp' },
        { zh: '好的 / 可以', native: 'ได้ครับ', pron: 'dâi khráp' },
        { zh: '你會說英文嗎？', native: 'พูดภาษาอังกฤษได้ไหมครับ', pron: 'phûut paa-sǎa ang-grìt dâi mǎi khráp' },
        { zh: '我聽不懂', native: 'ผมไม่เข้าใจครับ', pron: 'phǒm mâi khâo-jai khráp' },
      ],
    },
    {
      key: 'transport', label: '交通 / 計程車', icon: Car, hint: '搭計程車先說「請跳表」。',
      items: [
        { zh: '請跳表（用計費表）', native: 'เปิดมิเตอร์ด้วยครับ', pron: 'pòet mí-tôe dûai khráp' },
        { zh: '我要去這裡（給看地址）', native: 'ไปที่นี่ครับ', pron: 'pai thîi-nîi khráp' },
        { zh: '到了請停這裡', native: 'จอดตรงนี้ครับ', pron: 'jàwt trong-níi khráp' },
        { zh: '大約多少錢？', native: 'ประมาณเท่าไหร่ครับ', pron: 'prà-maan thâo-rài khráp' },
        { zh: '最近的 BTS 站在哪？', native: 'สถานี BTS ที่ใกล้ที่สุดอยู่ที่ไหนครับ', pron: 'sà-thǎa-nii BTS thîi glâi thîi-sùt yùu thîi-nǎi khráp' },
      ],
    },
    {
      key: 'food', label: '餐廳 / 點餐', icon: UtensilsCrossed, hint: '怕辣一定要先說「不要辣」。',
      items: [
        { zh: '我要這個（指菜單）', native: 'เอาอันนี้ครับ', pron: 'ao an-níi khráp' },
        { zh: '不要辣', native: 'ไม่เผ็ดครับ', pron: 'mâi phèt khráp' },
        { zh: '好吃！', native: 'อร่อยครับ', pron: 'à-ràwy khráp' },
        { zh: '買單 / 結帳', native: 'เช็คบิลครับ', pron: 'chék-bin khráp' },
        { zh: '一杯水，謝謝', native: 'ขอน้ำหนึ่งแก้วครับ', pron: 'khǎw náam nùeng gâew khráp' },
      ],
    },
    {
      key: 'shopping', label: '購物 / 議價', icon: ShoppingBag, hint: '夜市攤販可議價，笑笑的最有效。',
      items: [
        { zh: '這個多少錢？', native: 'อันนี้เท่าไหร่ครับ', pron: 'an-níi thâo-rài khráp' },
        { zh: '太貴了', native: 'แพงไปครับ', pron: 'phaeng pai khráp' },
        { zh: '可以便宜一點嗎？', native: 'ลดได้ไหมครับ', pron: 'lót dâi mǎi khráp' },
        { zh: '我只是看看', native: 'ดูเฉยๆ ครับ', pron: 'duu chǒei-chǒei khráp' },
        { zh: '可以刷卡嗎？', native: 'รูดบัตรได้ไหมครับ', pron: 'rûut bàt dâi mǎi khráp' },
      ],
    },
    {
      key: 'emergency', label: '求助 / 緊急', icon: Siren, hint: '關鍵時刻用得上。',
      items: [
        { zh: '救命！', native: 'ช่วยด้วยครับ', pron: 'chûai dûai khráp' },
        { zh: '廁所在哪裡？', native: 'ห้องน้ำอยู่ที่ไหนครับ', pron: 'hâwng-náam yùu thîi-nǎi khráp' },
        { zh: '我迷路了', native: 'ผมหลงทางครับ', pron: 'phǒm lǒng-thaang khráp' },
        { zh: '我不舒服 / 生病了', native: 'ผมไม่สบายครับ', pron: 'phǒm mâi sà-baai khráp' },
        { zh: '請叫救護車', native: 'เรียกรถพยาบาลด้วยครับ', pron: 'rîak rót phá-yaa-baan dûai khráp' },
      ],
    },
  ],
  cheatSheet: [
    { icon: Phone, label: '緊急電話', value: '觀光警察 1155 ・ 警察 191 ・ 救護車 1669' },
    { icon: Coins, label: '小費文化', value: '餐廳找零留 20–50 泰銖；按摩、行李約 50–100 泰銖' },
    { icon: Car, label: '計程車', value: '上車先說「跳表 mí-tôe」；Grab 叫車最省心' },
    { icon: Plug, label: '插座電壓', value: '220V，插座 Type A/B/C，台灣電器多數可直接用' },
    { icon: Droplets, label: '飲水', value: '別生飲自來水，喝瓶裝水；冰塊一般 OK' },
    { icon: HandHeart, label: '問候禮儀', value: '雙手合十「wai」回禮；對王室與僧侶特別尊重' },
  ],
}

// ---------------------------------------------------------------------------
// Japan · Tokyo
// ---------------------------------------------------------------------------
const japan: Destination = {
  id: 'japan',
  country: '日本',
  city: '東京 Tokyo',
  flag: '🇯🇵',
  blurb: '禮貌、安靜、守秩序；不用給小費。',
  ttsLang: 'ja',
  translateLangName: 'Japanese',
  currency: { code: 'JPY', symbol: '¥', defaultRate: 0.21 },
  lat: 35.6762, lon: 139.6503, timezone: 'Asia/Tokyo',
  categories: [
    {
      key: 'basics', label: '基本問候', icon: Hand, hint: '「すみません」可同時表示不好意思/借過/叫人。',
      items: [
        { zh: '你好', native: 'こんにちは', pron: 'konnichiwa' },
        { zh: '謝謝', native: 'ありがとうございます', pron: 'arigatō gozaimasu' },
        { zh: '不好意思 / 借過', native: 'すみません', pron: 'sumimasen' },
        { zh: '好的 / 是', native: 'はい', pron: 'hai' },
        { zh: '你會說英文嗎？', native: '英語を話せますか', pron: 'eigo o hanasemasu ka' },
        { zh: '我聽不懂', native: 'わかりません', pron: 'wakarimasen' },
      ],
    },
    {
      key: 'transport', label: '交通 / 電車', icon: Car, hint: '用 IC 卡（Suica/Pasmo）刷進出最方便。',
      items: [
        { zh: '我想去這裡（給看）', native: 'ここに行きたいです', pron: 'koko ni ikitai desu' },
        { zh: '車站在哪裡？', native: '駅はどこですか', pron: 'eki wa doko desu ka' },
        { zh: '多少錢？', native: 'いくらですか', pron: 'ikura desu ka' },
        { zh: '請給我一張到～的票', native: '〜までの切符をください', pron: '~ made no kippu o kudasai' },
        { zh: '計程車招呼站在哪？', native: 'タクシー乗り場はどこですか', pron: 'takushī noriba wa doko desu ka' },
      ],
    },
    {
      key: 'food', label: '餐廳 / 點餐', icon: UtensilsCrossed, hint: '進門先說「一位」幾人，店員會帶位。',
      items: [
        { zh: '麻煩給我這個（指）', native: 'これをください', pron: 'kore o kudasai' },
        { zh: '請給我菜單', native: 'メニューをください', pron: 'menyū o kudasai' },
        { zh: '很好吃', native: 'おいしいです', pron: 'oishii desu' },
        { zh: '麻煩結帳', native: 'お会計お願いします', pron: 'o-kaikei onegai shimasu' },
        { zh: '請給我水', native: 'お水ください', pron: 'o-mizu kudasai' },
      ],
    },
    {
      key: 'shopping', label: '購物', icon: ShoppingBag, hint: '出示護照常可享免稅（免税）。',
      items: [
        { zh: '這個多少錢？', native: 'これはいくらですか', pron: 'kore wa ikura desu ka' },
        { zh: '可以刷卡嗎？', native: 'カードで払えますか', pron: 'kādo de haraemasu ka' },
        { zh: '我只是看看', native: '見ているだけです', pron: 'mite iru dake desu' },
        { zh: '可以免稅嗎？', native: '免税できますか', pron: 'menzei dekimasu ka' },
        { zh: '請給我這個', native: 'これをお願いします', pron: 'kore o onegai shimasu' },
      ],
    },
    {
      key: 'emergency', label: '求助 / 緊急', icon: Siren, hint: '警察 110、消防/救護 119。',
      items: [
        { zh: '救命！', native: '助けて', pron: 'tasukete' },
        { zh: '廁所在哪裡？', native: 'トイレはどこですか', pron: 'toire wa doko desu ka' },
        { zh: '我迷路了', native: '道に迷いました', pron: 'michi ni mayoimashita' },
        { zh: '我身體不舒服', native: '気分が悪いです', pron: 'kibun ga warui desu' },
        { zh: '請叫救護車', native: '救急車を呼んでください', pron: 'kyūkyūsha o yonde kudasai' },
      ],
    },
  ],
  cheatSheet: [
    { icon: Phone, label: '緊急電話', value: '警察 110 ・ 消防 / 救護 119' },
    { icon: Coins, label: '小費文化', value: '不用給小費；給了反而會讓對方困惑' },
    { icon: Car, label: '交通', value: 'JR / 地鐵密集，買 Suica/Pasmo IC 卡感應進出' },
    { icon: Plug, label: '插座電壓', value: '100V，插座 Type A（雙扁腳），台灣插頭可用、注意電壓' },
    { icon: Droplets, label: '飲水', value: '自來水可生飲；餐廳的水多免費' },
    { icon: HandHeart, label: '禮儀', value: '電車內勿講電話、不邊走邊吃、垃圾自己帶走' },
  ],
}

// ---------------------------------------------------------------------------
// Korea · Seoul
// ---------------------------------------------------------------------------
const korea: Destination = {
  id: 'korea',
  country: '韓國',
  city: '首爾 Seoul',
  flag: '🇰🇷',
  blurb: '長輩/店員面前用雙手收授更有禮。',
  ttsLang: 'ko',
  translateLangName: 'Korean',
  currency: { code: 'KRW', symbol: '₩', defaultRate: 0.024 },
  lat: 37.5665, lon: 126.9780, timezone: 'Asia/Seoul',
  categories: [
    {
      key: 'basics', label: '基本問候', icon: Hand, hint: '句尾「-요 yo」是禮貌語氣。',
      items: [
        { zh: '你好', native: '안녕하세요', pron: 'annyeong-haseyo' },
        { zh: '謝謝', native: '감사합니다', pron: 'gamsa-hamnida' },
        { zh: '對不起 / 不好意思', native: '죄송합니다', pron: 'joesong-hamnida' },
        { zh: '好的 / 是', native: '네', pron: 'ne' },
        { zh: '你會說英文嗎？', native: '영어 할 수 있어요?', pron: 'yeong-eo hal su isseoyo?' },
        { zh: '我聽不懂', native: '잘 모르겠어요', pron: 'jal moreugesseoyo' },
      ],
    },
    {
      key: 'transport', label: '交通 / 地鐵', icon: Car, hint: '用 T-money 卡搭地鐵、公車最方便。',
      items: [
        { zh: '請載我去這裡', native: '여기로 가 주세요', pron: 'yeogiro ga juseyo' },
        { zh: '地鐵站在哪裡？', native: '지하철역이 어디예요?', pron: 'jihacheol-yeogi eodiyeyo?' },
        { zh: '多少錢？', native: '얼마예요?', pron: 'eolmayeyo?' },
        { zh: '請停這裡', native: '여기서 세워 주세요', pron: 'yeogiseo sewo juseyo' },
        { zh: '計程車', native: '택시', pron: 'taeksi' },
      ],
    },
    {
      key: 'food', label: '餐廳 / 點餐', icon: UtensilsCrossed, hint: '小菜（반찬）通常免費續。',
      items: [
        { zh: '請給我這個', native: '이거 주세요', pron: 'igeo juseyo' },
        { zh: '請給我菜單', native: '메뉴 주세요', pron: 'menyu juseyo' },
        { zh: '好吃', native: '맛있어요', pron: 'masisseoyo' },
        { zh: '請幫我結帳', native: '계산해 주세요', pron: 'gyesanhae juseyo' },
        { zh: '請不要太辣', native: '안 맵게 해 주세요', pron: 'an maepge hae juseyo' },
      ],
    },
    {
      key: 'shopping', label: '購物', icon: ShoppingBag, hint: '市場可小議價，百貨則否。',
      items: [
        { zh: '這個多少錢？', native: '이거 얼마예요?', pron: 'igeo eolmayeyo?' },
        { zh: '可以刷卡嗎？', native: '카드 되나요?', pron: 'kadeu doenayo?' },
        { zh: '我只是看看', native: '그냥 구경하는 거예요', pron: 'geunyang gugyeong-haneun geoyeyo' },
        { zh: '可以算便宜點嗎？', native: '깎아 주세요', pron: 'kkakka juseyo' },
        { zh: '請給我這個', native: '이거 주세요', pron: 'igeo juseyo' },
      ],
    },
    {
      key: 'emergency', label: '求助 / 緊急', icon: Siren, hint: '警察 112、消防/救護 119。',
      items: [
        { zh: '請幫我 / 救命', native: '도와주세요', pron: 'dowajuseyo' },
        { zh: '廁所在哪裡？', native: '화장실 어디예요?', pron: 'hwajangsil eodiyeyo?' },
        { zh: '我迷路了', native: '길을 잃었어요', pron: 'gireul ireosseoyo' },
        { zh: '我不舒服 / 很痛', native: '아파요', pron: 'apayo' },
        { zh: '請叫救護車', native: '구급차 불러 주세요', pron: 'gugeupcha bulleo juseyo' },
      ],
    },
  ],
  cheatSheet: [
    { icon: Phone, label: '緊急電話', value: '警察 112 ・ 消防 / 救護 119' },
    { icon: Coins, label: '小費文化', value: '不用給小費；多數已含服務費' },
    { icon: Car, label: '交通', value: '地鐵發達，買 T-money 卡感應搭乘；Kakao T 叫車' },
    { icon: Plug, label: '插座電壓', value: '220V，插座 Type C/F（圓兩腳），台灣插頭需轉接' },
    { icon: Droplets, label: '飲水', value: '自來水官方可飲，腸胃敏感建議喝瓶裝水' },
    { icon: HandHeart, label: '禮儀', value: '雙手收授給長輩/店員、進屋脫鞋、地鐵讓博愛座' },
  ],
}

// ---------------------------------------------------------------------------
// Vietnam · Ho Chi Minh City
// ---------------------------------------------------------------------------
const vietnam: Destination = {
  id: 'vietnam',
  country: '越南',
  city: '胡志明市 Ho Chi Minh',
  flag: '🇻🇳',
  blurb: '越南文是拉丁字母；過馬路穩穩前進別急停。',
  ttsLang: 'vi',
  translateLangName: 'Vietnamese',
  currency: { code: 'VND', symbol: '₫', defaultRate: 0.0013 },
  lat: 10.8231, lon: 106.6297, timezone: 'Asia/Ho_Chi_Minh',
  categories: [
    {
      key: 'basics', label: '基本問候', icon: Hand, hint: '拼音是粗略發音提示，聲調以聽 TTS 為準。',
      items: [
        { zh: '你好', native: 'Xin chào', pron: 'sin chao' },
        { zh: '謝謝', native: 'Cảm ơn', pron: 'gám ern' },
        { zh: '對不起 / 不好意思', native: 'Xin lỗi', pron: 'sin loy' },
        { zh: '好 / 是', native: 'Dạ', pron: 'ya' },
        { zh: '你會說英文嗎？', native: 'Bạn nói tiếng Anh được không?', pron: 'ban nói tiéng anh duọc khong?' },
        { zh: '我聽不懂', native: 'Tôi không hiểu', pron: 'toi khong hiểu' },
      ],
    },
    {
      key: 'transport', label: '交通', icon: Car, hint: 'Grab（機車/汽車）最方便、價格透明。',
      items: [
        { zh: '請帶我去這裡', native: 'Cho tôi đến đây', pron: 'cho toi dén day' },
        { zh: '車站在哪裡？', native: 'Bến xe ở đâu?', pron: 'bén se ẻ dau?' },
        { zh: '多少錢？', native: 'Bao nhiêu tiền?', pron: 'bao nyeu tièn?' },
        { zh: '請跳表（計程車）', native: 'Mở đồng hồ', pron: 'mẻ dòng hò' },
        { zh: '請停這裡', native: 'Dừng ở đây', pron: 'zùng ẻ day' },
      ],
    },
    {
      key: 'food', label: '餐廳 / 點餐', icon: UtensilsCrossed, hint: '路邊攤先確認價格再點。',
      items: [
        { zh: '請給我這個', native: 'Cho tôi cái này', pron: 'cho toi cái nài' },
        { zh: '請給我菜單', native: 'Cho tôi thực đơn', pron: 'cho toi thực dern' },
        { zh: '好吃', native: 'Ngon quá', pron: 'ngon goá' },
        { zh: '結帳', native: 'Tính tiền', pron: 'tính tièn' },
        { zh: '不要辣', native: 'Không cay', pron: 'khong cay' },
      ],
    },
    {
      key: 'shopping', label: '購物 / 議價', icon: ShoppingBag, hint: '市場議價很正常，可從對折開始喊。',
      items: [
        { zh: '這個多少錢？', native: 'Cái này bao nhiêu?', pron: 'cái nài bao nyeu?' },
        { zh: '太貴了', native: 'Đắt quá', pron: 'dắt goá' },
        { zh: '可以便宜一點嗎？', native: 'Giảm giá được không?', pron: 'zảm zá duọc khong?' },
        { zh: '我只是看看', native: 'Tôi chỉ xem thôi', pron: 'toi chỉ sem thoi' },
        { zh: '可以刷卡嗎？', native: 'Trả bằng thẻ được không?', pron: 'cha bằng thẻ duọc khong?' },
      ],
    },
    {
      key: 'emergency', label: '求助 / 緊急', icon: Siren, hint: '警察 113、消防 114、救護 115。',
      items: [
        { zh: '救命！', native: 'Cứu với', pron: 'cứu vớy' },
        { zh: '廁所在哪裡？', native: 'Nhà vệ sinh ở đâu?', pron: 'nyà vẹ sinh ẻ dau?' },
        { zh: '我迷路了', native: 'Tôi bị lạc', pron: 'toi bị lạc' },
        { zh: '我不舒服 / 生病了', native: 'Tôi bị ốm', pron: 'toi bị óm' },
        { zh: '請叫救護車', native: 'Gọi xe cứu thương', pron: 'gọi se cứu thuerng' },
      ],
    },
  ],
  cheatSheet: [
    { icon: Phone, label: '緊急電話', value: '警察 113 ・ 消防 114 ・ 救護 115' },
    { icon: Coins, label: '小費文化', value: '非必須；餐廳/飯店/按摩給少許很受歡迎' },
    { icon: Car, label: '交通', value: 'Grab 最方便；計程車選 Vinasun、Mai Linh 較可靠' },
    { icon: Plug, label: '插座電壓', value: '220V，插座 Type A/C（雙扁/圓腳），台灣多數可用' },
    { icon: Droplets, label: '飲水', value: '只喝瓶裝水；冰塊看店家衛生' },
    { icon: HandHeart, label: '禮儀', value: '過馬路穩定前進別突然停；金額大、習慣議價' },
  ],
}

// ---------------------------------------------------------------------------
// Taiwan · Nationwide (domestic trips). The traveller already speaks Mandarin,
// so the phrasebook is Taiwanese Hokkien (台語) with Tâi-lô romanization — handy
// for elders, night-market vendors and rural shops. The speak button uses the
// zh-TW voice, so it reads the Han characters in Mandarin (a reference reading);
// the 台羅拼音 line shows the actual Taiwanese pronunciation.
// ---------------------------------------------------------------------------
const taiwan: Destination = {
  id: 'taiwan',
  country: '台灣',
  city: '全台 Taiwan',
  flag: '🇹🇼',
  blurb: '台語小幫手：對長輩、在地店家、夜市攤販開口更親切（發音鈕為華語朗讀參考，發音以台羅拼音為準）。',
  ttsLang: 'zh-TW',
  translateLangName: 'Taiwanese Hokkien (台語/台灣閩南語)',
  currency: { code: 'TWD', symbol: 'NT$', defaultRate: 1 },
  lat: 25.0330, lon: 121.5654, timezone: 'Asia/Taipei',
  categories: [
    {
      key: 'basics', label: '基本問候', icon: Hand, hint: '台語問候常用「食飽未」當開場白。',
      items: [
        { zh: '你好', native: '你好', pron: 'lí-hó' },
        { zh: '吃飽了嗎？（招呼語）', native: '食飽未？', pron: 'tsia̍h-pá--bē?' },
        { zh: '謝謝', native: '多謝', pron: 'to-siā' },
        { zh: '不好意思 / 抱歉', native: '歹勢', pron: 'pháinn-sè' },
        { zh: '沒關係', native: '無要緊', pron: 'bô-iàu-kín' },
        { zh: '我聽不懂', native: '我聽無', pron: 'guá thiann-bô' },
      ],
    },
    {
      key: 'transport', label: '交通 / 搭車', icon: Car, hint: '搭計程車先問車資，給看地址最快。',
      items: [
        { zh: '到這裡要多少錢？', native: '這欲偌濟錢？', pron: 'tse beh guā-tsē tsînn?' },
        { zh: '載我去這（給看地址）', native: '載我去遮', pron: 'tsài guá khì tsia' },
        { zh: '下一站是哪裡？', native: '後一站是佗位？', pron: 'āu tsi̍t tsām sī tó-uī?' },
        { zh: '到了，停這裡', native: '到位矣，停遮', pron: 'kàu-uī--ah, thîng tsia' },
        { zh: '火車站在哪裡？', native: '火車站佇佗位？', pron: 'hué-tshia-tsām tī tó-uī?' },
      ],
    },
    {
      key: 'food', label: '吃飯 / 點菜', icon: UtensilsCrossed, hint: '小吃攤、夜市開口用台語特別有親切感。',
      items: [
        { zh: '我要這個（指）', native: '我欲這个', pron: 'guá beh tsit-ê' },
        { zh: '好吃！', native: '好食！', pron: 'hó-tsia̍h!' },
        { zh: '別太鹹 / 別太油', native: '莫傷鹹', pron: 'mài siunn kiâm' },
        { zh: '一碗就好', native: '一碗就好', pron: 'tsi̍t uánn tō hó' },
        { zh: '內用 / 外帶', native: '內用 / 包轉去', pron: 'lāi-iōng / pau tńg-khì' },
        { zh: '結帳 / 算錢', native: '算錢', pron: 'sǹg-tsînn' },
      ],
    },
    {
      key: 'shopping', label: '買東西 / 議價', icon: ShoppingBag, hint: '傳統市場、夜市可小議價，百貨則否。',
      items: [
        { zh: '這個多少錢？', native: '這偌濟錢？', pron: 'tse guā-tsē tsînn?' },
        { zh: '太貴了', native: '傷貴矣', pron: 'siunn kuì--ah' },
        { zh: '可以便宜一點嗎？', native: '會使較俗無？', pron: 'ē-sái khah sio̍k--bô?' },
        { zh: '我看看', native: '我看覓咧', pron: 'guá khuànn-māi--leh' },
        { zh: '可以刷卡嗎？', native: '通刷卡無？', pron: 'thang suah-khah--bô?' },
      ],
    },
    {
      key: 'emergency', label: '求助 / 緊急', icon: Siren, hint: '警察 110、消防/救護 119、手機統一緊急 112。',
      items: [
        { zh: '救命！', native: '救人喔！', pron: 'kiù-lâng--ooh!' },
        { zh: '廁所在哪裡？', native: '便所佇佗位？', pron: 'piān-sóo tī tó-uī?' },
        { zh: '我迷路了', native: '我揣無路', pron: 'guá tshuē-bô lōo' },
        { zh: '我不舒服 / 生病了', native: '我人無爽快', pron: 'guá lâng bô sóng-khuài' },
        { zh: '快叫救護車', native: '緊叫救護車', pron: 'kín kiò kiù-hōo-tshia' },
      ],
    },
  ],
  cheatSheet: [
    { icon: Phone, label: '緊急電話', value: '警察 110 ・ 消防 / 救護 119 ・ 手機統一緊急 112' },
    { icon: Coins, label: '小費文化', value: '原則上免小費；多數中大型餐廳已收 10% 服務費' },
    { icon: Car, label: '交通', value: '悠遊卡/一卡通搭捷運、公車、台鐵；長途高鐵或客運，市區 Uber/小黃' },
    { icon: Plug, label: '插座電壓', value: '110V，插座 Type A/B（雙扁腳），與家中電器相同' },
    { icon: Droplets, label: '飲水', value: '自來水煮沸可飲；超商與公共飲水機、瓶裝水普及' },
    { icon: HandHeart, label: '在地提醒', value: '台語對長輩/在地店家特別親切；機車多、過馬路看左右；多數店家收行動支付' },
  ],
}

export const destinations: Destination[] = [thailand, japan, korea, vietnam, taiwan]

export function destinationById(id: string | null | undefined): Destination {
  return destinations.find((d) => d.id === id) ?? destinations[0]
}
