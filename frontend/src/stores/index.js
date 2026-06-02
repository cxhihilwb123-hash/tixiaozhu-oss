import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const buildWrongQuestionGroups = (questions) => {
  const bySubject = {}
  const byKnowledgePoint = {}

  questions.forEach(q => {
    if (!bySubject[q.subject]) bySubject[q.subject] = []
    bySubject[q.subject].push(q)

    if (q.knowledgePoint) {
      if (!byKnowledgePoint[q.knowledgePoint]) byKnowledgePoint[q.knowledgePoint] = []
      byKnowledgePoint[q.knowledgePoint].push(q)
    }
  })

  return { bySubject, byKnowledgePoint }
}

const normalizeWrongQuestionStatus = (question) => {
  if (question.status) return question.status
  if (question.mastered) return 'mastered'
  if (Number(question.practiceCount || 0) > 0) return 'reviewing'
  return 'new'
}

const wrongQuestionStatusLabel = (status) => ({
  new: '新错题',
  corrected: '已订正',
  reviewing: '复练中',
  mastered: '已掌握',
}[status] || '新错题')

// 用户状态管理
export const useUserStore = create(
  persist(
    (set, get) => ({
      // 用户基本信息
      user: null,
      isLoggedIn: false,
      authToken: null,
      
      // 学生档案
      studentProfile: {
        nickname: '',
        grade: null, // 年级 1-12
        gradeName: '', // 年级名称如"四年级"
        subjectPreferences: [], // 学科偏好
        avatar: null,
      },
      
      // 会员状态
      membership: {
        isMember: false,
        plan: null, // 'monthly', 'quarterly', 'yearly'
        expireDate: null,
        trialUsed: false,
      },

      // 积分账户
      pointsAccount: {
        balance: 20,
        totalEarned: 20,
        totalSpent: 0,
        rules: [],
        packages: [],
        recentTransactions: [],
      },

      // 已购买内容
      contentPurchases: [],
      
      // 学习统计
      stats: {
        weeklyCompleted: 0,
        totalCompleted: 0,
        accuracyRate: 0,
        weakPoints: [], // 薄弱知识点
        recentProgress: '',
      },
      
      // 当前进行中的练习
      currentSession: null,
      
      // Actions
      setGrade: (grade, gradeName) => set((state) => ({
        studentProfile: { ...state.studentProfile, grade, gradeName }
      })),
      
      setNickname: (nickname) => set((state) => ({
        studentProfile: { ...state.studentProfile, nickname }
      })),
      
      setAvatar: (avatar) => set((state) => ({
        studentProfile: { ...state.studentProfile, avatar }
      })),
      
      setSubjectPreferences: (subjects) => set((state) => ({
        studentProfile: { ...state.studentProfile, subjectPreferences: subjects }
      })),
      
      setMembership: (membership) => set({ membership }),

      setPointsAccount: (account) => set((state) => ({
        pointsAccount: { ...state.pointsAccount, ...account }
      })),

      setContentPurchases: (purchases) => set({ contentPurchases: purchases || [] }),

      addContentPurchase: (purchase) => set((state) => {
        if (!purchase) return state
        return {
          contentPurchases: [
            purchase,
            ...state.contentPurchases.filter(item => item.packId !== purchase.packId),
          ],
        }
      }),

      applyPointTransaction: (transaction) => set((state) => {
        if (!transaction) return state
        const nextBalance = Number(transaction.balanceAfter ?? state.pointsAccount.balance)
        return {
          pointsAccount: {
            ...state.pointsAccount,
            balance: nextBalance,
            totalEarned: transaction.type === 'credit'
              ? Number(state.pointsAccount.totalEarned || 0) + Number(transaction.points || 0)
              : state.pointsAccount.totalEarned,
            totalSpent: transaction.type === 'debit'
              ? Number(state.pointsAccount.totalSpent || 0) + Number(transaction.points || 0)
              : state.pointsAccount.totalSpent,
            recentTransactions: [transaction, ...(state.pointsAccount.recentTransactions || [])].slice(0, 12),
          },
        }
      }),
      
      updateStats: (stats) => set((state) => ({
        stats: { ...state.stats, ...stats }
      })),
      
      setCurrentSession: (session) => set({ currentSession: session }),
      
      clearCurrentSession: () => set({ currentSession: null }),
      
      login: ({ token, user }) => set((state) => ({
        user,
        authToken: token,
        isLoggedIn: true,
        studentProfile: {
          ...state.studentProfile,
          nickname: user?.nickname || state.studentProfile.nickname,
          grade: user?.grade || state.studentProfile.grade,
          gradeName: user?.grade || state.studentProfile.gradeName,
          subjectPreferences: user?.subject
            ? Array.from(new Set([...(state.studentProfile.subjectPreferences || []), user.subject]))
            : state.studentProfile.subjectPreferences,
        },
        membership: {
          ...state.membership,
          isMember: user?.memberStatus === 'active',
          plan: user?.memberPlan || state.membership.plan,
          expireDate: user?.expireDate || state.membership.expireDate,
        },
        pointsAccount: {
          ...state.pointsAccount,
          balance: Number(user?.pointsBalance ?? state.pointsAccount.balance),
        },
      })),

      syncAuthenticatedUser: (user) => set((state) => ({
        user,
        isLoggedIn: Boolean(user),
        studentProfile: {
          ...state.studentProfile,
          nickname: user?.nickname || state.studentProfile.nickname,
          grade: user?.grade || state.studentProfile.grade,
          gradeName: user?.grade || state.studentProfile.gradeName,
        },
        membership: {
          ...state.membership,
          isMember: user?.memberStatus === 'active',
          plan: user?.memberPlan || state.membership.plan,
          expireDate: user?.expireDate || state.membership.expireDate,
        },
        pointsAccount: {
          ...state.pointsAccount,
          balance: Number(user?.pointsBalance ?? state.pointsAccount.balance),
        },
      })),
      
      logout: () => set({ 
        user: null, 
        authToken: null,
        isLoggedIn: false,
        currentSession: null 
      }),
      
      // 判断是否首次进入
      isFirstVisit: () => {
        const state = get()
        return !state.studentProfile.grade
      },
    }),
    {
      name: 'tixiaozhu-user',
      partialize: (state) => ({
        studentProfile: state.studentProfile,
        user: state.user,
        isLoggedIn: state.isLoggedIn,
        authToken: state.authToken,
        membership: state.membership,
        pointsAccount: state.pointsAccount,
        contentPurchases: state.contentPurchases,
        stats: state.stats,
      }),
    }
  )
)

// 练习/题包状态管理
export const usePracticeStore = create(
  persist(
    (set, get) => ({
      // 推荐题组
      recommendedPacks: [],
      
      // 今日推荐
      todayRecommend: null,
      
      // 错题强化题组
      wrongQuestionPack: null,
      
      // AI推荐题组
      aiRecommendPack: null,
      
      // 当前答题状态
      currentPractice: {
        packId: null,
        packName: '',
        questions: [],
        currentIndex: 0,
        answers: [],
        startTime: null,
        isCompleted: false,
      },
      
      // Actions
      setRecommendedPacks: (packs) => set({ recommendedPacks: packs }),
      
      setTodayRecommend: (pack) => set({ todayRecommend: pack }),
      
      setWrongQuestionPack: (pack) => set({ wrongQuestionPack: pack }),
      
      setAiRecommendPack: (pack) => set({ aiRecommendPack: pack }),
      
      startPractice: (pack) => set({
        currentPractice: {
          packId: pack.id,
          packName: pack.name,
          questions: pack.questions,
          currentIndex: 0,
          answers: [],
          startTime: Date.now(),
          isCompleted: false,
        }
      }),
      
      submitAnswer: (answer) => set((state) => ({
        currentPractice: {
          ...state.currentPractice,
          answers: [...state.currentPractice.answers, answer],
          currentIndex: state.currentPractice.currentIndex + 1,
        }
      })),
      
      nextQuestion: () => set((state) => ({
        currentPractice: {
          ...state.currentPractice,
          currentIndex: state.currentPractice.currentIndex + 1,
        }
      })),
      
      completePractice: () => set((state) => ({
        currentPractice: {
          ...state.currentPractice,
          isCompleted: true,
        }
      })),
      
      clearPractice: () => set({
        currentPractice: {
          packId: null,
          packName: '',
          questions: [],
          currentIndex: 0,
          answers: [],
          startTime: null,
          isCompleted: false,
        }
      }),
      
      // 获取当前题目
      getCurrentQuestion: () => {
        const state = get()
        const { questions, currentIndex } = state.currentPractice
        if (questions.length > 0 && currentIndex < questions.length) {
          return questions[currentIndex]
        }
        return null
      },
      
      // 获取进度
      getProgress: () => {
        const state = get()
        const { questions, currentIndex } = state.currentPractice
        return {
          total: questions.length,
          current: currentIndex + 1,
          percentage: questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0
        }
      },
    }),
    {
      name: 'tixiaozhu-practice',
      partialize: (state) => ({
        currentPractice: state.currentPractice,
      }),
    }
  )
)

// 错题状态管理
export const useWrongQuestionStore = create(
  persist(
    (set, get) => ({
      // 错题列表
      wrongQuestions: [],
      
      // 按学科分组
      bySubject: {},
      
      // 按知识点分组
      byKnowledgePoint: {},
      
      // 已掌握的错题
      masteredIds: [],

      // 自定义错题练习
      customPracticePacks: [],
      
      // Actions
      setWrongQuestions: (questions) => set(() => {
        const wrongQuestions = questions.map((question, index) => ({
          ...question,
          id: question.id || `wrong-${Date.now()}-${index}`,
          subject: question.subject === '数学' ? 'math' : question.subject === '语文' ? 'chinese' : question.subject || 'math',
          answer: question.answer || question.correctAnswer,
          userAnswer: question.userAnswer || question.wrongAnswer,
          addedAt: question.addedAt || Date.now() - index * 60000,
          status: normalizeWrongQuestionStatus(question),
          statusLabel: question.statusLabel || wrongQuestionStatusLabel(normalizeWrongQuestionStatus(question)),
          mastered: normalizeWrongQuestionStatus(question) === 'mastered',
          practiceCount: Number(question.practiceCount || 0),
        }))
        const { bySubject, byKnowledgePoint } = buildWrongQuestionGroups(wrongQuestions)
        return {
          wrongQuestions,
          bySubject,
          byKnowledgePoint,
          masteredIds: wrongQuestions.filter(q => q.mastered).map(q => q.id),
        }
      }),

      addWrongQuestion: (question) => set((state) => {
        const questionKey = question.questionId || question.id
        const existing = state.wrongQuestions.find(item => String(item.questionId || item.id) === String(questionKey))
        const nextQuestion = {
          ...question,
          questionId: question.questionId || question.id,
          addedAt: Date.now(),
          mastered: false,
          status: 'new',
          statusLabel: '新错题',
          practiceCount: Number(existing?.practiceCount || 0),
        }
        const newWrongQuestions = existing
          ? state.wrongQuestions.map(item => String(item.questionId || item.id) === String(questionKey) ? { ...item, ...nextQuestion, id: item.id } : item)
          : [...state.wrongQuestions, nextQuestion]
        
        const { bySubject, byKnowledgePoint } = buildWrongQuestionGroups(newWrongQuestions)
        
        return {
          wrongQuestions: newWrongQuestions,
          bySubject,
          byKnowledgePoint,
        }
      }),
      
      markAsMastered: (questionId) => set((state) => {
        const wrongQuestions = state.wrongQuestions.map(q =>
          q.id === questionId ? { ...q, mastered: true, status: 'mastered', statusLabel: '已掌握', masteredAt: Date.now() } : q
        )
        const { bySubject, byKnowledgePoint } = buildWrongQuestionGroups(wrongQuestions)
        return {
          masteredIds: Array.from(new Set([...state.masteredIds, questionId])),
          wrongQuestions,
          bySubject,
          byKnowledgePoint,
        }
      }),
      
      markManyAsMastered: (questionIds) => set((state) => {
        const idSet = new Set(questionIds)
        const wrongQuestions = state.wrongQuestions.map(q =>
          idSet.has(q.id) ? { ...q, mastered: true, status: 'mastered', statusLabel: '已掌握', masteredAt: Date.now() } : q
        )
        const { bySubject, byKnowledgePoint } = buildWrongQuestionGroups(wrongQuestions)
        return {
          masteredIds: Array.from(new Set([...state.masteredIds, ...questionIds])),
          wrongQuestions,
          bySubject,
          byKnowledgePoint,
        }
      }),

      markAsCorrected: (questionId) => set((state) => {
        const wrongQuestions = state.wrongQuestions.map(q =>
          q.id === questionId ? { ...q, mastered: false, status: 'corrected', statusLabel: '已订正', correctedAt: Date.now() } : q
        )
        const { bySubject, byKnowledgePoint } = buildWrongQuestionGroups(wrongQuestions)
        return { wrongQuestions, bySubject, byKnowledgePoint }
      }),

      markManyAsCorrected: (questionIds) => set((state) => {
        const idSet = new Set(questionIds)
        const wrongQuestions = state.wrongQuestions.map(q =>
          idSet.has(q.id) ? { ...q, mastered: false, status: 'corrected', statusLabel: '已订正', correctedAt: Date.now() } : q
        )
        const { bySubject, byKnowledgePoint } = buildWrongQuestionGroups(wrongQuestions)
        return { wrongQuestions, bySubject, byKnowledgePoint }
      }),

      removeFromWrongSet: (questionId) => set((state) => {
        const wrongQuestions = state.wrongQuestions.filter(q => q.id !== questionId)
        const { bySubject, byKnowledgePoint } = buildWrongQuestionGroups(wrongQuestions)
        return {
          wrongQuestions,
          masteredIds: state.masteredIds.filter(id => id !== questionId),
          bySubject,
          byKnowledgePoint,
        }
      }),

      removeManyFromWrongSet: (questionIds) => set((state) => {
        const idSet = new Set(questionIds)
        const wrongQuestions = state.wrongQuestions.filter(q => !idSet.has(q.id))
        const { bySubject, byKnowledgePoint } = buildWrongQuestionGroups(wrongQuestions)
        return {
          wrongQuestions,
          masteredIds: state.masteredIds.filter(id => !idSet.has(id)),
          bySubject,
          byKnowledgePoint,
          customPracticePacks: state.customPracticePacks.map(pack => ({
            ...pack,
            questions: pack.questions.filter(q => !idSet.has(q.id)),
          })).filter(pack => pack.questions.length > 0),
        }
      }),
      
      incrementPracticeCount: (questionId) => set((state) => {
        const wrongQuestions = state.wrongQuestions.map(q =>
          q.id === questionId && !q.mastered
            ? { ...q, status: 'reviewing', statusLabel: '复练中', practiceCount: Number(q.practiceCount || 0) + 1, lastPracticedAt: Date.now() }
            : q
        )
        const { bySubject, byKnowledgePoint } = buildWrongQuestionGroups(wrongQuestions)
        return { wrongQuestions, bySubject, byKnowledgePoint }
      }),

      incrementManyPracticeCount: (questionIds) => set((state) => {
        const idSet = new Set(questionIds)
        const wrongQuestions = state.wrongQuestions.map(q =>
          idSet.has(q.id) && !q.mastered
            ? { ...q, status: 'reviewing', statusLabel: '复练中', practiceCount: Number(q.practiceCount || 0) + 1, lastPracticedAt: Date.now() }
            : q
        )
        const { bySubject, byKnowledgePoint } = buildWrongQuestionGroups(wrongQuestions)
        return { wrongQuestions, bySubject, byKnowledgePoint }
      }),

      createWrongPracticePack: (questions, name) => {
        const cleanQuestions = questions.filter(Boolean)
        const pack = {
          id: `wrong-pack-${Date.now()}`,
          name: name || `错题小卷 ${cleanQuestions.length}题`,
          questions: cleanQuestions,
          questionCount: cleanQuestions.length,
          estimatedTime: Math.max(5, cleanQuestions.length * 3),
          subject: cleanQuestions[0]?.subject || 'math',
          roundType: 'wrong',
          createdAt: Date.now(),
        }
        set((state) => ({
          customPracticePacks: [pack, ...state.customPracticePacks].slice(0, 8),
        }))
        return pack
      },
      
      getRecentWrongQuestions: (limit = 10) => {
        const state = get()
        return state.wrongQuestions
          .filter(q => !q.mastered)
          .sort((a, b) => b.addedAt - a.addedAt)
          .slice(0, limit)
      },
      
      getWrongCountBySubject: (subject) => {
        const state = get()
        return state.bySubject[subject]?.filter(q => !q.mastered).length || 0
      },
      
      getTotalWrongCount: () => {
        const state = get()
        return state.wrongQuestions.filter(q => !q.mastered).length
      },
    }),
    {
      name: 'tixiaozhu-wrong-questions',
    }
  )
)

// 收藏题目状态管理
export const useFavoriteQuestionStore = create(
  persist(
    (set, get) => ({
      favoriteQuestions: [],

      setFavoriteQuestions: (questions) => set({
        favoriteQuestions: (questions || []).map((question, index) => ({
          ...question,
          id: question.id || `fav-local-${question.questionId || index}`,
          createdAt: question.createdAt || Date.now(),
        })),
      }),

      addFavoriteQuestion: (question) => set((state) => {
        const questionId = question.questionId || question.id
        if (state.favoriteQuestions.some(item => item.questionId === questionId || item.id === questionId)) return state
        return {
          favoriteQuestions: [
            {
              ...question,
              id: question.id || `fav-${Date.now()}`,
              questionId,
              createdAt: question.createdAt || Date.now(),
            },
            ...state.favoriteQuestions,
          ],
        }
      }),

      isFavorite: (questionId) => {
        const state = get()
        return state.favoriteQuestions.some(item => item.questionId === questionId || item.id === questionId)
      },
    }),
    {
      name: 'tixiaozhu-favorite-questions',
    }
  )
)

// 拍题/上传状态管理
export const useUploadStore = create(
  persist(
    (set, get) => ({
      uploadedQuestions: [],
      uploadPracticePacks: [],

      currentUpload: {
        image: null,
        recognizedText: '',
        isRecognizing: false,
        question: null,
        isEditing: false,
      },

      aiExplanation: {
        content: '',
        isLoading: false,
      },

      aiCorrection: {
        result: null,
        isLoading: false,
      },

      setImage: (image) => set((state) => ({
        currentUpload: { ...state.currentUpload, image, isRecognizing: true }
      })),

      setRecognizedText: (text) => set((state) => ({
        currentUpload: {
          ...state.currentUpload,
          recognizedText: text,
          isRecognizing: false,
          isEditing: true,
        }
      })),

      setQuestion: (question) => set((state) => ({
        currentUpload: { ...state.currentUpload, question, isEditing: false }
      })),

      startExplanation: () => set((state) => ({
        aiExplanation: { ...state.aiExplanation, isLoading: true }
      })),

      setExplanation: (content) => set(() => ({
        aiExplanation: { content, isLoading: false }
      })),

      startCorrection: () => set((state) => ({
        aiCorrection: { ...state.aiCorrection, isLoading: true }
      })),

      setCorrection: (result) => set(() => ({
        aiCorrection: { result, isLoading: false }
      })),

      clearUpload: () => set({
        currentUpload: {
          image: null,
          recognizedText: '',
          isRecognizing: false,
          question: null,
          isEditing: false,
        },
        aiExplanation: { content: '', isLoading: false },
        aiCorrection: { result: null, isLoading: false },
      }),

      setUploadedQuestions: (questions) => set((state) => {
        const existingIds = new Set(state.uploadedQuestions.map(item => String(item.id)))
        const incoming = questions
          .filter(item => !existingIds.has(String(item.id)))
          .map((item, index) => ({
            ...item,
            source: 'uploaded',
            uploadedAt: item.uploadedAt || Date.now() - index * 60000,
            practiceCount: Number(item.practiceCount || 0),
          }))
        return {
          uploadedQuestions: [...incoming, ...state.uploadedQuestions],
        }
      }),

      addToUploadedQuestions: (question, meta = {}) => {
        const record = {
          ...question,
          id: meta.id || question.id || `local-upl-${Date.now()}`,
          source: 'uploaded',
          sourceType: meta.sourceType || question.sourceType || 'photo',
          recognizedText: meta.recognizedText || question.content || '',
          userAnswer: meta.userAnswer || question.userAnswer || '',
          correctionStatus: meta.correctionStatus || question.correctionStatus || 'ungraded',
          uploadedAt: meta.uploadedAt || Date.now(),
          practiceCount: Number(question.practiceCount || 0),
        }
        set((state) => ({
          uploadedQuestions: [record, ...state.uploadedQuestions.filter(item => String(item.id) !== String(record.id))],
        }))
        return record
      },

      removeUploadedQuestion: (questionId) => set((state) => ({
        uploadedQuestions: state.uploadedQuestions.filter(item => item.id !== questionId),
        uploadPracticePacks: state.uploadPracticePacks.map(pack => ({
          ...pack,
          questions: pack.questions.filter(question => question.id !== questionId),
        })).filter(pack => pack.questions.length > 0),
      })),

      incrementUploadedPracticeCount: (questionIds) => set((state) => {
        const ids = new Set(Array.isArray(questionIds) ? questionIds : [questionIds])
        return {
          uploadedQuestions: state.uploadedQuestions.map(item => ids.has(item.id)
            ? { ...item, practiceCount: Number(item.practiceCount || 0) + 1, lastPracticedAt: Date.now() }
            : item
          ),
        }
      }),

      createUploadPracticePack: (questions, name) => {
        const cleanQuestions = questions.filter(Boolean)
        const pack = {
          id: `upload-pack-${Date.now()}`,
          name: name || `拍题小卷 ${cleanQuestions.length}题`,
          questions: cleanQuestions,
          questionCount: cleanQuestions.length,
          estimatedTime: Math.max(5, cleanQuestions.length * 3),
          subject: cleanQuestions[0]?.subject || 'math',
          roundType: 'uploaded',
          createdAt: Date.now(),
        }
        set((state) => ({
          uploadPracticePacks: [pack, ...state.uploadPracticePacks].slice(0, 8),
        }))
        return pack
      },
    }),
    {
      name: 'tixiaozhu-uploaded-questions',
      partialize: (state) => ({
        uploadedQuestions: state.uploadedQuestions,
        uploadPracticePacks: state.uploadPracticePacks,
      }),
    }
  )
)
