// 年级配置数据
export const GRADE_OPTIONS = [
  { value: 1, label: '一年级', shortLabel: '一' },
  { value: 2, label: '二年级', shortLabel: '二' },
  { value: 3, label: '三年级', shortLabel: '三' },
  { value: 4, label: '四年级', shortLabel: '四' },
  { value: 5, label: '五年级', shortLabel: '五' },
  { value: 6, label: '六年级', shortLabel: '六' },
  { value: 7, label: '初一', shortLabel: '初一' },
  { value: 8, label: '初二', shortLabel: '初二' },
  { value: 9, label: '初三', shortLabel: '初三' },
  { value: 10, label: '高一', shortLabel: '高一' },
  { value: 11, label: '高二', shortLabel: '高二' },
  { value: 12, label: '高三', shortLabel: '高三' },
]

// 学科配置
export const SUBJECT_OPTIONS = [
  { value: 'math', label: '数学', icon: '📐' },
  { value: 'chinese', label: '语文', icon: '📖' },
  { value: 'english', label: '英语', icon: '🔤' },
]

// 题型配置
export const QUESTION_TYPES = [
  { value: 'choice', label: '选择题', description: '单选或多选题' },
  { value: 'judgment', label: '判断题', description: '判断正误' },
  { value: 'fill', label: '填空题', description: '填写答案' },
  { value: 'short_answer', label: '简答题', description: '文字简答' },
  { value: 'application', label: '应用题', description: '计算或过程题' },
]

// 难度配置
export const DIFFICULTY_LEVELS = [
  { value: 1, label: '基础', color: '#22c55e' },
  { value: 2, label: '中等', color: '#0ea5e9' },
  { value: 3, label: '较难', color: '#f97316' },
  { value: 4, label: '困难', color: '#ef4444' },
]

// 会员套餐配置
export const MEMBERSHIP_PLANS = [
  {
    id: 'monthly',
    name: '月会员',
    price: 29,
    originalPrice: 39,
    duration: 30,
    unit: '月',
    features: ['无限拍题识别', 'AI讲解批改', '错题强化练习', '专属题包'],
    recommended: false,
  },
  {
    id: 'quarterly',
    name: '季会员',
    price: 79,
    originalPrice: 117,
    duration: 90,
    unit: '季',
    features: ['无限拍题识别', 'AI讲解批改', '错题强化练习', '专属题包', '学习报告'],
    recommended: true,
    discount: '省38元',
  },
  {
    id: 'yearly',
    name: '年会员',
    price: 199,
    originalPrice: 468,
    duration: 365,
    unit: '年',
    features: ['无限拍题识别', 'AI讲解批改', '错题强化练习', '专属题包', '学习报告', '家长端查看'],
    recommended: false,
    discount: '省269元',
  },
]

// 示例题包数据
export const SAMPLE_QUESTION_PACKS = [
  {
    id: 'pack-1',
    name: '四年级数学每日训练',
    subject: 'math',
    grade: 4,
    questionCount: 10,
    estimatedTime: 18,
    difficulty: 2,
    description: '10题小卷：概念辨析、口算、应用题和易错回收',
    isMemberOnly: false,
    questions: [
      {
        id: 'q1',
        type: 'choice',
        content: '下列哪个数是质数？',
        options: ['A. 4', 'B. 6', 'C. 7', 'D. 9'],
        answer: 'C',
        explanation: '质数是指只能被1和自身整除的大于1的自然数。7只能被1和7整除，所以是质数。',
        knowledgePoint: '质数与合数',
        difficulty: 1,
      },
      {
        id: 'q2',
        type: 'fill',
        content: '计算：125 × 8 = ______',
        answer: '1000',
        explanation: '125 × 8 = 1000，可以拆分为 125 × 4 × 2 = 500 × 2 = 1000',
        knowledgePoint: '乘法运算',
        difficulty: 1,
      },
      {
        id: 'q3',
        type: 'choice',
        content: '下面哪个算式可以用“先凑整再计算”的方法更快完成？',
        options: ['A. 25 × 4', 'B. 13 × 7', 'C. 18 + 23', 'D. 91 - 46'],
        answer: 'A',
        explanation: '25 × 4 可以直接凑成 100，是典型的凑整计算。',
        knowledgePoint: '简便计算',
        difficulty: 1,
      },
      {
        id: 'q4',
        type: 'fill',
        content: '36 ÷ 6 + 14 = ______',
        answer: '20',
        explanation: '先算除法：36 ÷ 6 = 6，再算 6 + 14 = 20。',
        knowledgePoint: '四则混合运算',
        difficulty: 1,
      },
      {
        id: 'q5',
        type: 'choice',
        content: '一个数既是 6 的倍数，又是 4 的倍数，下面哪个数符合？',
        options: ['A. 8', 'B. 12', 'C. 18', 'D. 22'],
        answer: 'B',
        explanation: '12 能同时被 6 和 4 整除，所以符合条件。',
        knowledgePoint: '倍数与公倍数',
        difficulty: 2,
      },
      {
        id: 'q6',
        type: 'fill',
        content: '把 3 个 100、4 个 10 和 6 个 1 合起来是 ______',
        answer: '346',
        explanation: '3 个 100 是 300，4 个 10 是 40，再加 6，合起来是 346。',
        knowledgePoint: '数位与组成',
        difficulty: 1,
      },
      {
        id: 'q7',
        type: 'application',
        content: '小明有36颗糖果，要平均分给6个小朋友，每个小朋友能分到多少颗糖果？',
        answer: '6',
        explanation: '36 ÷ 6 = 6，每个小朋友能分到6颗糖果。',
        knowledgePoint: '除法应用',
        difficulty: 2,
      },
      {
        id: 'q8',
        type: 'application',
        content: '一本练习册每天做 8 页，连续做 7 天，一共做多少页？',
        answer: '56',
        explanation: '每天 8 页，7 天就是 8 × 7 = 56 页。',
        knowledgePoint: '乘法应用',
        difficulty: 2,
      },
      {
        id: 'q9',
        type: 'fill',
        content: '一个长方形长 9 厘米、宽 4 厘米，周长是 ______ 厘米',
        answer: '26',
        explanation: '长方形周长 = (长 + 宽) × 2 = (9 + 4) × 2 = 26。',
        knowledgePoint: '长方形周长',
        difficulty: 2,
      },
      {
        id: 'q10',
        type: 'application',
        content: '学校买来 5 箱粉笔，每箱 24 盒，已经用了 38 盒，还剩多少盒？',
        answer: '82',
        explanation: '先算总数 5 × 24 = 120，再算剩余 120 - 38 = 82。',
        knowledgePoint: '两步应用题',
        difficulty: 3,
      },
    ],
  },
  {
    id: 'pack-2',
    name: '初一有理数基础训练',
    subject: 'math',
    grade: 7,
    questionCount: 8,
    estimatedTime: 16,
    difficulty: 2,
    description: '8题小卷：分类、数轴、加减、乘方和绝对值',
    isMemberOnly: false,
    questions: [
      {
        id: 'q1',
        type: 'choice',
        content: '下列哪个数是负整数？',
        options: ['A. -3.5', 'B. -2', 'C. 0', 'D. 1/2'],
        answer: 'B',
        explanation: '负整数是指小于0的整数。-2是小于0的整数，所以是负整数。',
        knowledgePoint: '有理数分类',
        difficulty: 1,
      },
      {
        id: 'q2',
        type: 'fill',
        content: '(-5) + 3 = ______',
        answer: '-2',
        explanation: '负数加正数，取绝对值较大的符号，并用较大的绝对值减去较小的绝对值。-5 + 3 = -2',
        knowledgePoint: '有理数加法',
        difficulty: 2,
      },
      {
        id: 'q3',
        type: 'choice',
        content: '数轴上，-4 到 0 的距离是？',
        options: ['A. -4', 'B. 0', 'C. 4', 'D. 8'],
        answer: 'C',
        explanation: '距离不能为负，-4 到 0 相隔 4 个单位长度。',
        knowledgePoint: '数轴与距离',
        difficulty: 1,
      },
      {
        id: 'q4',
        type: 'fill',
        content: '|-12| = ______',
        answer: '12',
        explanation: '绝对值表示到 0 的距离，所以 |-12| = 12。',
        knowledgePoint: '绝对值',
        difficulty: 1,
      },
      {
        id: 'q5',
        type: 'fill',
        content: '(-3) × 4 = ______',
        answer: '-12',
        explanation: '负数乘正数结果为负，3 × 4 = 12，所以答案是 -12。',
        knowledgePoint: '有理数乘法',
        difficulty: 2,
      },
      {
        id: 'q6',
        type: 'choice',
        content: '下列比较大小正确的是？',
        options: ['A. -5 > -2', 'B. -1 < -3', 'C. 0 > -1', 'D. -4 > 2'],
        answer: 'C',
        explanation: '0 大于任何负数，所以 0 > -1 正确。',
        knowledgePoint: '有理数大小比较',
        difficulty: 2,
      },
      {
        id: 'q7',
        type: 'fill',
        content: '(-2)² = ______',
        answer: '4',
        explanation: '(-2)² 表示 (-2) × (-2)，同号相乘为正，结果是 4。',
        knowledgePoint: '有理数乘方',
        difficulty: 2,
      },
      {
        id: 'q8',
        type: 'application',
        content: '某地上午气温为 -3℃，下午上升 8℃，下午气温是多少？',
        answer: '5',
        explanation: '-3 + 8 = 5，所以下午气温是 5℃。',
        knowledgePoint: '有理数加法应用',
        difficulty: 2,
      },
    ],
  },
  {
    id: 'pack-3',
    name: '阅读理解强化题包',
    subject: 'chinese',
    grade: 5,
    questionCount: 8,
    estimatedTime: 25,
    difficulty: 2,
    description: '提升阅读理解能力',
    isMemberOnly: true,
    questions: [],
  },
]

// 知识点示例数据
export const KNOWLEDGE_POINTS = {
  math: {
    primary: [
      { id: 'kp-1', name: '加减法运算', gradeRange: [1, 3] },
      { id: 'kp-2', name: '乘法运算', gradeRange: [2, 4] },
      { id: 'kp-3', name: '除法运算', gradeRange: [3, 5] },
      { id: 'kp-4', name: '质数与合数', gradeRange: [4, 6] },
      { id: 'kp-5', name: '分数运算', gradeRange: [5, 6] },
    ],
    middle: [
      { id: 'kp-6', name: '有理数', gradeRange: [7, 8] },
      { id: 'kp-7', name: '一元一次方程', gradeRange: [7, 8] },
      { id: 'kp-8', name: '几何图形', gradeRange: [7, 9] },
    ],
    high: [
      { id: 'kp-9', name: '函数', gradeRange: [10, 12] },
      { id: 'kp-10', name: '三角函数', gradeRange: [10, 12] },
    ],
  },
  chinese: {
    primary: [
      { id: 'kp-11', name: '字词理解', gradeRange: [1, 3] },
      { id: 'kp-12', name: '句子理解', gradeRange: [2, 4] },
      { id: 'kp-13', name: '阅读理解', gradeRange: [3, 6] },
    ],
    middle: [
      { id: 'kp-14', name: '文言文阅读', gradeRange: [7, 9] },
      { id: 'kp-15', name: '现代文阅读', gradeRange: [7, 9] },
    ],
  },
}

// 欢迎语配置
export const WELCOME_MESSAGES = [
  '今天也要加油哦！',
  '准备好开始练习了吗？',
  '让我们一起进步吧！',
  '今天的努力，明天的收获！',
  '相信自己，你可以的！',
]

// 获取随机欢迎语
export const getRandomWelcome = () => {
  return WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)]
}

// 根据年级获取推荐题包
export const getRecommendedPackForGrade = (grade) => {
  return SAMPLE_QUESTION_PACKS.filter(pack => pack.grade === grade || pack.grade === grade - 1 || pack.grade === grade + 1)
}

// 格式化时间
export const formatTime = (minutes) => {
  if (minutes < 60) {
    return `${minutes}分钟`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`
}
