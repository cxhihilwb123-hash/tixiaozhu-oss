// Primary-school question-bank system for exam subjects only.
// Structure mirrors commercial practice apps: textbook sync, special drills, and papers.
// Unit names are curriculum-aligned generic labels, not copied from any single textbook.

const gradeNames = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级']
const semesterNames = ['上册', '下册']

const subjectBlueprints = [
  {
    code: 'math',
    subject: '数学',
    examRole: '主科考试',
    domains: ['数与运算', '图形与几何', '统计与概率', '综合应用'],
    units: [
      [
        ['20以内数的认识', '位置与顺序', '10以内加减法'],
        ['11-20各数认识', '图形初步认识', '分类整理与简单统计'],
      ],
      [
        ['100以内数的认识', '表内乘法一', '长度单位'],
        ['表内除法', '角的初步认识', '数据收集整理'],
      ],
      [
        ['万以内数的认识', '多位数乘一位数', '长方形和正方形'],
        ['两位数乘两位数', '分数初步认识', '年月日与面积'],
      ],
      [
        ['大数认识', '三位数乘两位数', '平行与垂直'],
        ['运算律', '小数初步认识', '平均数与条形统计图'],
      ],
      [
        ['小数乘除法', '简易方程', '多边形面积'],
        ['因数与倍数', '分数意义和性质', '折线统计图'],
      ],
      [
        ['分数乘除法', '百分数一', '圆的认识'],
        ['比和比例', '百分数二', '小升初综合应用'],
      ],
    ],
    specials: ['计算能力专项', '应用题专项', '图形与几何专项', '易错概念专项'],
  },
  {
    code: 'chinese',
    subject: '语文',
    examRole: '主科考试',
    domains: ['字词句基础', '阅读理解', '古诗文积累', '习作表达'],
    units: [
      [
        ['拼音识读', '常用汉字', '词语和句子'],
        ['朗读与背诵', '看图写话', '童谣儿歌阅读'],
      ],
      [
        ['形近字和多音字', '词语搭配', '自然段阅读'],
        ['古诗诵读', '日记表达', '口语交际'],
      ],
      [
        ['关键语句提取', '段落大意', '人物描写'],
        ['寓言故事阅读', '观察作文', '传统文化积累'],
      ],
      [
        ['文章结构', '中心句概括', '说明性阅读'],
        ['古诗文理解', '习作修改', '综合性学习'],
      ],
      [
        ['信息提取', '主旨概括', '人物形象分析'],
        ['非连续性文本', '读后感写作', '整本书阅读'],
      ],
      [
        ['观点表达', '材料整合', '文言启蒙'],
        ['写人叙事', '说明文阅读', '小升初语文综合'],
      ],
    ],
    specials: ['字词句基础专项', '阅读理解专项', '古诗文积累专项', '习作表达专项'],
  },
  {
    code: 'english',
    subject: '英语',
    examRole: '主科考试',
    domains: ['词汇', '句型语法', '阅读理解', '书面表达'],
    units: [
      [
        ['日常问候', '颜色和数字', '家庭成员'],
        ['课堂指令', '喜欢与不喜欢', '简单自我介绍'],
      ],
      [
        ['动物和身体部位', '食物表达', '地点方位'],
        ['天气表达', '学校用品', '短句阅读'],
      ],
      [
        ['学校生活', '时间表达', '一般现在时'],
        ['物品归属', '购物情境', '短文阅读判断'],
      ],
      [
        ['职业与社区', '频率副词', '过去活动'],
        ['计划表达', '节日文化', '阅读信息匹配'],
      ],
      [
        ['比较级初步', '旅行与交通', '健康建议'],
        ['邮件写作', '故事排序', '任务型阅读'],
      ],
      [
        ['一般过去时综合', '未来计划', '观点表达'],
        ['海报阅读', '跨文化礼仪', '小升初英语综合'],
      ],
    ],
    specials: ['词汇短语专项', '句型语法专项', '阅读理解专项', '书面表达专项'],
  },
]

const difficultyByGrade = ['基础', '基础', '中等', '中等', '较难', '较难']
const typeBySubject = {
  数学: ['选择题', '填空题', '应用题', '填空题'],
  语文: ['选择题', '填空题', '简答题', '应用题'],
  英语: ['选择题', '填空题', '简答题', '应用题'],
}

const sourcePolicy = '自研原创题库；按课标知识结构与常见题型重新命制，不搬运商业教辅原题。'
const curriculumVersion = '义务教育课程方案和课程标准（2022年版）'

const packPlan = [
  { kind: 'textbook', label: '教材同步', roundType: 'daily', questionCount: 24, pointCost: 0, estimatedTime: 30 },
  { kind: 'special', label: '专项训练', roundType: 'special', questionCount: 28, pointCost: 18, estimatedTime: 38 },
  { kind: 'paper', label: '试卷', roundType: 'paper', questionCount: 32, pointCost: 28, estimatedTime: 50 },
]

const paperTypes = ['上册单元卷', '上册期末卷', '下册单元卷', '下册期末卷']

const specialClassifiers = {
  数学: [
    (unit) => /(加减|乘|除|运算|方程|小数|分数|百分数|比和比例|因数与倍数)/.test(unit),
    (unit) => /(应用|统计|平均|综合)/.test(unit),
    (unit) => /(图形|长方形|正方形|面积|平行|垂直|角|圆)/.test(unit),
    () => true,
  ],
  语文: [
    (unit) => /(拼音|汉字|词语|句子|形近字|多音字|关键语句)/.test(unit),
    (unit) => /(阅读|提取|概括|分析|结构|人物|说明性|非连续性|整本书)/.test(unit),
    (unit) => /(古诗|文言|传统文化|诵读)/.test(unit),
    () => true,
  ],
  英语: [
    (unit) => /(颜色|数字|动物|食物|职业|交通|礼仪|用品|短语)/.test(unit),
    (unit) => /(时态|比较级|计划|表达|句型|频率副词|归属)/.test(unit),
    (unit) => /(阅读|海报|任务型|故事|排序|判断)/.test(unit),
    () => true,
  ],
}

const pickType = (subject, index) => {
  const cycle = typeBySubject[subject] || typeBySubject.数学
  return cycle[index % cycle.length]
}

const gradeNumber = (grade) => Math.max(1, gradeNames.indexOf(grade) + 1)
const hashText = (value) => Array.from(String(value || '')).reduce((sum, char) => sum + char.charCodeAt(0), 0)

const optionLetters = ['A', 'B', 'C', 'D']

const buildChoice = (content, options, answerIndex, explanation) => ({
  content,
  options: options.map((option, index) => `${optionLetters[index]}. ${option}`),
  answer: optionLetters[answerIndex],
  explanation,
})

const pickByIndex = (items, index) => items[index % items.length]

const contextualScenarioBySubject = {
  数学: [
    '校内数学实践课正在整理真实数据，老师要求学生先读懂条件再计算。',
    '班级学习小组把生活问题改编成数学题，需要说明每一步的数量意义。',
    '单元复习课上，老师把容易混淆的条件放进同一道题中，检查学生是否会审题。',
    '家长打印练习中保留了完整情境，要求孩子既会算，也能说清为什么这样算。',
  ],
  语文: [
    '阅读课要求先回到材料找依据，再用自己的话完整表达。',
    '老师把课内方法迁移到新的短材料中，重点看学生是否会概括和说明理由。',
    '单元讲评课关注“找得到、说得清、写完整”，不能只凭感觉作答。',
    '家长共读练习保留了真实阅读任务，要求孩子把关键词和理解过程说出来。',
  ],
  英语: [
    'Read the short classroom situation first, then answer according to the context.',
    'This task checks whether the student can use words and sentence patterns in a real situation.',
    'The teacher wants students to find key words before choosing or writing the answer.',
    'This practice keeps the language point inside a short reading or communication task.',
  ],
}

const richRequirementByType = {
  数学: {
    选择题: '要求：先判断题目考查的数量关系，再选择最合适的答案。',
    填空题: '要求：写出关键计算结果，注意单位、格式和逆向检查。',
    应用题: '要求：列出关键数量关系，写出算式，并用一句话回答问题。',
    简答题: '要求：用数学语言说明判断依据，不能只写结论。',
  },
  语文: {
    选择题: '要求：先找材料中的依据，再判断选项是否符合原文意思。',
    填空题: '要求：答案要放回句子中读一遍，保证通顺、准确。',
    简答题: '要求：先写依据，再说明理由，表达要完整。',
    应用题: '要求：围绕一个中心表达，句子之间要有顺序。',
  },
  英语: {
    选择题: 'Requirement: find the key words in the sentence before choosing.',
    填空题: 'Requirement: check the word form, capital letters and punctuation.',
    简答题: 'Requirement: answer according to the given text, not from memory only.',
    应用题: 'Requirement: write complete sentences and keep them close to the topic.',
  },
}

const unitContextBySubject = {
  数学: (unit, index) => {
    const contexts = [
      `本题把“${unit}”放进班级统计、社团采购或实践测量中，重点看条件对应。`,
      `题干故意保留一个容易看漏的条件，适合训练“先找关系、再计算”的习惯。`,
      `这是一道从基础题改编来的变式题，数字不难，难点在读懂问法。`,
      `题目要求把算式和实际含义连起来，避免只凭口算写答案。`,
    ]
    return pickByIndex(contexts, index)
  },
  语文: (unit, index) => {
    const contexts = [
      `本题围绕“${unit}”设置短材料，重点训练从词句中找依据。`,
      `材料不长，但信息有层次，适合练习概括、赏析和完整表达。`,
      `题目把课内阅读方法迁移到新语段，不能脱离材料泛泛而谈。`,
      `作答时要把关键词、句子作用和自己的理解连成一句完整的话。`,
    ]
    return pickByIndex(contexts, index)
  },
  英语: (unit, index) => {
    const contexts = [
      `Context focus: "${unit}" is used in a short school-life situation.`,
      `The item is designed to check meaning first, then grammar and spelling.`,
      `Students should read the whole sentence before deciding the answer.`,
      `The task changes the person, time or place to test flexible language use.`,
    ]
    return pickByIndex(contexts, index)
  },
}

const tierTaskBySubject = {
  数学: {
    基础巩固: {
      prompt: '题组角色：基础巩固题，重点看能否准确找到已知条件和所求问题。',
      answer: '能说出已知条件、所求问题和对应算式，即达到基础巩固要求。',
    },
    方法进阶: {
      prompt: '题组角色：方法进阶题，作答时要补一句“为什么这样列式”。',
      answer: '除写出结果外，还要说明数量关系，例如“总数、部分量、份数或单位量之间的关系”。',
    },
    迁移提升: {
      prompt: '题组角色：迁移提升题，题干中可能有一个不直接参与计算的信息，需要先筛选条件。',
      answer: '先剔除无关或暂不使用的信息，再使用与问题直接对应的条件求解。',
    },
    压轴突破: {
      prompt: '题组角色：压轴突破题，完成后再判断：如果条件改变，原方法是否还适用？',
      answer: '判断方法是否适用时，要看数量关系是否改变；只换数字通常方法不变，换关系则要重新建模。',
    },
  },
  语文: {
    基础巩固: {
      prompt: '题组角色：基础巩固题，先从材料中找到直接依据。',
      answer: '能准确找到原文词句，并围绕题目要求作答，即达到基础巩固要求。',
    },
    方法进阶: {
      prompt: '题组角色：方法进阶题，答案要包含“依据 + 理解”。',
      answer: '答案不能只抄词句，要说明这个词句表现了什么或为什么重要。',
    },
    迁移提升: {
      prompt: '题组角色：迁移提升题，换一段材料也要能使用同样的阅读方法。',
      answer: '迁移时先判断题目问的是内容、人物、情感还是表达效果，再回文定位。',
    },
    压轴突破: {
      prompt: '题组角色：压轴突破题，尝试把理解写得更具体、更有层次。',
      answer: '高质量答案通常包含对象、特点、依据和表达效果四个要素。',
    },
  },
  英语: {
    基础巩固: {
      prompt: 'Item role: foundation check. Find the key word or sentence clue first.',
      answer: 'A foundation-level answer should match the key word in the sentence or short text.',
    },
    方法进阶: {
      prompt: 'Item role: method practice. Explain the grammar or meaning clue after answering.',
      answer: 'A good answer includes the choice and the clue, such as time word, subject or place clue.',
    },
    迁移提升: {
      prompt: 'Item role: transfer task. The person, time or place may change, so read the whole context.',
      answer: 'For transfer tasks, keep the same language rule but adjust the answer to the new context.',
    },
    压轴突破: {
      prompt: 'Item role: challenge task. Check meaning, grammar and writing form together.',
      answer: 'A challenge-level answer should be correct in meaning, grammar, spelling and punctuation.',
    },
  },
}

const variantFamilyByStage = {
  入门识别: 'A组·概念识别',
  基础掌握: 'B组·基础稳定',
  方法迁移: 'C组·方法迁移',
  综合突破: 'D组·综合应用',
  诊断回收: 'E组·易错回收',
  压轴突破: 'F组·压轴挑战',
}

const abilityBySubject = {
  数学: ['概念理解', '运算能力', '模型分析', '推理表达', '综合应用'],
  语文: ['字词积累', '信息提取', '文本理解', '表达组织', '迁移运用'],
  英语: ['词汇识别', '句型运用', '阅读定位', '语境理解', '书面表达'],
}

const literacyBySubject = {
  数学: ['数感', '符号意识', '空间观念', '数据意识', '应用意识', '推理意识'],
  语文: ['语言积累', '信息整合', '审美鉴赏', '文化理解', '表达交流', '思维提升'],
  英语: ['语言知识', '语篇理解', '交际意识', '文化意识', '思维品质', '学习能力'],
}

const sceneBySeries = {
  textbook: ['课堂同步', '课后巩固', '家庭练习', '单元回收'],
  special: ['专项突破', '薄弱补强', '方法训练', '错题回收'],
  paper: ['单元诊断', '阶段检测', '考前模拟', '家长打印'],
}

const cognitiveBySeries = {
  textbook: ['识记', '理解', '应用', '应用'],
  special: ['理解', '应用', '迁移', '综合'],
  paper: ['识记', '理解', '应用', '综合'],
}

const masteryStageByTrainingLevel = {
  课前预习: '入门识别',
  课中巩固: '基础掌握',
  方法迁移: '方法迁移',
  课后提升: '综合突破',
  易错回收: '诊断回收',
  概念辨析: '入门识别',
  基础训练: '基础掌握',
  方法训练: '方法迁移',
  变式提升: '综合突破',
  选择基础: '入门识别',
  填空巩固: '基础掌握',
  '应用/阅读': '方法迁移',
  综合提升: '综合突破',
  压轴表达: '压轴突破',
}

const variantTypeBySubject = {
  数学: {
    选择题: '概念辨析',
    填空题: '直接求解',
    应用题: '数量建模',
    简答题: '思路表达',
  },
  语文: {
    选择题: '信息判断',
    填空题: '字词句运用',
    简答题: '文本分析',
    应用题: '表达迁移',
  },
  英语: {
    选择题: '词汇语法判断',
    填空题: '句型填空',
    简答题: '阅读定位',
    应用题: '书面表达',
  },
}

const mistakeBySubject = {
  数学: ['漏看单位', '运算顺序混乱', '数量关系未列清楚', '把概念条件看反'],
  语文: ['脱离原文作答', '只抄词不解释', '表达缺少中心', '审题漏掉要求'],
  英语: ['主谓形式不一致', '忽略时间标志词', '大小写和标点缺失', '答非所问'],
}

const methodByType = {
  选择题: '先圈关键词，再逐项排除干扰项。',
  填空题: '先写核心步骤，再回填答案并检查单位。',
  简答题: '先回到材料定位依据，再用完整句说明理由。',
  应用题: '先提取条件和问题，再列式或分点作答。',
}

const expertProfilesBySubject = {
  数学: {
    teacherLens: '优秀数学老师会先看学生是否读懂数量关系，再看计算是否稳定。',
    stemIntent: '用真实可理解的情境承载核心模型，避免只考机械套公式。',
    reviewVerb: '复盘条件、关系、列式和检查',
    misconceptionLens: '多数失分不是不会算，而是条件对应、单位意识或步骤顺序不稳。',
    extensionLens: '换数、换问法或换图形关系，让学生确认方法能迁移。',
    gradingDimensions: ['条件提取准确', '数量关系清楚', '计算过程规范', '结果带单位并回到问题'],
  },
  语文: {
    teacherLens: '优秀语文老师会先看学生有没有回到文本，再看表达是否完整有依据。',
    stemIntent: '用短材料训练定位、概括、赏析和表达，题目要能带出阅读方法。',
    reviewVerb: '回文定位、提取依据、组织表达和修正语言',
    misconceptionLens: '主要失分来自脱离原文、只抄不解释、概括过宽或表达缺中心。',
    extensionLens: '换材料、换问法或换表达对象，让学生把阅读方法迁移到新文本。',
    gradingDimensions: ['依据定位准确', '理解方向正确', '表达完整通顺', '能说明关键词或句子的作用'],
  },
  英语: {
    teacherLens: '优秀英语老师会先看学生是否理解语境，再看词汇、句型和书写细节。',
    stemIntent: '把词汇、句型和语篇信息放进语境里考，避免孤立背答案。',
    reviewVerb: '圈关键词、判断语境、核对句型和检查书写',
    misconceptionLens: '常见失分来自时态信号忽略、主谓形式不一致、拼写和标点不规范。',
    extensionLens: '换人物、换时间词或换任务场景，让学生确认语言点能在语篇中使用。',
    gradingDimensions: ['关键词定位准确', '句型或语法判断正确', '表达符合语境', '大小写和标点规范'],
  },
}

const trainingLevelIntent = {
  课前预习: '降低进入门槛，确认学生知道本知识点要解决什么问题。',
  课中巩固: '把课堂例题方法转成独立作答，重点看基础稳定性。',
  方法迁移: '在条件或材料变化后继续使用同一方法，观察迁移能力。',
  课后提升: '拉高综合度，让学生把多个条件或表达要求整合起来。',
  易错回收: '专门击中高频错因，训练学生发现并修正自己的错误路径。',
  概念辨析: '先拆概念边界，防止学生把相近概念混成一个答案。',
  基础训练: '用连续同类题建立熟练度，稳住最低得分面。',
  方法训练: '把解题步骤显性化，训练学生能说出为什么这样做。',
  变式提升: '改变条件、材料或问法，检查方法是否真正会迁移。',
  选择基础: '用选项暴露概念误判，适合快速诊断基础漏洞。',
  填空巩固: '要求学生独立产出结果，检查核心步骤和格式。',
  '应用/阅读': '进入真实题型场景，观察信息提取和方法组织。',
  综合提升: '融合多个要求，观察综合调度和表达稳定性。',
  压轴表达: '保留一定开放度，观察高阶思维、表达和检查能力。',
}

const buildExpertQuestionDesign = ({ pack, unit, type, index, body, progression, trainingLevel }) => {
  const profile = expertProfilesBySubject[pack.subject] || expertProfilesBySubject.数学
  const trainingIntent = trainingLevelIntent[trainingLevel] || '围绕当前学习阶段完成一次稳定训练。'
  const baseSteps = {
    选择题: ['圈出题干关键词', '先判断核心概念或数量关系', '逐项排除典型干扰项', '把答案带回题干复核'],
    填空题: ['明确要求填写的结果', '写出关键计算或语言依据', '回填答案并检查格式', '用逆向或语境再次核对'],
    简答题: ['回到材料定位依据', '提炼与问题直接相关的信息', '用完整句说明理由', '检查是否答全题目要求'],
    应用题: ['提取已知条件和问题', '建立数量关系或表达框架', '分步求解并写清过程', '把结论带回情境检查'],
  }
  const solutionSteps = body.solutionSteps || baseSteps[type] || baseSteps.应用题
  const gradingPoints = body.gradingPoints || profile.gradingDimensions

  return {
    expertTeacherLens: profile.teacherLens,
    teachingIntent: `${trainingLevel}：${trainingIntent}`,
    stemDesign: `${profile.stemIntent} 本题聚焦“${unit}”，属于${progression.difficultyTier}层级。`,
    solutionSteps,
    keyCheckpoint: `讲评时要让学生完成“${profile.reviewVerb}”，不要只停留在最终答案。`,
    misconceptionDiagnosis: body.misconceptionDiagnosis || `${unit}常见问题：${profile.misconceptionLens}`,
    variantIntent: `${progression.variantType}变式用于验证学生是否从“会做这一题”进入“会用这一类方法”。`,
    classroomReviewScript: `先请学生说出本题考什么，再追问第一步为什么这样做，最后让学生补一句检查方法。`,
    parentReviewScript: `家长陪练时先听孩子复述思路，再对照步骤看漏了哪一步，不建议直接报答案。`,
    gradingPoints,
    extensionPrompt: `追问变式：如果把题目中的关键条件换一种表达，${unit}的方法还可以怎样用？`,
    variantFamily: body.variantFamily,
    tierTaskPrompt: body.tierTaskPrompt,
    tierTaskAnswer: body.tierTaskAnswer,
    expertReviewTags: [
      pack.seriesName,
      trainingLevel,
      progression.difficultyTier,
      progression.masteryStage,
      type,
      unit,
    ].filter(Boolean),
    contentQualityLevel: index % 5 === 0 ? '名师精讲题' : index % 3 === 0 ? '校内检测风格' : '高标准原创题',
  }
}

const buildQualityMetadata = ({ pack, unit, index, type }) => {
  const abilities = abilityBySubject[pack.subject] || abilityBySubject.数学
  const literacies = literacyBySubject[pack.subject] || literacyBySubject.数学
  const mistakes = mistakeBySubject[pack.subject] || mistakeBySubject.数学
  const scenes = sceneBySeries[pack.series] || sceneBySeries.textbook
  const cognitiveLevels = cognitiveBySeries[pack.series] || cognitiveBySeries.textbook
  const qualityScore = Math.min(96, 86 + (index % 6) + (pack.series === 'paper' ? 2 : 0))
  return {
    sortOrder: index + 1,
    source: 'in_house_curated',
    sourceLabel: '自研精品题库',
    sourcePolicy,
    reviewStatus: 'published',
    qualityTier: qualityScore >= 92 ? '精品' : '标准',
    qualityScore,
    ability: abilities[index % abilities.length],
    literacyDimension: literacies[index % literacies.length],
    cognitiveLevel: cognitiveLevels[index % cognitiveLevels.length],
    scenarioType: scenes[index % scenes.length],
    answerMethod: methodByType[type] || '先明确题目要求，再分步骤作答。',
    commonMistake: mistakes[index % mistakes.length],
    estimatedSeconds: pack.series === 'paper' ? 160 + (index % 4) * 20 : pack.series === 'special' ? 140 + (index % 4) * 20 : 110 + (index % 3) * 20,
    stemHighlights: [
      `${pack.grade}${pack.subject}`,
      unit,
      type,
    ].filter(Boolean),
    qualityTags: [
      pack.seriesName,
      pack.grade,
      pack.subject,
      unit,
      type,
    ].filter(Boolean),
  }
}

const buildPackEditorialMetadata = ({ blueprint, grade, unitName, series, plan, coverage, unitIndex }) => {
  const gradeIndex = gradeNames.indexOf(grade)
  const domains = blueprint.domains
  const domainFocus = series === 'paper'
    ? domains
    : [domains[(Math.max(0, unitIndex) || gradeIndex) % domains.length], domains[(Math.max(0, unitIndex) + 1) % domains.length]]
  const targetAbility = (abilityBySubject[blueprint.subject] || []).slice(series === 'textbook' ? 0 : 1, series === 'paper' ? 5 : 4)
  const learningObjectives = series === 'textbook'
    ? [
      `围绕“${unitName}”完成同步巩固，先跟住课堂再做方法迁移。`,
      `通过分层题序把知识点从会做推进到能稳定做对。`,
      `为单元测评和错题回收提供可复用的原子题基础。`,
    ]
    : series === 'special'
      ? [
        `围绕“${unitName}”集中突破同类题型与常见易错点。`,
        `把解题方法做成可重复训练的专项链路，提升举一反三能力。`,
        `让学生在短时间内完成一次薄弱点补强。`,
      ]
      : [
        `围绕“${coverage}”进行阶段性诊断，检验知识覆盖和稳定性。`,
        `通过整卷结构观察学生在基础题、综合题、表达题上的失分位置。`,
        `为家长讲评和后续补弱提供明确的题型证据。`,
      ]
  const editorialHighlights = series === 'paper'
    ? ['覆盖多个知识点', '题型分层编排', '适合打印讲评', '带压轴与诊断题']
    : series === 'special'
      ? ['围绕一个能力主题', '方法题与变式题成组', '可直接接错题回收', '适合短周期提升']
      : ['紧贴教材单元', '含预习到回收全链路', '适合日常打卡', '知识点颗粒度清晰']

  return {
    productPositioning: series === 'textbook' ? '同步巩固产品' : series === 'special' ? '能力提升产品' : '阶段诊断产品',
    suitableScene: series === 'textbook' ? '课后同步练 / 周内日常练' : series === 'special' ? '专项补弱 / 寒暑假集中练' : '单元测 / 期中期末前冲刺',
    diagnosticFocus: series === 'paper' ? '看整卷稳定性、压轴题得分、错题分布' : series === 'special' ? '看同类题连续正确率和方法迁移' : '看知识点是否跟住课堂节奏',
    prerequisite: series === 'textbook' ? `建议已完成${unitName}课堂学习` : series === 'special' ? `建议先完成同主题教材同步题，再进入${unitName}` : '建议先做教材同步与专项训练，再进行整卷诊断',
    curriculumTags: domainFocus,
    targetAbility,
    learningObjectives,
    editorialHighlights,
    publicationLabel: '教研编排版',
    packVersionLabel: '2026.05',
  }
}

const buildQuestionProgression = ({ pack, index, trainingLevel, type }) => {
  const ratio = index / Math.max(1, pack.questionCount - 1)
  let difficulty = '中等'

  if (pack.series === 'paper') {
    if (ratio < 0.25) difficulty = '基础'
    else if (ratio < 0.6) difficulty = '中等'
    else if (ratio < 0.88) difficulty = '较难'
    else difficulty = '困难'
  } else if (pack.series === 'special') {
    if (ratio < 0.18) difficulty = '基础'
    else if (ratio < 0.55) difficulty = '中等'
    else if (ratio < 0.86) difficulty = '较难'
    else difficulty = '困难'
  } else {
    if (ratio < 0.2) difficulty = '基础'
    else if (ratio < 0.68) difficulty = '中等'
    else if (ratio < 0.92) difficulty = '较难'
    else difficulty = '困难'
  }

  const difficultyTier = difficulty === '基础'
    ? '基础巩固'
    : difficulty === '中等'
      ? '方法进阶'
      : difficulty === '较难'
        ? '迁移提升'
        : '压轴突破'

  const masteryStage = masteryStageByTrainingLevel[trainingLevel] || (pack.series === 'paper' ? '综合突破' : '基础掌握')
  const variantTypeMap = variantTypeBySubject[pack.subject] || variantTypeBySubject.数学
  const variantType = variantTypeMap[type] || '综合变式'

  return {
    difficulty,
    difficultyTier,
    masteryStage,
    variantType,
  }
}

const knowledgeCoachingBySubject = {
  数学: {
    teachingFocus: '先让学生说清条件、数量关系和运算理由，再进入求解。',
    parentCoach: '家长先听孩子复述思路，不急着报答案，重点看列式是否清楚。',
    recoveryAction: '先回教材同步找同类例题，再做专项中的方法训练和错题回收。',
    commonMistakes: ['条件对应关系看反', '运算顺序混乱', '单位或结果漏写'],
  },
  语文: {
    teachingFocus: '先回原文定位，再说依据，最后组织完整表达。',
    parentCoach: '家长先让孩子指出原文证据句，再追问为什么这样理解。',
    recoveryAction: '先做同步精读，再做专项里的主旨/表达类变式，最后用试卷验证。',
    commonMistakes: ['脱离原文作答', '只抄原句不概括', '表达不完整或中心不明'],
  },
  英语: {
    teachingFocus: '先抓题干关键词，再确认语境、句型和时态。',
    parentCoach: '家长先带孩子圈时间词、主语和核心动词，再看拼写细节。',
    recoveryAction: '先在同步题里稳基础句型，再进入专项做语境变式，最后用试卷检测。',
    commonMistakes: ['忽略时态提示词', '主谓不一致', '拼写和标点细节丢分'],
  },
}

const buildKnowledgePlaybook = ({ subject, unit, chapter, wrongRate }) => {
  const config = knowledgeCoachingBySubject[subject] || knowledgeCoachingBySubject.数学
  const intensity = wrongRate >= 28 ? '高频补弱' : wrongRate >= 22 ? '持续巩固' : '常规维护'
  return {
    teachingFocus: `${chapter}维度下，围绕“${unit}”重点做：${config.teachingFocus}`,
    parentCoach: `${config.parentCoach} 当前建议强度：${intensity}。`,
    recoveryAction: config.recoveryAction,
    explanationScript: `讲评“${unit}”时，先指出最容易错的地方，再示范一题，最后让学生口头复盘方法。`,
    commonMistakes: config.commonMistakes.map((item) => `${unit}：${item}`),
    remediationChecklist: [
      `先完成${unit}对应教材同步题`,
      `再补${unit}对应专项训练题`,
      `最后通过试卷题检验迁移稳定性`,
    ],
  }
}

const buildSpecialUnitMap = (blueprint, gradeIndex) => {
  const units = blueprint.units[gradeIndex].flat()
  const classifiers = specialClassifiers[blueprint.subject] || []
  const assignment = blueprint.specials.map((special) => ({
    special,
    units: [],
  }))

  units.forEach((unit, unitIndex) => {
    const matchedIndex = classifiers.findIndex((matcher) => typeof matcher === 'function' && matcher(unit, unitIndex))
    const safeIndex = matchedIndex >= 0 ? Math.min(matchedIndex, assignment.length - 1) : unitIndex % assignment.length
    assignment[safeIndex].units.push(unit)
  })

  const fallbackPool = units.slice()
  assignment.forEach((entry, specialIndex) => {
    if (entry.units.length > 0) return
    const fallbackUnit = fallbackPool[specialIndex % fallbackPool.length]
    if (fallbackUnit) entry.units.push(fallbackUnit)
  })

  return assignment.reduce((result, entry, specialIndex) => {
    result[entry.special] = {
      units: entry.units,
      themeFocus: entry.units.join('、'),
      depthLabel: entry.units.length >= 3 ? '宽口径专题' : entry.units.length === 2 ? '双知识点专题' : '单知识点突破',
      specialIndex,
    }
    return result
  }, {})
}

const mathQuestion = ({ grade, unit, type, index }) => {
  const gradeNo = gradeNumber(grade)
  const base = gradeNo * 8 + index * 3 + 6
  const second = gradeNo + index + 4
  const unitLabel = unit.replace(/专项$/, '')

  if (type === '选择题') {
    if (unit.includes('方程')) {
      const x = gradeNo + index + 3
      const add = second
      return buildChoice(
        `如果 x + ${add} = ${x + add}，那么 x 等于多少？`,
        [x - 1, x, x + 1, add],
        1,
        `把等式两边都减去 ${add}，得到 x = ${x}。`
      )
    }
    if (unit.includes('比和比例')) {
      const unitValue = gradeNo + index + 2
      return buildChoice(
        `篮球社团统计队员构成，男生和女生人数比是 3:2。已知男生有 ${unitValue * 3} 人，如果保持这个比例，女生应有多少人？`,
        [unitValue, unitValue * 2, unitValue * 3, unitValue * 5],
        1,
        `3 份对应 ${unitValue * 3} 人，1 份是 ${unitValue} 人，女生 2 份是 ${unitValue * 2} 人。`
      )
    }
    if (unit.includes('面积') || unit.includes('图形') || unit.includes('圆')) {
      const length = gradeNo + 5
      const width = index + 3
      const answer = length * width
      return buildChoice(
        `美术展区要铺一块长方形展示垫，长 ${length} 米、宽 ${width} 米。只计算铺垫面积，不计算边框。面积是多少平方米？`,
        [answer - width, answer, (length + width) * 2, answer + length],
        1,
        `长方形面积 = 长 × 宽，${length} × ${width} = ${answer}。`
      )
    }
    if (unit.includes('分数')) {
      return buildChoice(
        `劳动课后同学们分享一个蛋糕，蛋糕被平均分成 ${gradeNo + 3} 份，小雨吃了其中 2 份。下面哪个分数能准确表示她吃掉的部分？`,
        [`2/${gradeNo + 3}`, `${gradeNo + 3}/2`, `1/${gradeNo + 3}`, `2/${gradeNo + 2}`],
        0,
        `平均分成 ${gradeNo + 3} 份，吃了 2 份，应该写作 2/${gradeNo + 3}。`
      )
    }
    if (unit.includes('统计') || unit.includes('平均')) {
      const values = [base, base + 2, base + 4]
      const average = base + 2
      return buildChoice(
        `阅读打卡表显示，三天阅读页数分别是 ${values.join(' 页、')} 页。为了比较阅读节奏，老师要求求出平均每天读多少页。`,
        [average - 2, average, average + 2, average + 4],
        1,
        `平均数 = 总数 ÷ 个数，(${values.join(' + ')}) ÷ 3 = ${average}。`
      )
    }
    const answer = base + second
    return buildChoice(
      `图书角原有 ${base} 本书，阅读节又收到 ${second} 本捐赠图书。管理员先估算总数，再记录准确数量。下面哪个结果正确？`,
      [answer - 2, answer - 1, answer, answer + 3],
      2,
      `求现在一共有多少本，要把原有数量和新增数量合起来，${base} + ${second} = ${answer}。`
    )
  }

  if (type === '应用题') {
    if (unit.includes('百分数')) {
      const total = 200 + index * 20
      const rate = 20 + gradeNo
      const answer = Math.round(total * rate / 100)
      return {
        content: `学校准备 ${total} 本阅读手册，计划把其中 ${rate}% 分给六年级，其余留给其他年级。只计算六年级这一部分，可以分到多少本？`,
        answer: `${answer} 本`,
        explanation: `${total} × ${rate}% = ${answer}，百分数应用题要先把百分数转化为乘法关系。`,
      }
    }
    if (unit.includes('比和比例')) {
      const unitValue = gradeNo + 2
      return {
        content: `科学小组按 3:2 配制两种材料，老师提醒“比例不能只看差，要先找每一份是多少”。第一种材料用了 ${unitValue * 3} 克，第二种材料应使用多少克？`,
        answer: `${unitValue * 2} 克`,
        explanation: `3 份对应 ${unitValue * 3} 克，1 份是 ${unitValue} 克，2 份是 ${unitValue * 2} 克。`,
      }
    }
    const count = gradeNo + 3
    const each = index + 6
    return {
      content: `书法社团准备一次作品展，买来 ${count} 包练习纸，每包 ${each} 张。第一次布置展板用了 ${second} 张，还要预留备用纸。现在还剩多少张？`,
      answer: `${count * each - second} 张`,
      explanation: `先求总数：${count} × ${each} = ${count * each}，再减去用掉的 ${second} 张，剩 ${count * each - second} 张。`,
    }
  }

  if (unit.includes('小数')) {
    const a = (gradeNo + index / 10 + 1.2).toFixed(1)
    const b = (second / 10 + 0.5).toFixed(1)
    const answer = (Number(a) + Number(b)).toFixed(1)
    return {
      content: `科学记录表中，第一次测量长度是 ${a} 米，第二次比第一次多记录了 ${b} 米。请把两次记录合并，结果填在横线上：______ 米。`,
      answer,
      explanation: `合并两次记录要用加法，小数点对齐后相加，${a} + ${b} = ${answer}。`,
    }
  }
  if (unit.includes('方程')) {
    const answer = gradeNo + index + 5
    const add = second
    return {
      content: `图书管理员把一部分新书记作 x 本，又补登了 ${add} 本，登记表显示一共 ${answer + add} 本。根据等量关系 x + ${add} = ${answer + add}，x = ______。`,
      answer: String(answer),
      explanation: `等式两边同时减去 ${add}，x = ${answer + add} - ${add} = ${answer}。`,
    }
  }
  if (unit.includes('百分数')) {
    const total = 100 + index * 10
    const rate = 10 + gradeNo
    const answer = Math.round(total * rate / 100)
    return {
      content: `班级计划完成 ${total} 个阅读任务，第一周完成了 ${rate}%。第一周完成的任务数是 ______ 个。`,
      answer: String(answer),
      explanation: `求一个数的百分之几，用这个数乘百分率：${total} × ${rate}% = ${answer}。`,
    }
  }
  if (unit.includes('乘') || unit.includes('除') || unit.includes('运算') || unit.includes('计算')) {
    const answer = base * second
    return {
      content: `劳动实践基地每排摆放 ${base} 盆花，共摆了 ${second} 排。请根据“每排数量 × 排数”的关系填写总盆数：______`,
      answer: String(answer),
      explanation: `总盆数 = 每排 ${base} 盆 × ${second} 排。可以把 ${second} 拆成 ${second - 1} + 1，先算 ${base} × ${second - 1}，再加 ${base}，结果是 ${answer}。`,
    }
  }
  return {
    content: `科技节材料包中有 ${base + 10} 张标签，布置展台时用去 ${second} 张。围绕“${unitLabel}”完成数量变化填空：还剩 ______ 张。`,
    answer: String(base + 10 - second),
    explanation: `剩余数量 = 原有数量 - 用去数量，${base + 10} - ${second} = ${base + 10 - second}。`,
  }
}

const chineseQuestion = ({ grade, unit, type, index }) => {
  const passageItem = pickByIndex([
    {
      text: '清晨，校园里的桂花开了，淡淡的香气飘进教室。同学们放轻脚步，生怕惊动这份安静。',
      keyword: '淡淡的',
      reason: '写出了桂花香气轻柔、不浓烈的特点。',
    },
    {
      text: '小溪绕过村口的石桥，水面映着云影。孩子们蹲在岸边，看小鱼从水草间钻来钻去。',
      keyword: '钻来钻去',
      reason: '写出了小鱼活动灵活，也让画面更生动。',
    },
    {
      text: '奶奶把旧布剪成方块，一针一线缝成书包挂件。她说，慢慢做出来的东西更耐看。',
      keyword: '一针一线',
      reason: '表现了奶奶做挂件时认真细致。',
    },
    {
      text: '雨后的操场亮晶晶的，跑道边的小草直起了腰。太阳一出来，水珠像一颗颗小灯。',
      keyword: '亮晶晶的',
      reason: '写出了雨后操场清亮、有光泽的样子。',
    },
  ], index)
  const passage = passageItem.text

  if (type === '选择题') {
    if (unit.includes('古诗') || unit.includes('文言')) {
      return buildChoice(
        `学习“${unit}”时，遇到一句不太熟悉的诗句或文言句：“童子方归，笑语盈门。”理解这类句子的第一步通常是什么？`,
        ['直接背答案', '先结合注释理解关键词', '只看最后一句', '跳过不会的字词'],
        1,
        `古诗文理解要先借助注释和上下文理解关键词，再整体把握意思。`
      )
    }
    if (unit.includes('非连续性文本') || unit.includes('信息提取')) {
      return buildChoice(
        `阅读通知：“周五下午三点，四年级在报告厅参加科学讲座，请带记录本。”如果题目问活动地点，最重要的是先找到什么？`,
        ['材料颜色', '题目要求对应的信息位置', '作者年龄', '装饰图案'],
        1,
        `非连续性文本要先看题目问什么，再到标题、表格、项目栏里定位信息。`
      )
    }
    return buildChoice(
      `阅读句子：“${passage}”如果要给这段话选择一个概括方向，下面哪一项最合适？`,
      ['人物争吵的过程', '景物或场景的特点', '购物时的对话', '实验步骤'],
      1,
      `这段文字抓住气味、景物和动作来写场景，符合“${unit}”的阅读要求。`
    )
  }

  if (type === '应用题') {
    const topic = pickByIndex(['一次课间活动', '我喜欢的一本书', '雨后的校园', '家里的一件小事'], index)
    return {
      content: `习作表达：请围绕“${topic}”写 3 句话。第一句交代场景，第二句写一个具体动作，第三句写感受或发现。`,
      answer: '示例：下课铃一响，我和同学冲向操场。我们一边跳绳一边数数，笑声传得很远。我觉得这十分钟特别轻松。',
      explanation: `表达题要围绕一个中心，把动作、场景和感受写清楚。`,
    }
  }

  if (type === '简答题') {
    if (unit.includes('主旨') || unit.includes('中心')) {
      return {
        content: `阅读短文：“${passage}”请用一句话概括这段文字的主要画面或意思。`,
        answer: '示例：这段文字描写了一个安静、生动或温暖的生活场景。',
        explanation: `概括主旨时要抓住主要对象、主要特点和作者表达的感受。`,
      }
    }
    return {
      content: `阅读短文：“${passage}”请找出一个表现画面特点的词语，并说明理由。`,
      answer: `示例：可以找“${passageItem.keyword}”，因为${passageItem.reason}`,
      explanation: `简答题要先回到原文找词句，再说明这个词句表达了什么。`,
    }
  }

  const word = pickByIndex(['安静', '明亮', '认真', '温暖'], index)
  return {
    content: `${unit}词句基础：请联系一个校园、家庭或阅读场景，用“${word}”写一个完整句子，并让句子能表现画面。`,
    answer: `示例：清晨的图书馆很${word}，同学们翻书的声音都轻轻的。`,
    explanation: `造句不只要语法完整，还要有具体场景；人物、事物或画面越清楚，表达越有质量。`,
  }
}

const englishQuestion = ({ grade, unit, type, index }) => {
  const gradeNo = gradeNumber(grade)
  const people = [
    { name: 'Amy', pronoun: 'she' },
    { name: 'Tom', pronoun: 'he' },
    { name: 'Lily', pronoun: 'she' },
    { name: 'Ben', pronoun: 'he' },
  ]
  const person = pickByIndex(people, index)
  const name = person.name

  if (type === '选择题') {
    if (unit.includes('过去')) {
      return buildChoice(
        `Read the diary note: “${name} went to the park yesterday and took photos.” Which word shows the past action?`,
        ['goes', 'went', 'park', 'to'],
        1,
        `yesterday 表示过去，句中动词用 went。`
      )
    }
    if (unit.includes('未来') || unit.includes('计划')) {
      return buildChoice(
        `Read the plan: “${name} will visit the library tomorrow.” Which word helps show the future plan?`,
        ['will', 'visited', 'yesterday', 'likes'],
        0,
        `will 常用于表达将要发生的事情，tomorrow 也提示未来时间。`
      )
    }
    if (unit.includes('比较级')) {
      return buildChoice(
        `In a shopping dialogue, Amy says, “The red bag is bigger than the blue bag.” Which word is the comparative form?`,
        ['red', 'bigger', 'than', 'bag'],
        1,
        `bigger 是 big 的比较级，常和 than 搭配。`
      )
    }
    return buildChoice(
      `Classroom inventory: ${name} has ${gradeNo + index + 2} pencils in the pencil case. Which sentence uses the verb correctly?`,
      [`${name} have pencils.`, `${name} has pencils.`, `${name} are pencils.`, `${name} be pencils.`],
      1,
      `主语是第三人称单数时，用 has。`
    )
  }

  if (type === '应用题') {
    return {
      content: `Writing task: Your class is making an English poster about "${unit}". Write 2 complete sentences. Use one sentence with “I can...” or “I like...”, and make the two sentences about the same topic.`,
      answer: '示例：I like English songs. I can read a short story after class.',
      explanation: `英语表达要围绕同一主题，句子完整，首字母大写，句末有标点；两句话之间也要有语义关联。`,
    }
  }

  if (type === '简答题') {
    if (unit.includes('海报') || unit.includes('任务型阅读')) {
      return {
        content: `Read the school poster: “School Art Show: Friday, 3:00 p.m., Music Room. Bring your drawing book.” Where is the art show?`,
        answer: 'In the Music Room.',
        explanation: `题目问地点 Where，要在海报信息中定位 Music Room。`,
      }
    }
    return {
      content: `Read the lunch note: “${name} likes apples, but ${person.pronoun} doesn't like pears. ${name} puts one apple in the lunch box.” What fruit does ${name} like? Answer in English.`,
      answer: 'apples',
      explanation: `句子前半部分 says “likes apples”，后半部分说明不喜欢 pears。`,
    }
  }

  const place = pickByIndex([
    { word: 'school', clue: 'has a club meeting' },
    { word: 'park', clue: 'wants to play football' },
    { word: 'library', clue: 'wants to read books quietly' },
    { word: 'zoo', clue: 'wants to see animals' },
  ], index)
  return {
    content: `Read the after-school plan: “${name} ${place.clue} after class.” Fill in the blank about "${unit}": ${name} goes to the ______ after class.`,
    answer: place.word,
    explanation: `空格处需要填地点名词，并且要和前面的线索“${place.clue}”对应；${place.word} 可以和 go to the 搭配。`,
  }
}

const buildQuestionBody = ({ subject, grade, unit, type, index }) => {
  if (subject === '语文') return chineseQuestion({ grade, unit, type, index })
  if (subject === '英语') return englishQuestion({ grade, unit, type, index })
  return mathQuestion({ grade, unit, type, index })
}

const enrichQuestionBodyContent = ({ subject, grade, unit, type, index, body, progression, trainingLevel }) => {
  const scenario = pickByIndex(contextualScenarioBySubject[subject] || contextualScenarioBySubject.数学, index)
  const unitContextBuilder = unitContextBySubject[subject] || unitContextBySubject.数学
  const unitContext = unitContextBuilder(unit, index)
  const requirement = richRequirementByType[subject]?.[type] || '要求：读清题干，写出答案并检查理由。'
  const tierTask = tierTaskBySubject[subject]?.[progression.difficultyTier] || tierTaskBySubject.数学.基础巩固
  const variantFamily = variantFamilyByStage[progression.masteryStage] || '综合训练组'
  const originalContent = String(body.content || '').trim()
  const originalExplanation = String(body.explanation || '').trim()
  const content = [
    subject === '英语' ? `Grade: ${grade} | Topic: ${unit}` : `${grade}${subject}｜${unit}`,
    scenario,
    unitContext,
    `${variantFamily}｜${tierTask.prompt}`,
    `任务：${originalContent}`,
    requirement,
  ].join('\n')

  const explanation = [
    originalExplanation,
    subject === '数学'
      ? `命题人说明：这道题的价值在于把“${unit}”放进真实问题中，学生需要先确认条件和问题的对应关系。`
      : subject === '语文'
        ? `命题人说明：这道题要求学生回到材料找依据，再把理解组织成完整表达。`
        : `Teacher note: the item checks whether students understand the context before using the language point.`,
    type === '选择题'
      ? '干扰项设计：错误选项通常对应审题遗漏、概念混淆或只看局部信息。'
      : '迁移提醒：订正后可以更换材料、数字、人物或问法，再做一次同方法变式。',
    `题组讲评：${tierTask.answer}`,
  ].filter(Boolean).join('\n')

  return {
    ...body,
    content,
    explanation,
    originalStem: originalContent,
    variantFamily,
    tierTaskPrompt: tierTask.prompt,
    tierTaskAnswer: tierTask.answer,
  }
}

const buildQuestion = ({ pack, unit, index, trainingLevel }) => {
  const type = pickType(pack.subject, index)
  const effectiveIndex = index + (hashText(pack.id) % 97)
  const progression = buildQuestionProgression({ pack, index, trainingLevel, type })
  const body = enrichQuestionBodyContent({
    subject: pack.subject,
    grade: pack.grade,
    unit,
    type,
    index: effectiveIndex,
    progression,
    trainingLevel,
    body: buildQuestionBody({ subject: pack.subject, grade: pack.grade, unit, type, index: effectiveIndex }),
  })
  const expertDesign = buildExpertQuestionDesign({ pack, unit, type, index, body, progression, trainingLevel })
  const contentContext = [pack.grade, pack.subject, pack.unitName || pack.seriesName, unit, trainingLevel, `第${index + 1}题`]
    .filter(Boolean)
    .filter((item, itemIndex, items) => items.indexOf(item) === itemIndex)
    .join(' · ')
  const domainPool = Array.isArray(pack.curriculumTags) && pack.curriculumTags.length > 0 ? pack.curriculumTags : [pack.curriculumTags].filter(Boolean)
  const domain = domainPool[index % Math.max(domainPool.length, 1)] || unit
  const cognitiveLevel = (cognitiveBySeries[pack.series] || cognitiveBySeries.textbook)[index % 4]
  const parentTips = {
    数学: `家长讲评时先让孩子复述“${unit}”的条件和关系，再讨论哪里容易错。`,
    语文: `家长可先让孩子回到原文或关键词，再说出“${unit}”为什么这样答。`,
    英语: `家长可先带孩子定位题干关键词，再检查句型、时态和拼写。`,
  }
  const distractorAnalysis = type === '选择题'
    ? '干扰项围绕常见误判设计，如审题不清、概念混淆、运算遗漏或语境误解。'
    : ''
  const scoringRubric = type === '简答题' || type === '应用题'
    ? '按“信息是否完整、步骤是否清楚、表达是否准确”三档评分。'
    : '按标准答案自动判定，对关键结果和单位进行一致性校验。'
  const explanationSections = [
    body.explanation,
    `解题步骤：${expertDesign.solutionSteps.join('；')}。`,
    `错因提醒：${expertDesign.misconceptionDiagnosis}`,
    `讲评建议：${expertDesign.keyCheckpoint}`,
  ].filter(Boolean)

  return {
    id: `${pack.id}-q${String(index + 1).padStart(2, '0')}`,
    packId: pack.id,
    type,
    subject: pack.subject,
    grade: pack.grade,
    knowledgePoint: unit,
    domain,
    difficulty: progression.difficulty,
    trainingLevel,
    difficultyTier: progression.difficultyTier,
    masteryStage: progression.masteryStage,
    variantType: progression.variantType,
    ...buildQualityMetadata({ pack, unit, index, type }),
    cognitiveLevel,
    curriculumNode: `${pack.grade}-${pack.subject}-${domain}-${unit}`,
    answerTemplate: type === '应用题' ? '先列条件，再列式或分点说明，最后写结论。' : type === '简答题' ? '先定位原文依据，再完整作答。' : '写出最终答案并检查格式。',
    parentTip: parentTips[pack.subject] || parentTips.数学,
    distractorAnalysis,
    scoringRubric,
    sourceBlueprint: `${pack.seriesName}-${pack.grade}-${pack.subject}`,
    variantGroup: `${pack.id}-${unit}`,
    editorReviewNotes: `本题用于${pack.seriesName}中的“${trainingLevel}”环节，重点观察${unit}的掌握稳定性。`,
    ...expertDesign,
    points: pack.roundType === 'paper' ? Math.round(100 / pack.questionCount) : undefined,
    ...body,
    explanation: explanationSections.join('\n'),
    content: `【${contentContext}】${body.content}`,
  }
}

const textbookPacks = subjectBlueprints.flatMap((blueprint) =>
  gradeNames.flatMap((grade, gradeIndex) =>
    semesterNames.flatMap((semester, semesterIndex) =>
      blueprint.units[gradeIndex][semesterIndex].map((unit, unitIndex) => {
        const plan = packPlan[0]
        const packNumber = semesterIndex * 3 + unitIndex + 1
        return {
          id: `primary-g${gradeIndex + 1}-${blueprint.code}-u${packNumber}`,
          name: `${grade}${blueprint.subject}${semester}第${unitIndex + 1}单元同步练`,
          subject: blueprint.subject,
          grade,
          semester,
          unitIndex: packNumber,
          unitName: unit,
          series: plan.kind,
          seriesName: plan.label,
          roundType: plan.roundType,
          questionCount: plan.questionCount,
          difficulty: difficultyByGrade[gradeIndex],
          status: 'published',
          source: 'in_house_curated',
          sourceLabel: '自研精品题库',
          sourcePolicy,
          reviewStatus: 'published',
          qualityTier: '精品',
          qualityScore: 92,
          isMemberOnly: false,
          accessType: 'free',
          pointCost: plan.pointCost,
          createdAt: '2026-04-27',
          usageCount: 180 + gradeIndex * 35 + unitIndex * 12,
          completionRate: 84 - gradeIndex * 2,
          estimatedTime: plan.estimatedTime,
          structure: '课前预习4题 · 课中巩固8题 · 方法迁移6题 · 课后提升4题 · 易错回收2题',
        stage: '小学',
        examRole: blueprint.examRole,
        curriculumVersion,
        coverage: unit,
        ...buildPackEditorialMetadata({
          blueprint,
          grade,
          unitName: unit,
          series: plan.kind,
          plan,
          coverage: unit,
          unitIndex,
        }),
      }
    })
  )
)
)

const specialPacks = subjectBlueprints.flatMap((blueprint) =>
  gradeNames.flatMap((grade, gradeIndex) =>
    blueprint.specials.map((special, specialIndex) => {
      const plan = packPlan[1]
      const specialMap = buildSpecialUnitMap(blueprint, gradeIndex)
      const mappedSpecial = specialMap[special]
      return {
        id: `primary-g${gradeIndex + 1}-${blueprint.code}-special-${specialIndex + 1}`,
        name: `${grade}${blueprint.subject}${special}`,
        subject: blueprint.subject,
        grade,
        semester: '全册',
        unitIndex: null,
        unitName: special,
        series: plan.kind,
        seriesName: plan.label,
        roundType: plan.roundType,
        questionCount: plan.questionCount,
        difficulty: difficultyByGrade[gradeIndex],
        status: 'published',
        source: 'in_house_curated',
        sourceLabel: '自研精品题库',
        sourcePolicy,
        reviewStatus: 'published',
        qualityTier: '精品',
        qualityScore: 93,
        isMemberOnly: true,
        accessType: 'points',
        pointCost: plan.pointCost + gradeIndex * 2,
        createdAt: '2026-04-27',
        usageCount: 120 + gradeIndex * 30 + specialIndex * 15,
        completionRate: 76 - gradeIndex,
        estimatedTime: plan.estimatedTime,
        structure: '概念辨析4题 · 基础训练8题 · 方法训练8题 · 变式提升5题 · 易错回收3题',
        stage: '小学',
        examRole: blueprint.examRole,
        curriculumVersion,
        coverage: mappedSpecial?.themeFocus || special,
        specialThemeFocus: mappedSpecial?.themeFocus || special,
        coverageDepthLabel: mappedSpecial?.depthLabel || '专题训练',
        ...buildPackEditorialMetadata({
          blueprint,
          grade,
          unitName: special,
          series: plan.kind,
          plan,
          coverage: mappedSpecial?.themeFocus || special,
          unitIndex: specialIndex,
        }),
      }
    })
  )
)

const paperPacks = subjectBlueprints.flatMap((blueprint) =>
  gradeNames.flatMap((grade, gradeIndex) =>
    paperTypes.map((paperType, paperIndex) => {
      const plan = packPlan[2]
      const semester = paperIndex < 2 ? '上册' : '下册'
      const units = blueprint.units[gradeIndex][semester === '上册' ? 0 : 1]
      return {
        id: `primary-g${gradeIndex + 1}-${blueprint.code}-paper-${paperIndex + 1}`,
        name: `${grade}${blueprint.subject}${paperType}`,
        subject: blueprint.subject,
        grade,
        semester,
        unitIndex: null,
        unitName: paperType,
        series: plan.kind,
        seriesName: plan.label,
        roundType: plan.roundType,
        questionCount: plan.questionCount,
        difficulty: difficultyByGrade[gradeIndex],
        status: 'published',
        source: 'in_house_curated',
        sourceLabel: '自研精品题库',
        sourcePolicy,
        reviewStatus: 'published',
        qualityTier: '精品',
        qualityScore: 94,
        isMemberOnly: true,
        accessType: 'points',
        pointCost: plan.pointCost + gradeIndex * 3,
        createdAt: '2026-04-27',
        usageCount: 90 + gradeIndex * 24 + paperIndex * 11,
        completionRate: 72 - gradeIndex,
        estimatedTime: plan.estimatedTime,
        structure: '选择8题 · 填空10题 · 阅读/应用8题 · 综合提升4题 · 压轴表达2题',
        stage: '小学',
        examRole: blueprint.examRole,
        curriculumVersion,
        coverage: units.join('、'),
        ...buildPackEditorialMetadata({
          blueprint,
          grade,
          unitName: paperType,
          series: plan.kind,
          plan,
          coverage: units.join('、'),
          unitIndex: paperIndex,
        }),
      }
    })
  )
)

const elementaryQuestionPacks = [
  ...textbookPacks,
  ...specialPacks,
  ...paperPacks,
]

const getPackUnits = (pack) => {
  const blueprint = subjectBlueprints.find(item => item.subject === pack.subject)
  const gradeIndex = gradeNames.indexOf(pack.grade)
  if (!blueprint || gradeIndex < 0) return [pack.unitName || pack.coverage]

  if (pack.series === 'textbook') return [pack.unitName]
  if (pack.series === 'special') {
    const specialMap = buildSpecialUnitMap(blueprint, gradeIndex)
    return specialMap[pack.unitName]?.units || [pack.unitName]
  }
  return blueprint.units[gradeIndex][pack.semester === '上册' ? 0 : 1]
}

const trainingLevelsBySeries = {
  textbook: [
    ...Array(4).fill('课前预习'),
    ...Array(8).fill('课中巩固'),
    ...Array(6).fill('方法迁移'),
    ...Array(4).fill('课后提升'),
    ...Array(2).fill('易错回收'),
  ],
  special: [
    ...Array(4).fill('概念辨析'),
    ...Array(8).fill('基础训练'),
    ...Array(8).fill('方法训练'),
    ...Array(5).fill('变式提升'),
    ...Array(3).fill('易错回收'),
  ],
  paper: [
    ...Array(8).fill('选择基础'),
    ...Array(10).fill('填空巩固'),
    ...Array(8).fill('应用/阅读'),
    ...Array(4).fill('综合提升'),
    ...Array(2).fill('压轴表达'),
  ],
}

const elementaryQuestions = elementaryQuestionPacks.flatMap((pack) => {
  const units = getPackUnits(pack)
  const levels = trainingLevelsBySeries[pack.series] || trainingLevelsBySeries.textbook
  return Array.from({ length: pack.questionCount }, (_, index) => buildQuestion({
    pack,
    unit: units[index % units.length],
    index,
    trainingLevel: levels[index % levels.length],
  }))
})

const elementaryKnowledgePoints = subjectBlueprints.flatMap((blueprint) =>
  gradeNames.flatMap((grade, gradeIndex) =>
    blueprint.units[gradeIndex].flat().map((unit, unitIndex) => ({
      id: `kp-primary-g${gradeIndex + 1}-${blueprint.code}-${unitIndex + 1}`,
      subject: blueprint.subject,
      stage: '小学',
      name: unit,
      chapter: blueprint.domains[unitIndex % blueprint.domains.length],
      gradeRange: grade,
      questionCount: elementaryQuestions.filter(question => (
        question.subject === blueprint.subject &&
        question.grade === grade &&
        question.knowledgePoint === unit
      )).length,
      wrongRate: 14 + ((gradeIndex + unitIndex) % 5) * 4,
      status: 'active',
      roundAdvice: '先跟教材同步练，再进专项训练；单元结束后进入试卷诊断。',
      ...buildKnowledgePlaybook({
        subject: blueprint.subject,
        unit,
        chapter: blueprint.domains[unitIndex % blueprint.domains.length],
        wrongRate: 14 + ((gradeIndex + unitIndex) % 5) * 4,
      }),
    }))
  )
)

export {
  elementaryQuestionPacks,
  elementaryQuestions,
  elementaryKnowledgePoints,
}
