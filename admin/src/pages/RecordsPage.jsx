import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, Clock, History } from 'lucide-react'
import { apiGet } from '../utils/api'

const fallbackRecords = []
const fallbackWrong = []
const wrongStatusLabel = (question) => question.statusLabel || (question.status === 'mastered' || question.mastered ? '已掌握' : question.status === 'corrected' ? '已订正' : question.status === 'reviewing' ? '复练中' : '新错题')
const wrongStatusClass = (question) => {
  const status = question.status || (question.mastered ? 'mastered' : 'new')
  if (status === 'mastered') return 'badge-admin badge-success'
  if (status === 'corrected' || status === 'reviewing') return 'badge-admin badge-warning'
  return 'badge-admin badge-error'
}

const RecordsPage = () => {
  const [records, setRecords] = useState(fallbackRecords)
  const [wrongQuestions, setWrongQuestions] = useState(fallbackWrong)
  const [subjectScores, setSubjectScores] = useState([])

  useEffect(() => {
    apiGet('/learning-records', fallbackRecords).then(items => setRecords(items || []))
    apiGet('/wrong-questions', fallbackWrong).then(items => setWrongQuestions(items || []))
    apiGet('/subject-scores', []).then(items => setSubjectScores(items || []))
  }, [])

  const averageAccuracy = records.length
    ? Math.round(records.reduce((sum, record) => sum + (record.correct / record.total) * 100, 0) / records.length)
    : 0
  const activeWrong = wrongQuestions.filter(item => item.status !== 'mastered' && !item.mastered).length

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-800">学习记录与错题中心</h1>
        <p className="text-sm text-neutral-500 mt-1">查看练习完成情况和错题回收进度</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card">
          <History className="text-primary-600 mb-3" size={22} />
          <div className="text-2xl font-semibold text-neutral-800">{records.length}</div>
          <div className="text-sm text-neutral-500 mt-1">练习记录</div>
        </div>
        <div className="stat-card">
          <CheckCircle2 className="text-green-600 mb-3" size={22} />
          <div className="text-2xl font-semibold text-neutral-800">{averageAccuracy}%</div>
          <div className="text-sm text-neutral-500 mt-1">平均正确率</div>
        </div>
        <div className="stat-card">
          <AlertCircle className="text-orange-600 mb-3" size={22} />
          <div className="text-2xl font-semibold text-neutral-800">{activeWrong}</div>
          <div className="text-sm text-neutral-500 mt-1">未掌握错题</div>
        </div>
        <div className="stat-card">
          <Clock className="text-purple-600 mb-3" size={22} />
          <div className="text-2xl font-semibold text-neutral-800">
            {records.reduce((sum, record) => sum + record.duration, 0)}分
          </div>
          <div className="text-sm text-neutral-500 mt-1">累计练习时长</div>
        </div>
      </div>

      <div className="data-table">
        <table className="w-full">
          <thead>
            <tr>
              <th>学科</th>
              <th>练习次数</th>
              <th>累计题量</th>
              <th>正确题数</th>
              <th>正确率</th>
              <th>平均得分</th>
              <th>最近完成</th>
            </tr>
          </thead>
          <tbody>
            {subjectScores.map(item => (
              <tr key={item.subject} className="hover:bg-neutral-50">
                <td className="font-medium text-neutral-800">{item.subject}</td>
                <td className="text-neutral-600">{item.attempts}</td>
                <td className="text-neutral-600">{item.total}</td>
                <td className="text-neutral-600">{item.correct}</td>
                <td>
                  <span className={item.accuracy >= 80 ? 'badge-admin badge-success' : 'badge-admin badge-warning'}>
                    {item.accuracy}%
                  </span>
                </td>
                <td className="font-medium text-neutral-800">{item.averageScore}分</td>
                <td className="text-neutral-500">{item.latestAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="data-table">
          <table className="w-full">
            <thead>
              <tr>
                <th>学生</th>
                <th>题包</th>
                <th>完成时间</th>
                <th>正确率</th>
              </tr>
            </thead>
            <tbody>
              {records.map(record => (
                <tr key={record.id} className="hover:bg-neutral-50">
                  <td className="font-medium text-neutral-800">{record.user}</td>
                  <td className="text-neutral-600">{record.pack}</td>
                  <td className="text-neutral-500">{record.completedAt}</td>
                  <td>
                    <span className={(record.correct / record.total) >= 0.8 ? 'badge-admin badge-success' : 'badge-admin badge-warning'}>
                      {Math.round((record.correct / record.total) * 100)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="data-table">
          <table className="w-full">
            <thead>
              <tr>
                <th>学生</th>
                <th>知识点</th>
                <th>练习次数</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {wrongQuestions.map(question => (
                <tr key={question.id} className="hover:bg-neutral-50">
                  <td className="font-medium text-neutral-800">{question.user}</td>
                  <td className="text-neutral-600">{question.knowledgePoint}</td>
                  <td className="text-neutral-600">{question.practiceCount}</td>
                  <td>
                    <span className={wrongStatusClass(question)}>
                      {wrongStatusLabel(question)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  )
}

export default RecordsPage
