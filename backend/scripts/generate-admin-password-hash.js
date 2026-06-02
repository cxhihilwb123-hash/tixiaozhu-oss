import bcrypt from 'bcryptjs'
import { stdin, stdout, stderr, exit } from 'node:process'

const rounds = Number(process.env.PASSWORD_HASH_ROUNDS || 12)
const cliPassword = process.argv.slice(2).join(' ')

const readStdin = async () => {
  if (stdin.isTTY) return ''
  let input = ''
  stdin.setEncoding('utf8')
  for await (const chunk of stdin) input += chunk
  return input.trim()
}

const password = cliPassword || await readStdin()

if (!password || password.length < 12) {
  stderr.write('Provide a production admin password with at least 12 characters via stdin or argv.\n')
  stderr.write('Example: printf %s "$ADMIN_PASSWORD" | npm --prefix backend run admin:hash-password\n')
  exit(1)
}

stdout.write(`${await bcrypt.hash(password, rounds)}\n`)
