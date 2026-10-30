/**
 * Country-level region data. Access control is restricted to ISO 3166-1
 * alpha-2 country codes; provinces exist only as a display detail for the IP
 * location label of mainland China content.
 */
export interface RegionOption {
  code: string;
  name: string;
  nameEn: string;
}

export const REGION_OPTIONS: RegionOption[] = [
  { code: 'AD', name: '安道尔', nameEn: 'Andorra' },
  { code: 'AE', name: '阿联酋', nameEn: 'United Arab Emirates' },
  { code: 'AF', name: '阿富汗', nameEn: 'Afghanistan' },
  { code: 'AG', name: '安提瓜和巴布达', nameEn: 'Antigua and Barbuda' },
  { code: 'AI', name: '安圭拉', nameEn: 'Anguilla' },
  { code: 'AL', name: '阿尔巴尼亚', nameEn: 'Albania' },
  { code: 'AM', name: '亚美尼亚', nameEn: 'Armenia' },
  { code: 'AO', name: '安哥拉', nameEn: 'Angola' },
  { code: 'AQ', name: '南极洲', nameEn: 'Antarctica' },
  { code: 'AR', name: '阿根廷', nameEn: 'Argentina' },
  { code: 'AS', name: '美属萨摩亚', nameEn: 'American Samoa' },
  { code: 'AT', name: '奥地利', nameEn: 'Austria' },
  { code: 'AU', name: '澳大利亚', nameEn: 'Australia' },
  { code: 'AW', name: '阿鲁巴', nameEn: 'Aruba' },
  { code: 'AX', name: '奥兰群岛', nameEn: 'Åland Islands' },
  { code: 'AZ', name: '阿塞拜疆', nameEn: 'Azerbaijan' },
  { code: 'BA', name: '波黑', nameEn: 'Bosnia and Herzegovina' },
  { code: 'BB', name: '巴巴多斯', nameEn: 'Barbados' },
  { code: 'BD', name: '孟加拉国', nameEn: 'Bangladesh' },
  { code: 'BE', name: '比利时', nameEn: 'Belgium' },
  { code: 'BF', name: '布基纳法索', nameEn: 'Burkina Faso' },
  { code: 'BG', name: '保加利亚', nameEn: 'Bulgaria' },
  { code: 'BH', name: '巴林', nameEn: 'Bahrain' },
  { code: 'BI', name: '布隆迪', nameEn: 'Burundi' },
  { code: 'BJ', name: '贝宁', nameEn: 'Benin' },
  { code: 'BL', name: '圣巴泰勒米', nameEn: 'Saint Barthélemy' },
  { code: 'BM', name: '百慕大', nameEn: 'Bermuda' },
  { code: 'BN', name: '文莱', nameEn: 'Brunei' },
  { code: 'BO', name: '玻利维亚', nameEn: 'Bolivia' },
  { code: 'BQ', name: '荷属加勒比', nameEn: 'Caribbean Netherlands' },
  { code: 'BR', name: '巴西', nameEn: 'Brazil' },
  { code: 'BS', name: '巴哈马', nameEn: 'Bahamas' },
  { code: 'BT', name: '不丹', nameEn: 'Bhutan' },
  { code: 'BV', name: '布韦岛', nameEn: 'Bouvet Island' },
  { code: 'BW', name: '博茨瓦纳', nameEn: 'Botswana' },
  { code: 'BY', name: '白俄罗斯', nameEn: 'Belarus' },
  { code: 'BZ', name: '伯利兹', nameEn: 'Belize' },
  { code: 'CA', name: '加拿大', nameEn: 'Canada' },
  { code: 'CC', name: '科科斯群岛', nameEn: 'Cocos Islands' },
  { code: 'CD', name: '刚果（金）', nameEn: 'DR Congo' },
  { code: 'CF', name: '中非', nameEn: 'Central African Republic' },
  { code: 'CG', name: '刚果（布）', nameEn: 'Congo' },
  { code: 'CH', name: '瑞士', nameEn: 'Switzerland' },
  { code: 'CI', name: '科特迪瓦', nameEn: "Côte d'Ivoire" },
  { code: 'CK', name: '库克群岛', nameEn: 'Cook Islands' },
  { code: 'CL', name: '智利', nameEn: 'Chile' },
  { code: 'CM', name: '喀麦隆', nameEn: 'Cameroon' },
  { code: 'CN', name: '中国', nameEn: 'China' },
  { code: 'CO', name: '哥伦比亚', nameEn: 'Colombia' },
  { code: 'CR', name: '哥斯达黎加', nameEn: 'Costa Rica' },
  { code: 'CU', name: '古巴', nameEn: 'Cuba' },
  { code: 'CV', name: '佛得角', nameEn: 'Cape Verde' },
  { code: 'CW', name: '库拉索', nameEn: 'Curaçao' },
  { code: 'CX', name: '圣诞岛', nameEn: 'Christmas Island' },
  { code: 'CY', name: '塞浦路斯', nameEn: 'Cyprus' },
  { code: 'CZ', name: '捷克', nameEn: 'Czechia' },
  { code: 'DE', name: '德国', nameEn: 'Germany' },
  { code: 'DJ', name: '吉布提', nameEn: 'Djibouti' },
  { code: 'DK', name: '丹麦', nameEn: 'Denmark' },
  { code: 'DM', name: '多米尼克', nameEn: 'Dominica' },
  { code: 'DO', name: '多米尼加', nameEn: 'Dominican Republic' },
  { code: 'DZ', name: '阿尔及利亚', nameEn: 'Algeria' },
  { code: 'EC', name: '厄瓜多尔', nameEn: 'Ecuador' },
  { code: 'EE', name: '爱沙尼亚', nameEn: 'Estonia' },
  { code: 'EG', name: '埃及', nameEn: 'Egypt' },
  { code: 'EH', name: '西撒哈拉', nameEn: 'Western Sahara' },
  { code: 'ER', name: '厄立特里亚', nameEn: 'Eritrea' },
  { code: 'ES', name: '西班牙', nameEn: 'Spain' },
  { code: 'ET', name: '埃塞俄比亚', nameEn: 'Ethiopia' },
  { code: 'FI', name: '芬兰', nameEn: 'Finland' },
  { code: 'FJ', name: '斐济', nameEn: 'Fiji' },
  { code: 'FK', name: '福克兰群岛', nameEn: 'Falkland Islands' },
  { code: 'FM', name: '密克罗尼西亚', nameEn: 'Micronesia' },
  { code: 'FO', name: '法罗群岛', nameEn: 'Faroe Islands' },
  { code: 'FR', name: '法国', nameEn: 'France' },
  { code: 'GA', name: '加蓬', nameEn: 'Gabon' },
  { code: 'GB', name: '英国', nameEn: 'United Kingdom' },
  { code: 'GD', name: '格林纳达', nameEn: 'Grenada' },
  { code: 'GE', name: '格鲁吉亚', nameEn: 'Georgia' },
  { code: 'GF', name: '法属圭亚那', nameEn: 'French Guiana' },
  { code: 'GG', name: '根西岛', nameEn: 'Guernsey' },
  { code: 'GH', name: '加纳', nameEn: 'Ghana' },
  { code: 'GI', name: '直布罗陀', nameEn: 'Gibraltar' },
  { code: 'GL', name: '格陵兰', nameEn: 'Greenland' },
  { code: 'GM', name: '冈比亚', nameEn: 'Gambia' },
  { code: 'GN', name: '几内亚', nameEn: 'Guinea' },
  { code: 'GP', name: '瓜德罗普', nameEn: 'Guadeloupe' },
  { code: 'GQ', name: '赤道几内亚', nameEn: 'Equatorial Guinea' },
  { code: 'GR', name: '希腊', nameEn: 'Greece' },
  {
    code: 'GS',
    name: '南乔治亚和南桑威奇群岛',
    nameEn: 'South Georgia and the South Sandwich Islands',
  },
  { code: 'GT', name: '危地马拉', nameEn: 'Guatemala' },
  { code: 'GU', name: '关岛', nameEn: 'Guam' },
  { code: 'GW', name: '几内亚比绍', nameEn: 'Guinea-Bissau' },
  { code: 'GY', name: '圭亚那', nameEn: 'Guyana' },
  { code: 'HK', name: '中国香港', nameEn: 'Hong Kong' },
  {
    code: 'HM',
    name: '赫德岛和麦克唐纳群岛',
    nameEn: 'Heard Island and McDonald Islands',
  },
  { code: 'HN', name: '洪都拉斯', nameEn: 'Honduras' },
  { code: 'HR', name: '克罗地亚', nameEn: 'Croatia' },
  { code: 'HT', name: '海地', nameEn: 'Haiti' },
  { code: 'HU', name: '匈牙利', nameEn: 'Hungary' },
  { code: 'ID', name: '印度尼西亚', nameEn: 'Indonesia' },
  { code: 'IE', name: '爱尔兰', nameEn: 'Ireland' },
  { code: 'IL', name: '以色列', nameEn: 'Israel' },
  { code: 'IM', name: '马恩岛', nameEn: 'Isle of Man' },
  { code: 'IN', name: '印度', nameEn: 'India' },
  { code: 'IO', name: '英属印度洋领地', nameEn: 'British Indian Ocean Territory' },
  { code: 'IQ', name: '伊拉克', nameEn: 'Iraq' },
  { code: 'IR', name: '伊朗', nameEn: 'Iran' },
  { code: 'IS', name: '冰岛', nameEn: 'Iceland' },
  { code: 'IT', name: '意大利', nameEn: 'Italy' },
  { code: 'JE', name: '泽西岛', nameEn: 'Jersey' },
  { code: 'JM', name: '牙买加', nameEn: 'Jamaica' },
  { code: 'JO', name: '约旦', nameEn: 'Jordan' },
  { code: 'JP', name: '日本', nameEn: 'Japan' },
  { code: 'KE', name: '肯尼亚', nameEn: 'Kenya' },
  { code: 'KG', name: '吉尔吉斯斯坦', nameEn: 'Kyrgyzstan' },
  { code: 'KH', name: '柬埔寨', nameEn: 'Cambodia' },
  { code: 'KI', name: '基里巴斯', nameEn: 'Kiribati' },
  { code: 'KM', name: '科摩罗', nameEn: 'Comoros' },
  { code: 'KN', name: '圣基茨和尼维斯', nameEn: 'Saint Kitts and Nevis' },
  { code: 'KP', name: '朝鲜', nameEn: 'North Korea' },
  { code: 'KR', name: '韩国', nameEn: 'South Korea' },
  { code: 'KW', name: '科威特', nameEn: 'Kuwait' },
  { code: 'KY', name: '开曼群岛', nameEn: 'Cayman Islands' },
  { code: 'KZ', name: '哈萨克斯坦', nameEn: 'Kazakhstan' },
  { code: 'LA', name: '老挝', nameEn: 'Laos' },
  { code: 'LB', name: '黎巴嫩', nameEn: 'Lebanon' },
  { code: 'LC', name: '圣卢西亚', nameEn: 'Saint Lucia' },
  { code: 'LI', name: '列支敦士登', nameEn: 'Liechtenstein' },
  { code: 'LK', name: '斯里兰卡', nameEn: 'Sri Lanka' },
  { code: 'LR', name: '利比里亚', nameEn: 'Liberia' },
  { code: 'LS', name: '莱索托', nameEn: 'Lesotho' },
  { code: 'LT', name: '立陶宛', nameEn: 'Lithuania' },
  { code: 'LU', name: '卢森堡', nameEn: 'Luxembourg' },
  { code: 'LV', name: '拉脱维亚', nameEn: 'Latvia' },
  { code: 'LY', name: '利比亚', nameEn: 'Libya' },
  { code: 'MA', name: '摩洛哥', nameEn: 'Morocco' },
  { code: 'MC', name: '摩纳哥', nameEn: 'Monaco' },
  { code: 'MD', name: '摩尔多瓦', nameEn: 'Moldova' },
  { code: 'ME', name: '黑山', nameEn: 'Montenegro' },
  { code: 'MF', name: '法属圣马丁', nameEn: 'Saint Martin' },
  { code: 'MG', name: '马达加斯加', nameEn: 'Madagascar' },
  { code: 'MH', name: '马绍尔群岛', nameEn: 'Marshall Islands' },
  { code: 'MK', name: '北马其顿', nameEn: 'North Macedonia' },
  { code: 'ML', name: '马里', nameEn: 'Mali' },
  { code: 'MM', name: '缅甸', nameEn: 'Myanmar' },
  { code: 'MN', name: '蒙古', nameEn: 'Mongolia' },
  { code: 'MO', name: '中国澳门', nameEn: 'Macao' },
  { code: 'MP', name: '北马里亚纳群岛', nameEn: 'Northern Mariana Islands' },
  { code: 'MQ', name: '马提尼克', nameEn: 'Martinique' },
  { code: 'MR', name: '毛里塔尼亚', nameEn: 'Mauritania' },
  { code: 'MS', name: '蒙特塞拉特', nameEn: 'Montserrat' },
  { code: 'MT', name: '马耳他', nameEn: 'Malta' },
  { code: 'MU', name: '毛里求斯', nameEn: 'Mauritius' },
  { code: 'MV', name: '马尔代夫', nameEn: 'Maldives' },
  { code: 'MW', name: '马拉维', nameEn: 'Malawi' },
  { code: 'MX', name: '墨西哥', nameEn: 'Mexico' },
  { code: 'MY', name: '马来西亚', nameEn: 'Malaysia' },
  { code: 'MZ', name: '莫桑比克', nameEn: 'Mozambique' },
  { code: 'NA', name: '纳米比亚', nameEn: 'Namibia' },
  { code: 'NC', name: '新喀里多尼亚', nameEn: 'New Caledonia' },
  { code: 'NE', name: '尼日尔', nameEn: 'Niger' },
  { code: 'NF', name: '诺福克岛', nameEn: 'Norfolk Island' },
  { code: 'NG', name: '尼日利亚', nameEn: 'Nigeria' },
  { code: 'NI', name: '尼加拉瓜', nameEn: 'Nicaragua' },
  { code: 'NL', name: '荷兰', nameEn: 'Netherlands' },
  { code: 'NO', name: '挪威', nameEn: 'Norway' },
  { code: 'NP', name: '尼泊尔', nameEn: 'Nepal' },
  { code: 'NR', name: '瑙鲁', nameEn: 'Nauru' },
  { code: 'NU', name: '纽埃', nameEn: 'Niue' },
  { code: 'NZ', name: '新西兰', nameEn: 'New Zealand' },
  { code: 'OM', name: '阿曼', nameEn: 'Oman' },
  { code: 'PA', name: '巴拿马', nameEn: 'Panama' },
  { code: 'PE', name: '秘鲁', nameEn: 'Peru' },
  { code: 'PF', name: '法属波利尼西亚', nameEn: 'French Polynesia' },
  { code: 'PG', name: '巴布亚新几内亚', nameEn: 'Papua New Guinea' },
  { code: 'PH', name: '菲律宾', nameEn: 'Philippines' },
  { code: 'PK', name: '巴基斯坦', nameEn: 'Pakistan' },
  { code: 'PL', name: '波兰', nameEn: 'Poland' },
  { code: 'PM', name: '圣皮埃尔和密克隆', nameEn: 'Saint Pierre and Miquelon' },
  { code: 'PN', name: '皮特凯恩群岛', nameEn: 'Pitcairn Islands' },
  { code: 'PR', name: '波多黎各', nameEn: 'Puerto Rico' },
  { code: 'PS', name: '巴勒斯坦', nameEn: 'Palestine' },
  { code: 'PT', name: '葡萄牙', nameEn: 'Portugal' },
  { code: 'PW', name: '帕劳', nameEn: 'Palau' },
  { code: 'PY', name: '巴拉圭', nameEn: 'Paraguay' },
  { code: 'QA', name: '卡塔尔', nameEn: 'Qatar' },
  { code: 'RE', name: '留尼汪', nameEn: 'Réunion' },
  { code: 'RO', name: '罗马尼亚', nameEn: 'Romania' },
  { code: 'RS', name: '塞尔维亚', nameEn: 'Serbia' },
  { code: 'RU', name: '俄罗斯', nameEn: 'Russia' },
  { code: 'RW', name: '卢旺达', nameEn: 'Rwanda' },
  { code: 'SA', name: '沙特阿拉伯', nameEn: 'Saudi Arabia' },
  { code: 'SB', name: '所罗门群岛', nameEn: 'Solomon Islands' },
  { code: 'SC', name: '塞舌尔', nameEn: 'Seychelles' },
  { code: 'SD', name: '苏丹', nameEn: 'Sudan' },
  { code: 'SE', name: '瑞典', nameEn: 'Sweden' },
  { code: 'SG', name: '新加坡', nameEn: 'Singapore' },
  { code: 'SH', name: '圣赫勒拿', nameEn: 'Saint Helena' },
  { code: 'SI', name: '斯洛文尼亚', nameEn: 'Slovenia' },
  { code: 'SJ', name: '斯瓦尔巴和扬马延', nameEn: 'Svalbard and Jan Mayen' },
  { code: 'SK', name: '斯洛伐克', nameEn: 'Slovakia' },
  { code: 'SL', name: '塞拉利昂', nameEn: 'Sierra Leone' },
  { code: 'SM', name: '圣马力诺', nameEn: 'San Marino' },
  { code: 'SN', name: '塞内加尔', nameEn: 'Senegal' },
  { code: 'SO', name: '索马里', nameEn: 'Somalia' },
  { code: 'SR', name: '苏里南', nameEn: 'Suriname' },
  { code: 'SS', name: '南苏丹', nameEn: 'South Sudan' },
  { code: 'ST', name: '圣多美和普林西比', nameEn: 'São Tomé and Príncipe' },
  { code: 'SV', name: '萨尔瓦多', nameEn: 'El Salvador' },
  { code: 'SX', name: '荷属圣马丁', nameEn: 'Sint Maarten' },
  { code: 'SY', name: '叙利亚', nameEn: 'Syria' },
  { code: 'SZ', name: '斯威士兰', nameEn: 'Eswatini' },
  { code: 'TC', name: '特克斯和凯科斯群岛', nameEn: 'Turks and Caicos Islands' },
  { code: 'TD', name: '乍得', nameEn: 'Chad' },
  { code: 'TF', name: '法属南部领地', nameEn: 'French Southern Territories' },
  { code: 'TG', name: '多哥', nameEn: 'Togo' },
  { code: 'TH', name: '泰国', nameEn: 'Thailand' },
  { code: 'TJ', name: '塔吉克斯坦', nameEn: 'Tajikistan' },
  { code: 'TK', name: '托克劳', nameEn: 'Tokelau' },
  { code: 'TL', name: '东帝汶', nameEn: 'Timor-Leste' },
  { code: 'TM', name: '土库曼斯坦', nameEn: 'Turkmenistan' },
  { code: 'TN', name: '突尼斯', nameEn: 'Tunisia' },
  { code: 'TO', name: '汤加', nameEn: 'Tonga' },
  { code: 'TR', name: '土耳其', nameEn: 'Türkiye' },
  { code: 'TT', name: '特立尼达和多巴哥', nameEn: 'Trinidad and Tobago' },
  { code: 'TV', name: '图瓦卢', nameEn: 'Tuvalu' },
  { code: 'TW', name: '中国台湾', nameEn: 'Taiwan' },
  { code: 'TZ', name: '坦桑尼亚', nameEn: 'Tanzania' },
  { code: 'UA', name: '乌克兰', nameEn: 'Ukraine' },
  { code: 'UG', name: '乌干达', nameEn: 'Uganda' },
  {
    code: 'UM',
    name: '美国本土外小岛屿',
    nameEn: 'United States Minor Outlying Islands',
  },
  { code: 'US', name: '美国', nameEn: 'United States' },
  { code: 'UY', name: '乌拉圭', nameEn: 'Uruguay' },
  { code: 'UZ', name: '乌兹别克斯坦', nameEn: 'Uzbekistan' },
  { code: 'VA', name: '梵蒂冈', nameEn: 'Vatican City' },
  { code: 'VC', name: '圣文森特和格林纳丁斯', nameEn: 'Saint Vincent and the Grenadines' },
  { code: 'VE', name: '委内瑞拉', nameEn: 'Venezuela' },
  { code: 'VG', name: '英属维尔京群岛', nameEn: 'British Virgin Islands' },
  { code: 'VI', name: '美属维尔京群岛', nameEn: 'U.S. Virgin Islands' },
  { code: 'VN', name: '越南', nameEn: 'Vietnam' },
  { code: 'VU', name: '瓦努阿图', nameEn: 'Vanuatu' },
  { code: 'WF', name: '瓦利斯和富图纳', nameEn: 'Wallis and Futuna' },
  { code: 'WS', name: '萨摩亚', nameEn: 'Samoa' },
  { code: 'XK', name: '科索沃', nameEn: 'Kosovo' },
  { code: 'YE', name: '也门', nameEn: 'Yemen' },
  { code: 'YT', name: '马约特', nameEn: 'Mayotte' },
  { code: 'ZA', name: '南非', nameEn: 'South Africa' },
  { code: 'ZM', name: '赞比亚', nameEn: 'Zambia' },
  { code: 'ZW', name: '津巴布韦', nameEn: 'Zimbabwe' },
];

export const REGION_CODES = REGION_OPTIONS.map((option) => option.code);
export type RegionCode = string;

const REGION_CODE_SET = new Set(REGION_CODES);

export function isRegionCode(value: unknown): value is RegionCode {
  return typeof value === 'string' && REGION_CODE_SET.has(value.trim().toUpperCase());
}

export function normalizeRegionCode(value: unknown): string {
  if (typeof value !== 'string') return '';
  const code = value.trim().toUpperCase();
  return REGION_CODE_SET.has(code) ? code : '';
}

export function regionOption(code: string | null | undefined): RegionOption | undefined {
  if (!code) return undefined;
  const normalized = code.trim().toUpperCase();
  return REGION_OPTIONS.find((option) => option.code === normalized);
}

/**
 * Province labels for mainland China. The code is the ISO 3166-2:CN
 * subdivision code, which is also what MaxMind databases report. Provinces are
 * display-only: they never take part in access control.
 */
export interface ProvinceOption {
  code: string;
  name: string;
  nameEn: string;
}

export const CN_PROVINCE_OPTIONS: ProvinceOption[] = [
  { code: 'BJ', name: '北京', nameEn: 'Beijing' },
  { code: 'TJ', name: '天津', nameEn: 'Tianjin' },
  { code: 'HE', name: '河北', nameEn: 'Hebei' },
  { code: 'SX', name: '山西', nameEn: 'Shanxi' },
  { code: 'NM', name: '内蒙古', nameEn: 'Inner Mongolia' },
  { code: 'LN', name: '辽宁', nameEn: 'Liaoning' },
  { code: 'JL', name: '吉林', nameEn: 'Jilin' },
  { code: 'HL', name: '黑龙江', nameEn: 'Heilongjiang' },
  { code: 'SH', name: '上海', nameEn: 'Shanghai' },
  { code: 'JS', name: '江苏', nameEn: 'Jiangsu' },
  { code: 'ZJ', name: '浙江', nameEn: 'Zhejiang' },
  { code: 'AH', name: '安徽', nameEn: 'Anhui' },
  { code: 'FJ', name: '福建', nameEn: 'Fujian' },
  { code: 'JX', name: '江西', nameEn: 'Jiangxi' },
  { code: 'SD', name: '山东', nameEn: 'Shandong' },
  { code: 'HA', name: '河南', nameEn: 'Henan' },
  { code: 'HB', name: '湖北', nameEn: 'Hubei' },
  { code: 'HN', name: '湖南', nameEn: 'Hunan' },
  { code: 'GD', name: '广东', nameEn: 'Guangdong' },
  { code: 'GX', name: '广西', nameEn: 'Guangxi' },
  { code: 'HI', name: '海南', nameEn: 'Hainan' },
  { code: 'CQ', name: '重庆', nameEn: 'Chongqing' },
  { code: 'SC', name: '四川', nameEn: 'Sichuan' },
  { code: 'GZ', name: '贵州', nameEn: 'Guizhou' },
  { code: 'YN', name: '云南', nameEn: 'Yunnan' },
  { code: 'XZ', name: '西藏', nameEn: 'Tibet' },
  { code: 'SN', name: '陕西', nameEn: 'Shaanxi' },
  { code: 'GS', name: '甘肃', nameEn: 'Gansu' },
  { code: 'QH', name: '青海', nameEn: 'Qinghai' },
  { code: 'NX', name: '宁夏', nameEn: 'Ningxia' },
  { code: 'XJ', name: '新疆', nameEn: 'Xinjiang' },
  { code: 'TW', name: '台湾', nameEn: 'Taiwan' },
  { code: 'HK', name: '香港', nameEn: 'Hong Kong' },
  { code: 'MO', name: '澳门', nameEn: 'Macao' },
];

const CN_PROVINCE_MAP = new Map(CN_PROVINCE_OPTIONS.map((province) => [province.code, province]));

export function provinceOption(code: string | null | undefined): ProvinceOption | undefined {
  if (!code) return undefined;
  return CN_PROVINCE_MAP.get(code.trim().toUpperCase());
}

/**
 * Accepts a bare subdivision code (`ZJ`), an ISO 3166-2 value (`CN-ZJ`) or a
 * value with an underscore separator, and returns the known province code.
 */
export function normalizeProvinceCode(value: unknown): string {
  if (typeof value !== 'string') return '';
  const code = value
    .trim()
    .toUpperCase()
    .replace(/^CN[-_ ]/, '');
  return CN_PROVINCE_MAP.has(code) ? code : '';
}

/**
 * The value stored in `ip_region` and `users.last_region`: the country code,
 * or `CN-<province>` when the network location is in China and the province is
 * known.
 */
export function composeIpRegion(
  country: string | null | undefined,
  province?: string | null,
): string {
  const code = normalizeRegionCode(country);
  if (code !== 'CN') return code;
  const subdivision = normalizeProvinceCode(province);
  return subdivision ? `CN-${subdivision}` : code;
}

export function regionLabel(code: string | null | undefined, locale = 'zh-CN'): string {
  const value = typeof code === 'string' ? code.trim().toUpperCase() : '';
  if (value.startsWith('CN-')) {
    const province = provinceOption(value.slice(3));
    if (province) return locale.toLowerCase().startsWith('en') ? province.nameEn : province.name;
    return regionLabel('CN', locale);
  }
  const option = regionOption(value);
  if (!option) return value;
  return locale.toLowerCase().startsWith('en') ? option.nameEn : option.name;
}

export function isRegionBlocked(
  code: string | null | undefined,
  blocked: readonly string[],
): boolean {
  const normalized = normalizeRegionCode(code);
  if (!normalized) return false;
  return blocked.some((item) => normalizeRegionCode(item) === normalized);
}

/** Normalises an arbitrary region list, dropping unknown or duplicate codes. */
export function normalizeRegionList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const result: string[] = [];
  for (const value of values) {
    const code = normalizeRegionCode(value);
    if (code && !result.includes(code)) result.push(code);
  }
  return result.sort();
}
