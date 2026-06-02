import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, RefreshCw, Eye, Edit, Check, X, Settings, Wand2, FileText, Download } from 'lucide-react'
import { apiGet, apiPost } from '../utils/api'

const subjectOptions = ['数学', '语文', '英语']

const AIPage = () => {
  const [activeTab, setActiveTab] = useState('generate') // 'generate' | 'history' | 'config'
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
  const [generatedQuestions, setGeneratedQuestions] = useState([])
  const [generationHistory, setGenerationHistory] = useState([])
  const [reviewMessage, setReviewMessage] = useState('')
  
  // 生成配置
  const [config, setConfig] = useState({
    subject: '数学',
    grade: '四年级',
    knowledgePoint: '乘法运算',
    difficulty: '中等',
    questionType: '填空题',
    count: 5,
  })
  
  const fallbackGenerate = import.meta.env.PROD ? null : () => Array.from({ length: config.count }, (_, index) => {
    const isChoice = config.questionType === '选择题'
    return {
      id: `local-${Date.now()}-${index + 1}`,
      content: isChoice
        ? `${config.grade}${config.subject}：关于“${config.knowledgePoint}”，下列说法正确的是？`
        : `${config.grade}${config.subject}：${config.knowledgePoint} 练习题 ${index + 1}`,
      options: isChoice ? ['A. 忽略条件', 'B. 只看数字', 'C. 先确认定义和限制条件', 'D. 不写步骤'] : undefined,
      answer: isChoice ? 'C' : String((index + 1) * 100),
      explanation: `围绕 ${config.knowledgePoint} 的核心规则进行拆解。`,
      type: config.questionType,
      difficulty: config.difficulty,
    }
  })

  const fallbackHistory = import.meta.env.PROD ? [] : [
    { id: 'local-1', subject: '数学', grade: '四年级', knowledgePoint: '乘法运算', count: 10, status: 'published', createdAt: '2026-04-15 10:30' },
    { id: 'local-2', subject: '语文', grade: '五年级', knowledgePoint: '阅读理解', count: 8, status: 'review', createdAt: '2026-04-14 15:20' },
    { id: 'local-3', subject: '英语', grade: '初一', knowledgePoint: '语法', count: 15, status: 'draft', createdAt: '2026-04-13 09:45' },
  ]

  useEffect(() => {
    apiGet('/ai/history', fallbackHistory).then(items => setGenerationHistory(items || []))
  }, [])

  const handleGenerate = async () => {
    setIsGenerating(true)
    const questions = await apiPost('/ai/generate', config, fallbackGenerate)
    setGeneratedQuestions(questions || [])
    setReviewMessage('')
    setIsGenerating(false)
  }

  const handleSubmitReview = async () => {
    if (generatedQuestions.length === 0) return
    setIsSubmittingReview(true)
    const record = await apiPost('/ai/review', {
      config,
      questions: generatedQuestions,
    }, null)
    if (record) {
      setGenerationHistory((prev) => [record, ...prev])
      setGeneratedQuestions([])
      setReviewMessage('已提交审核，可在生成历史中查看。')
    } else {
      setReviewMessage('提交失败，请确认后台服务和 AI 配置可用。')
    }
    setIsSubmittingReview(false)
    setActiveTab('history')
  }
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-800">AI出题中心</h1>
          <p className="text-sm text-neutral-500 mt-1">智能生成题目和题包</p>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex gap-4 border-b border-neutral-200">
        <button
          onClick={() => setActiveTab('generate')}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'generate'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          智能生成
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'history'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          生成历史
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'config'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          AI配置
        </button>
      </div>
      
      {/* Content */}
      {activeTab === 'generate' && (
        <div className="grid grid-cols-2 gap-6">
          {/* Config Panel */}
          <div className="stat-card">
            <h3 className="text-lg font-semibold text-neutral-800 mb-4 flex items-center gap-2">
              <Settings size={20} className="text-primary-500" />
              生成配置
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-neutral-600 mb-2 block">学科</label>
                <select
                  value={config.subject}
                  onChange={(e) => setConfig({ ...config, subject: e.target.value })}
                  className="input-admin w-full"
                >
                  {subjectOptions.map(subject => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-sm text-neutral-600 mb-2 block">年级</label>
                <select
                  value={config.grade}
                  onChange={(e) => setConfig({ ...config, grade: e.target.value })}
                  className="input-admin w-full"
                >
                  <option value="一年级">一年级</option>
                  <option value="二年级">二年级</option>
                  <option value="三年级">三年级</option>
                  <option value="四年级">四年级</option>
                  <option value="五年级">五年级</option>
                  <option value="六年级">六年级</option>
                  <option value="初一">初一</option>
                  <option value="初二">初二</option>
                  <option value="初三">初三</option>
                </select>
              </div>
              
              <div>
                <label className="text-sm text-neutral-600 mb-2 block">知识点</label>
                <input
                  type="text"
                  value={config.knowledgePoint}
                  onChange={(e) => setConfig({ ...config, knowledgePoint: e.target.value })}
                  className="input-admin w-full"
                  placeholder="输入知识点"
                />
              </div>
              
              <div>
                <label className="text-sm text-neutral-600 mb-2 block">难度</label>
                <select
                  value={config.difficulty}
                  onChange={(e) => setConfig({ ...config, difficulty: e.target.value })}
                  className="input-admin w-full"
                >
                  <option value="基础">基础</option>
                  <option value="中等">中等</option>
                  <option value="较难">较难</option>
                  <option value="困难">困难</option>
                </select>
              </div>
              
              <div>
                <label className="text-sm text-neutral-600 mb-2 block">题型</label>
                <select
                  value={config.questionType}
                  onChange={(e) => setConfig({ ...config, questionType: e.target.value })}
                  className="input-admin w-full"
                >
                  <option value="选择题">选择题</option>
                  <option value="填空题">填空题</option>
                  <option value="应用题">应用题</option>
                  <option value="简答题">简答题</option>
                </select>
              </div>
              
              <div>
                <label className="text-sm text-neutral-600 mb-2 block">生成数量</label>
                <input
                  type="number"
                  value={config.count}
                  onChange={(e) => setConfig({ ...config, count: parseInt(e.target.value) })}
                  className="input-admin w-full"
                  min="1"
                  max="50"
                />
              </div>
              
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="btn-admin btn-admin-primary w-full flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    正在生成...
                  </>
                ) : (
                  <>
                    <Wand2 size={16} />
                    开始生成
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* Preview Panel */}
          <div className="stat-card">
            <h3 className="text-lg font-semibold text-neutral-800 mb-4 flex items-center gap-2">
              <Eye size={20} className="text-primary-500" />
              生成预览
            </h3>
            
            {generatedQuestions.length === 0 ? (
              <div className="text-center py-12 text-neutral-400">
                <Sparkles size={48} className="mx-auto mb-4 opacity-50" />
                <p>点击"开始生成"生成题目</p>
              </div>
            ) : (
              <div className="space-y-4">
                {generatedQuestions.map((question, index) => (
                  <motion.div
                    key={question.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-4 bg-neutral-50 rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="badge-admin badge-info">{question.type}</span>
                      <div className="flex gap-2">
                        <button className="p-1 rounded hover:bg-neutral-200 text-neutral-500">
                          <Edit size={14} />
                        </button>
                        <button className="p-1 rounded hover:bg-neutral-200 text-neutral-500">
                          <RefreshCw size={14} />
                        </button>
                      </div>
                    </div>
                    <p className="text-neutral-800 mb-2">{question.content}</p>
                    <div className="text-sm text-neutral-500">
                      <span className="font-medium">答案：</span>{question.answer}
                    </div>
                    {question.options?.length > 0 && (
                      <div className="mt-2 grid gap-1 text-sm text-neutral-500">
                        {question.options.map(option => (
                          <span key={option}>{option}</span>
                        ))}
                      </div>
                    )}
                    <div className="text-sm text-neutral-500 mt-1">
                      <span className="font-medium">解析：</span>{question.explanation}
                    </div>
                  </motion.div>
                ))}
                
                <div className="flex gap-3 pt-4">
                  <button className="btn-admin btn-admin-secondary flex-1 flex items-center justify-center gap-2">
                    <Edit size={16} />
                    编辑修改
                  </button>
                  <button
                    onClick={handleSubmitReview}
                    disabled={isSubmittingReview}
                    className="btn-admin btn-admin-primary flex-1 flex items-center justify-center gap-2"
                  >
                    <Check size={16} />
                    {isSubmittingReview ? '提交中...' : '提交审核'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {reviewMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {reviewMessage}
        </div>
      )}
      
      {activeTab === 'history' && (
        <div className="data-table">
          <table className="w-full">
            <thead>
              <tr>
                <th>生成时间</th>
                <th>学科</th>
                <th>年级</th>
                <th>知识点</th>
                <th>生成数量</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {generationHistory.map((record) => (
                <motion.tr
                  key={record.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-neutral-50"
                >
                  <td className="text-neutral-500">{record.createdAt}</td>
                  <td className="text-neutral-600">{record.subject}</td>
                  <td className="text-neutral-600">{record.grade}</td>
                  <td className="text-neutral-600">{record.knowledgePoint}</td>
                  <td className="text-neutral-600">{record.count}题</td>
                  <td>
                    {record.status === 'published' && <span className="badge-admin badge-success">已发布</span>}
                    {record.status === 'review' && <span className="badge-admin badge-warning">待审核</span>}
                    {record.status === 'draft' && <span className="badge-admin badge-info">草稿</span>}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500">
                        <Eye size={16} />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500">
                        <Download size={16} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {activeTab === 'config' && (
        <div className="stat-card max-w-2xl">
          <h3 className="text-lg font-semibold text-neutral-800 mb-4">AI模型配置</h3>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-neutral-600 mb-2 block">模型选择</label>
              <select className="input-admin w-full">
                <option value="gpt4">GPT-4</option>
                <option value="gpt3.5">GPT-3.5</option>
                <option value="claude">Claude</option>
                <option value="custom">自定义模型</option>
              </select>
            </div>
            
            <div>
              <label className="text-sm text-neutral-600 mb-2 block">API Key</label>
              <input
                type="password"
                className="input-admin w-full"
                placeholder="输入API Key"
              />
            </div>
            
            <div>
              <label className="text-sm text-neutral-600 mb-2 block">生成温度</label>
              <input
                type="number"
                className="input-admin w-full"
                defaultValue="0.7"
                min="0"
                max="1"
                step="0.1"
              />
              <p className="text-xs text-neutral-400 mt-1">控制生成内容的随机性，0-1之间</p>
            </div>
            
            <div>
              <label className="text-sm text-neutral-600 mb-2 block">最大生成长度</label>
              <input
                type="number"
                className="input-admin w-full"
                defaultValue="2000"
                min="100"
                max="4000"
              />
            </div>
            
            <button className="btn-admin btn-admin-primary">保存配置</button>
          </div>
        </div>
      )}
    </motion.div>
  )
}

export default AIPage
