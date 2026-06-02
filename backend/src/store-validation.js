const collectionRequirements = [
  ['users', 1],
  ['questionPacks', 1],
  ['questions', 1],
  ['knowledgePoints', 1],
  ['settings', null],
]

export const validateStoreSnapshot = (snapshot) => {
  const issues = []

  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    issues.push('Snapshot must be a JSON object')
    return { ok: false, issues }
  }

  collectionRequirements.forEach(([key, minLength]) => {
    if (minLength === null) {
      if (!snapshot[key] || typeof snapshot[key] !== 'object' || Array.isArray(snapshot[key])) {
        issues.push(`${key} must be an object`)
      }
      return
    }

    if (!Array.isArray(snapshot[key])) {
      issues.push(`${key} must be an array`)
      return
    }

    if (snapshot[key].length < minLength) {
      issues.push(`${key} must contain at least ${minLength} item(s)`)
    }
  })

  const packIds = new Set(Array.isArray(snapshot.questionPacks) ? snapshot.questionPacks.map(item => item.id) : [])
  const orphanQuestions = Array.isArray(snapshot.questions)
    ? snapshot.questions.filter(question => question.packId && !packIds.has(question.packId)).slice(0, 10)
    : []
  if (orphanQuestions.length > 0) {
    issues.push(`questions contain packId values missing from questionPacks: ${orphanQuestions.map(item => item.id).join(', ')}`)
  }

  const duplicatedPackIds = findDuplicates(snapshot.questionPacks || [], 'id')
  if (duplicatedPackIds.length > 0) issues.push(`duplicate questionPack ids: ${duplicatedPackIds.slice(0, 10).join(', ')}`)

  const duplicatedQuestionIds = findDuplicates(snapshot.questions || [], 'id')
  if (duplicatedQuestionIds.length > 0) issues.push(`duplicate question ids: ${duplicatedQuestionIds.slice(0, 10).join(', ')}`)

  return {
    ok: issues.length === 0,
    issues,
    summary: {
      users: Array.isArray(snapshot.users) ? snapshot.users.length : 0,
      questionPacks: Array.isArray(snapshot.questionPacks) ? snapshot.questionPacks.length : 0,
      questions: Array.isArray(snapshot.questions) ? snapshot.questions.length : 0,
      knowledgePoints: Array.isArray(snapshot.knowledgePoints) ? snapshot.knowledgePoints.length : 0,
    },
  }
}

const findDuplicates = (items, key) => {
  const seen = new Set()
  const duplicated = new Set()
  items.forEach((item) => {
    const value = item?.[key]
    if (!value) return
    if (seen.has(value)) duplicated.add(value)
    seen.add(value)
  })
  return Array.from(duplicated)
}
